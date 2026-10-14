import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = resolve('scripts/extension-release.mjs');
const manifestPath = 'src/extension/public/manifest.json';
let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'efatura-release-'));
  mkdirSync(join(directory, 'src/extension/public'), { recursive: true });
  for (const path of ['package.json', 'package-lock.json', manifestPath]) {
    cpSync(path, join(directory, path));
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function bump(version: string) {
  return execFileSync(process.execPath, [script, 'version', version], {
    cwd: directory,
    stdio: 'pipe',
  });
}

function readJson(path: string) {
  return JSON.parse(readFileSync(join(directory, path), 'utf8'));
}

describe('extension release versioning', () => {
  it('synchronizes the manifest, package, and lockfile for increasing CI versions', () => {
    for (const version of ['0.2.0.1', '0.2.0.65535', '0.2.1.0']) {
      bump(version);
      expect(readJson(manifestPath).version).toBe(version);
      expect(readJson('package.json').version).toBe(version);
      expect(readJson('package-lock.json').version).toBe(version);
      expect(readJson('package-lock.json').packages[''].version).toBe(version);
    }
  });

  it.each(['0', '0.0.0.0', '0.2.65536.0', '0.2.01.0', '1.2.3.4.5', '1.0.0-beta', ''])('rejects invalid version %j without changing files', (version) => {
    const before = readFileSync(join(directory, manifestPath), 'utf8');
    expect(() => bump(version)).toThrow();
    expect(readFileSync(join(directory, manifestPath), 'utf8')).toBe(before);
  });

  it.each(['0.2.1', '0.2.1.0', '0.2.0.65535', '0.1.65535.65535'])('rejects equal or decreasing version %s', (version) => {
    bump('0.2.1.0');
    expect(() => bump(version)).toThrow();
    expect(readJson(manifestPath).version).toBe('0.2.1.0');
  });
});
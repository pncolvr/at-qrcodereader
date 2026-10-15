import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const manifestPath = 'src/extension/public/manifest.json';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(manifestPath);
const packageJson = readJson('package.json');
const [command, value] = process.argv.slice(2);

function versionParts(version) {
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(version)) {
    throw new Error('Chrome versions require 1-4 integers with no leading zeros.');
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) {
    throw new Error('Version components must be 0-65535 and cannot all be zero.');
  }
  return Array.from({ length: 4 }, (_, index) => parts[index] ?? 0);
}

function requireIncrease(next, previous) {
  const nextParts = versionParts(next);
  const previousParts = versionParts(previous);
  const difference = nextParts.findIndex((part, index) => part !== previousParts[index]);
  if (difference < 0 || nextParts[difference] < previousParts[difference]) {
    throw new Error(`Extension version ${next} must be greater than ${previous}. Run npm run version:extension -- <version>.`);
  }
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

if (command === 'version') {
  requireIncrease(value ?? '', manifest.version);
  const lock = readJson('package-lock.json');
  manifest.version = value;
  packageJson.version = value;
  lock.version = value;
  lock.packages[''].version = value;
  writeJson(manifestPath, manifest);
  writeJson('package.json', packageJson);
  writeJson('package-lock.json', lock);
  console.log(`Extension version updated to ${value}.`);
} else {
  versionParts(manifest.version);
  if (manifest.version !== packageJson.version) throw new Error('Package and manifest versions must match.');
  if (command === 'check-version') {
    let previous;
    for (const path of [manifestPath, 'public/manifest.json']) {
      try {
        previous = JSON.parse(execFileSync('git', ['show', `${value}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
        break;
      } catch {}
    }
    if (!previous) throw new Error(`Cannot find an extension manifest at ${value}.`);
    requireIncrease(manifest.version, previous.version);
  } else if (command === 'package') {
    const builtManifest = readJson('dist/extension/manifest.json');
    if (builtManifest.version !== manifest.version) throw new Error('Rebuild the extension before packaging.');
    mkdirSync('dist/artifacts', { recursive: true });
    const archive = resolve(`dist/artifacts/at-qr-reader-${manifest.version}.zip`);
    rmSync(archive, { force: true });
    execFileSync('zip', ['-r', archive, '.'], { cwd: 'dist/extension', stdio: 'inherit' });
    console.log(archive);
  } else {
    throw new Error('Use version <version>, check-version <git-ref>, or package.');
  }
}
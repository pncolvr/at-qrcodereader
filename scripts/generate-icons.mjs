import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'assets/icon.png');
const outputs = [
  ...[16, 24, 32, 48, 128].map((size) => ({ size, path: `src/extension/public/icon-${size}.png` })),
  { size: 16, path: 'src/page/favicon-16.png' },
  { size: 32, path: 'src/page/favicon-32.png' },
  // The site displays this at up to 72 CSS pixels; generate a 2x asset.
  { size: 144, path: 'src/page/icon.png' },
];

function generateIcons() {
  try {
    accessSync(source);
  } catch {
    throw new Error(`Source icon not found: ${source}`);
  }
  // ImageMagick 7 uses `magick`; version 6 uses `convert`.
  const command = ['magick', 'convert'].find((candidate) => {
    const result = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    return result.status === 0 && result.stdout.includes('ImageMagick');
  });
  if (!command) throw new Error('ImageMagick is required. Install it and make magick or convert available on PATH.');

  for (const { size, path } of outputs) {
    const destination = resolve(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    execFileSync(command, [
      source,
      '-resize', `${size}x${size}`,
      '-background', 'none',
      '-gravity', 'center',
      '-extent', `${size}x${size}`,
      '-strip',
      // Exclude timestamps so rerunning with the same image produces identical files.
      '-define', 'png:exclude-chunk=date,time',
      `PNG32:${destination}`,
    ], { stdio: 'inherit' });
    console.log(`Generated ${path} (${size}×${size})`);
  }
}

try {
  generateIcons();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

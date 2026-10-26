import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { extensionBuildDefines } from './extension-settings.mjs';

const watch = process.argv.includes('--watch');
const outdir = 'dist/extension';
const define = extensionBuildDefines();

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync('src/extension/public', outdir, { recursive: true });

const shared = { bundle: true, target: 'chrome112', sourcemap: watch, logLevel: 'info', minify: !watch, loader: { '.css': 'text' }, define };
const configs = [
  { ...shared, entryPoints: { background: 'src/extension/chrome/background.ts' }, outdir, format: 'esm' },
  { ...shared, entryPoints: { content: 'src/extension/content/content.ts' }, outdir, format: 'iife' },
  { ...shared, entryPoints: { viewer: 'src/extension/viewer/viewer.ts' }, outdir, format: 'iife' },
];

if (watch) {
  for (const config of configs) await (await context(config)).watch();
  console.log('watching… reload the extension at chrome://extensions after changes to background.js or the manifest');
} else {
  await Promise.all(configs.map((config) => build(config)));
}

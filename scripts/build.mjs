import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const shared = { bundle: true, target: 'chrome112', sourcemap: true, logLevel: 'info', minify: false, loader: { '.css': 'text' } };
const configs = [
  { ...shared, entryPoints: { background: 'src/chrome/background.ts' }, outdir: 'dist', format: 'esm' },
  { ...shared, entryPoints: { content: 'src/content/content.ts' }, outdir: 'dist', format: 'iife' },
  { ...shared, entryPoints: { viewer: 'src/viewer/viewer.ts' }, outdir: 'dist', format: 'iife' },
];

if (watch) {
  for (const c of configs) await (await context(c)).watch();
  console.log('watching… reload the extension at chrome://extensions after changes to background.js or the manifest');
} else {
  await Promise.all(configs.map((c) => build(c)));
}

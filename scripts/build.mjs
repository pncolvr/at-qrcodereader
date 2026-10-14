import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const target = process.argv.find((argument) => ['extension', 'page', 'preview'].includes(argument));
const outdir = 'dist/extension';

if (!target || target === 'page') {
  rmSync('dist/site', { recursive: true, force: true });
  mkdirSync('dist/site', { recursive: true });
  cpSync('src/page', 'dist/site', { recursive: true });
}

if (!target || target === 'extension' || target === 'preview') {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  cpSync('src/extension/public', outdir, { recursive: true });

  const shared = { bundle: true, target: 'chrome112', sourcemap: watch, logLevel: 'info', minify: !watch, loader: { '.css': 'text' } };
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
}

if (target === 'preview') {
  const previewDir = 'dist/preview';
  rmSync(previewDir, { recursive: true, force: true });
  mkdirSync(previewDir, { recursive: true });
  const fixture = readFileSync('tests/test-qr-all-fields.html', 'utf8');
  writeFileSync(`${previewDir}/index.html`, fixture.replace('</body>', '<script src="./preview.js"></script>\n</body>'));
  await build({
    entryPoints: ['test/preview.ts'],
    outfile: `${previewDir}/preview.js`,
    bundle: true,
    format: 'iife',
    target: 'chrome112',
    sourcemap: true,
    loader: { '.css': 'text' },
    logLevel: 'info',
  });
}

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const target = process.argv.find((argument) => ['extension', 'page', 'preview'].includes(argument));

if (!target || target === 'page') {
  const { buildPage } = await import('./build-page.mjs');
  buildPage();
}

if (!target || target === 'extension' || target === 'preview') {
  await import('./build-extension.mjs');
}

if (target === 'preview') {
  const { build } = await import('esbuild');
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

import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPage as build } from '../scripts/build-page.mjs';

let directory;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'at-qr-page-'));
  cpSync('src/page', join(directory, 'src/page'), { recursive: true });
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function buildPage(settings = {}) {
  build({
    sourceDir: join(directory, 'src/page'),
    outdir: join(directory, 'dist/site'),
    settings,
  });
  return readFileSync(join(directory, 'dist/site/index.html'), 'utf8');
}

describe('signup page build settings', () => {
  it('keeps the sample signup and hides installation when settings are absent or blank', () => {
    for (const settings of [{}, { GOOGLE_FORM_URL: ' ', CHROME_WEB_STORE_URL: ' ' }]) {
      const html = buildPage(settings);
      expect(html).toContain('class="signup-link" href="https://example.invalid/signup"');
      expect(html).toContain('class="install-link" href="https://example.invalid/extension" hidden');
    }
  });

  it('configures signup independently while installation stays hidden', () => {
    const html = buildPage({ GOOGLE_FORM_URL: 'https://docs.google.com/forms/d/e/test/viewform?usp=sharing&test=1' });
    expect(html).toContain('class="signup-link" href="https://docs.google.com/forms/d/e/test/viewform?usp=sharing&amp;test=1"');
    expect(html).toContain('class="install-link" href="https://example.invalid/extension" hidden');
  });

  it('enables installation independently without changing the source placeholders', () => {
    const storeUrl = 'https://chromewebstore.google.com/detail/at-qr-reader/test';
    const html = buildPage({ CHROME_WEB_STORE_URL: ` ${storeUrl} ` });
    expect(html).toContain(`class="install-link" href="${storeUrl}" target="_blank"`);
    expect(html).toContain('class="signup-link" href="https://example.invalid/signup"');
    const source = readFileSync(join(directory, 'src/page/index.html'), 'utf8');
    expect(source).toContain('class="install-link" href="https://example.invalid/extension" hidden');
    expect(source).not.toContain(storeUrl);
  });

  it('configures both links and escapes attribute characters and literal replacement text', () => {
    const html = buildPage({
      GOOGLE_FORM_URL: 'https://docs.google.com/forms/d/e/test/viewform?label="<$&>"',
      CHROME_WEB_STORE_URL: 'https://chromewebstore.google.com/detail/test/id?source=page&label="<$&>"',
    });
    expect(html).toContain('href="https://docs.google.com/forms/d/e/test/viewform?label=&quot;&lt;$&amp;&gt;&quot;"');
    expect(html).toContain('class="install-link" href="https://chromewebstore.google.com/detail/test/id?source=page&amp;label=&quot;&lt;$&amp;&gt;&quot;" target=');
  });

  it.each(['GOOGLE_FORM_URL', 'CHROME_WEB_STORE_URL'])('rejects invalid URLs for %s', (setting) => {
    for (const value of ['http://example.com', 'javascript:alert(1)', '/relative', 'not-a-url']) {
      expect(() => buildPage({ [setting]: value })).toThrow(`${setting} must be an absolute HTTPS URL.`);
    }
  });
});

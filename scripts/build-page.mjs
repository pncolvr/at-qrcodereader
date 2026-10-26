import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export function buildPage({ sourceDir = 'src/page', outdir = 'dist/site', settings = process.env } = {}) {
  let html = readFileSync(`${sourceDir}/index.html`, 'utf8');
  for (const [setting, className] of [
    ['GOOGLE_FORM_URL', 'signup-link'],
    ['CHROME_WEB_STORE_URL', 'install-link'],
  ]) {
    const value = settings[setting]?.trim();
    if (!value) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${setting} must be an absolute HTTPS URL.`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`${setting} must be an absolute HTTPS URL.`);
    }
    const escapedUrl = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const linkPattern = new RegExp(`(<a class="${className}" href=")[^"]*(")( hidden)?`);
    if (!linkPattern.test(html)) throw new Error(`Missing page link for ${setting}.`);
    html = html.replace(linkPattern, (_match, before, after) => `${before}${escapedUrl}${after}`);
  }

  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  cpSync(sourceDir, outdir, { recursive: true });
  writeFileSync(`${outdir}/index.html`, html);
}

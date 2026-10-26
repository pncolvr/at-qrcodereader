# AT QR Reader

Chrome (MV3) extension. Click the toolbar button (or press Alt+Shift+Q) on a page, drag over
the QR code right on the page, and a panel appears with the AT QR fields as a table with a Copy
button on each row.

## Build and try it

Requires Node.js 22+ and npm. Packaging requires `zip` (preinstalled on GitHub's Ubuntu runners).

```sh
npm ci
npm run build              # extension and signup page
npm run build:extension    # only dist/extension
npm run build:page         # only dist/site
```
Open `chrome://extensions`, enable Developer mode, **Load unpacked**, choose `dist/extension/`.
Works in Chromium-based browsers (Chrome, Edge, Brave...). `npm run watch` rebuilds on change
(reload the extension after changing `background.ts` or the manifest).

- After rebuilding, click the reload icon for the extension at `chrome://extensions`, then refresh the page you're testing on.
- PDFs opened from disk (`file://`) need "Allow access to file URLs" enabled on the extension.
- Pages extensions can't script (`chrome://`, the Web Store) use a fallback: a viewer tab with a frozen capture
  (you can also paste or drop an image onto it).
- If Chrome's temporary `activeTab` host permission is still propagating when the
  toolbar action fires, script injection makes up to three attempts, 50 ms apart.
  Persistent denials still open the viewer; other injection errors fall back immediately.

## Generate icons

The source artwork is `assets/icon.png`. After editing the artwork, regenerate the site
and extension icons with ImageMagick 7 (`magick`) or ImageMagick 6 (`convert`) installed:

```sh
npm run generate:icons
npm run build
```

The script uses this artwork for the 16, 24, 32, 48, and 128-pixel extension
icons, the 16 and 32-pixel site favicons, and `src/page/icon.png` at 144 pixels for the
site's 72-pixel display size. It preserves transparency and aspect ratio,
centering artwork on a square canvas. Keep the generated files in version
control; regular builds do not require ImageMagick.

## How it works
All extension source and static assets live under `src/extension/`. The independent signup site lives under `src/page/`.

1. `src/extension/chrome/background.ts` injects `content.js` into the tab (`activeTab` + `scripting`).
2. `src/extension/content/content.ts` draws a selection overlay and, once you've dragged a box, hides itself and asks the
   background worker for a capture.
3. The worker takes `captureVisibleTab`, crops the selection (CSS px to device px) and decodes it with jsQR
   (`src/extension/chrome/capture.ts`; retries at 1x, 2x, 3x, 0.5x and with inverted colours).
4. The overlay shows the result in a panel inside a closed shadow root, so page CSS can't affect it.
5. `src/extension/core/` classifies the text (AT QR / link / other) and parses it with the field table in
   `fields.ts`, taken from the AT spec (Portaria n.º 195/2020, v1.1, Oct 2020). `src/extension/ui/` renders the table.

## Signup page

Open `src/page/index.html` or `dist/site/index.html` directly in a browser. No server is required.
The page offers English and Portuguese (Portugal), initially following the browser language.
The signup link opens the configured Google Form in a new tab.
No email is sent to or stored by GitHub Pages. Google Forms collects the responses.

The site uses two build settings, both absolute HTTPS URLs when configured:

| Variable | Purpose | When unset or empty |
| --- | --- | --- |
| `GOOGLE_FORM_URL` | Google Forms newsletter signup | Leaves the nonfunctional sample signup URL |
| `CHROME_WEB_STORE_URL` | Published Chrome Web Store listing | Hides the installation button; signup remains the main action |

When `CHROME_WEB_STORE_URL` is configured, **Install extension** becomes the main
action and newsletter signup becomes secondary. Leave it empty until the listing is published.
The page describes a Windows app as a possibility being explored.

For a local build:

```sh
GOOGLE_FORM_URL='https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform' npm run build:page
```

You can also set `CHROME_WEB_STORE_URL` in the same command once the listing is available.

For GitHub Pages, add repository variables under
**Settings > Secrets and variables > Actions > Variables**:
`GOOGLE_FORM_URL` now, and `CHROME_WEB_STORE_URL` once published. After changing
either variable, run **Actions > Deploy signup page > Run workflow** on `master`.
These settings apply to `dist/site`; opening the source HTML directly uses
the sample signup URL (`https://example.invalid/signup`) and hides installation.

Before publishing, confirm the form is public, accepts responses, and contains an email field
and clear consent for updates about future versions. Match the page's no-spam/no-sale promise in the
form and your handling of the responses; do not require respondents to sign in unnecessarily.
The website does not send newsletter emails: that is a separate manual step using the form responses.

### GitHub Pages

In the repository's **Settings > Pages > Build and deployment**, select **GitHub Actions** as the source.
The `Deploy signup page` workflow deploys only `dist/site`, never the extension files.
It runs on pushes to `master` that change `src/page/**`, site build tooling,
page tests (`test/page*.test.*`), dependency files, or the workflow itself.
It runs the page tests before deploying and can also be run manually from **Actions**.
Relative asset URLs support both repository Pages URLs and a custom domain.

## Chrome Store artifact

The website link in the extension's fields panel, notices, and viewer can be
configured with the build setting `EXTENSION_WEBSITE_URL`. It defaults to
`https://pncolvr.github.io/at-qrcodereader/` when unset or blank.

```sh
EXTENSION_WEBSITE_URL='https://example.com/at-qr-reader/' npm run build:extension
```

The value must be an absolute HTTPS URL. The same setting applies to `npm run build`,
`npm run build:preview`, `npm run watch`, and `npm run package:extension`.
Restart watch mode after changing the setting.

For GitHub builds, add `EXTENSION_WEBSITE_URL` under
**Settings > Secrets and variables > Actions > Variables**, then run
**Actions > Build extension artifact > Run workflow**. The URL is embedded in the
extension bundle; changing the variable requires rebuilding and distributing an
updated extension. It does not change an already installed extension.

The `Build extension artifact` workflow starts the three-part release series at `0.3.0`.
It builds the extension, updates only `dist/extension/manifest.json`, and creates the ZIP
using the same version. The source manifest, package, and lockfile keep their committed
versions. Older four-part tags such as `v0.2.0.11` are ignored when calculating releases.

After the first release, commit messages since the highest three-part release tag
determine the next version. The largest applicable bump wins:

| Commit message | Bump | Example after `0.3.0` |
| --- | --- | --- |
| `fix: handle a QR code` | Patch | `0.3.1` |
| `feat: add a decoder` | Minor | `0.4.0` |
| `feat!: change the result format` | Major | `1.0.0` |
| Any commit with `BREAKING CHANGE: description` in its body/footer | Major | `1.0.0` |

Scopes are supported, for example `feat(extension): add a decoder` and
`fix(extension)!: change the result format`. Other commit types default to a patch bump.
Breaking changes trigger a major bump even before `1.0.0`. With squash merges, put the
intended message in the final squash commit.

To override the automatic bump, open **Actions > Build extension artifact > Run workflow**
and choose `patch`, `minor`, or `major` in **bump**. The default `auto` uses commit messages.
The first release is always `0.3.0`, regardless of this selection.

It runs on pushes to `master` that change `src/extension/**`, extension tests and
fixtures, `scripts/build-extension.mjs`, `scripts/extension-settings.mjs`, release tooling, dependency files,
TypeScript config, or its workflow. Page source, page tests (`test/page*.test.*`),
and page build tooling do not build an extension artifact. The extension build
command runs its own script directly, independently of the combined/page build
entry point. Dependency changes intentionally trigger both workflows. Manual runs
are also supported.

Each successful extension workflow publishes a GitHub Release tagged `v<version>` at
the built commit, with generated release notes and `at-qr-reader-<version>.zip`
attached. Download that ZIP directly from **Releases** and upload it in the Chrome Web
Store Developer Dashboard. The ZIP has `manifest.json` at its root. Use the newest release.
Rerunning the same workflow replaces the ZIP on the existing release. The versioned
**Actions** artifact is also retained for 30 days as a separate download.
Store listing, privacy disclosures, and review remain separate requirements; CI does not upload to the store.

Runs are serialized to avoid allocating the same version concurrently. Running the
workflow on a commit already tagged with the latest release rebuilds that version,
including manual runs; the bump selector applies when there are new commits.
The built commit must contain the latest release in its history. Each Chrome version
component must be 0-65535, with no leading zeros; the workflow validates this.

For local builds, the committed version is used:

```sh
npm run package:extension
```

The ZIP is written to `dist/artifacts/at-qr-reader-<version>.zip`. Production builds
are minified and exclude source maps; watch builds include source maps for debugging.
For local version changes, `npm run version:extension -- <version>` synchronizes the source
manifest, package, and lockfile. CI uses release tags and the workflow's **bump** selector
to calculate its version independently.

## VS Code tasks

Use **Terminal > Run Task** to build either target, package the extension, enter a manual
version, test, or typecheck. **Ctrl+Shift+B** builds both targets.

For **F5**, choose **Extension UI preview** or **Signup page** in the Run and Debug
dropdown. Each builds its target and opens it in VS Code's integrated browser.
The extension preview starts the real selection overlay on the QR test page. Drag a
selection to show a fixed sample invoice response, then drag the panel by its header.
Capture and decoding are mocked: this does not install the extension or test Chrome's
background worker, permissions, or screenshot API. Use **Load unpacked** for those checks.
The preview mock is built separately and is not included in the extension package.

The preview is also available via **Build extension preview** or `npm run build:preview`;
open `dist/preview/index.html` afterward. These local pages do not require a server.

## Tests

Run the unit tests:

```sh
npm test
```

Run a specific test file:

```sh
npm test -- test/result.test.ts
```

Check TypeScript types:

```sh
npm run typecheck
```

Run the browser regression tests (install Chromium once first):

```sh
npx playwright install chromium
npm run test:browser
```

These tests build and load the real extension in isolated Chromium profiles and invoke
its toolbar action. They cover first and repeated activations, focus in inputs and
iframes, Escape, the hint and results close buttons, focus restoration, pending captures, real screenshot
decoding, the built-in PDF viewer, and background worker restarts. The extension release
workflow runs them before packaging. They do not use the preview's mocked capture response.

Failed browser tests retain traces and screenshots in `test-results/`. CI uploads
that directory as the `extension-browser-test-results` artifact for 7 days.
Toolbar activation failures also include the target tab, open page URLs, and
background worker console messages in `toolbar-activation.json`. Injection failures
log the original Chrome error before opening the fallback viewer.

The unit tests parse the 7 example messages from the spec and render each as a QR code
(ECC M, 2 px per module, 2-module margin, as the spec asks) to check the decoder reads them back.

## Known limits / TODO
- Field labels are the spec's Portuguese descriptions; the UI text is English.
- Values such as `D:FT` are shown raw (the spec doesn't enumerate document types).
- Spec v1.1 is from Oct 2020; check whether AT has published a later revision.
- Browser automation covers Chromium; manual checks in installed Chrome remain useful for browser toolbar focus and native browser UI.
- The built-in PDF viewer is tested in Chromium; local PDFs still require "Allow access to file URLs" in the extension settings.

# e-Fatura QR Reader

Chrome (MV3) extension. Click the toolbar button (or press Alt+Shift+Q) on a page, drag over
the QR code right on the page, and a panel appears with the e-Fatura fields as a table with a Copy
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

## How it works
All extension source and static assets live under `src/extension/`. The independent signup site lives under `src/page/`.

1. `src/extension/chrome/background.ts` injects `content.js` into the tab (`activeTab` + `scripting`).
2. `src/extension/content/content.ts` draws a selection overlay and, once you've dragged a box, hides itself and asks the
   background worker for a capture.
3. The worker takes `captureVisibleTab`, crops the selection (CSS px to device px) and decodes it with jsQR
   (`src/extension/chrome/capture.ts`; retries at 1x, 2x, 3x, 0.5x and with inverted colours).
4. The overlay shows the result in a panel inside a closed shadow root, so page CSS can't affect it.
5. `src/extension/core/` classifies the text (e-Fatura / link / other) and parses it with the field table in
   `fields.ts`, taken from the AT spec (Portaria n.º 195/2020, v1.1, Oct 2020). `src/extension/ui/` renders the table.

## Signup page

Open `src/page/index.html` or `dist/site/index.html` directly in a browser. No server is required.
The page offers English and Portuguese (Portugal), initially following the browser language.
The signup link in `src/page/index.html` opens the supplied Google Form in a new tab.
No email is sent to or stored by GitHub Pages. Google Forms collects the responses.

Before publishing, confirm the form is public, accepts responses, and contains an email field
and clear consent for a release notification. Match the page's no-spam/no-sale promise in the
form and your handling of the responses; do not require respondents to sign in unnecessarily.
The website does not send launch emails: that is a separate manual step using the form responses.

### GitHub Pages

In the repository's **Settings > Pages > Build and deployment**, select **GitHub Actions** as the source.
The `Deploy signup page` workflow deploys only `dist/site`, never the extension files.
It runs on pushes to `main` or `master` that change `src/page/**`, site build tooling,
dependency files, or the workflow itself. It can also be run manually from **Actions**.
Relative asset URLs support both repository Pages URLs and a custom domain.

## Chrome Store artifact

The `Build extension artifact` workflow automatically sets a Chrome-compatible version
from its Actions run number: run 1 produces `0.2.0.1`, run 2 produces `0.2.0.2`, and run 65536
produces `0.2.1.0`. No manual bump is needed. The generated version updates the manifest,
package, and lockfile in the CI checkout only; no commit or write permission is needed.

It runs on pushes to `main` or `master` that change `src/extension/**`, tests, extension
build/release tooling, dependency files, TypeScript config, or its workflow. Page-only
changes do not build an extension artifact. Shared tooling or dependency changes intentionally
trigger both workflows. Manual runs are also supported.

Download the versioned artifact from **Actions**, extract the outer artifact archive,
and upload the inner `efatura-qr-reader-<version>.zip` in the Chrome Web Store Developer
Dashboard. The ZIP has `manifest.json` at its root. Upload only the newest artifact.
Store listing, privacy disclosures, and review remain separate requirements; CI does not upload to the store.

Re-running the same Actions run rebuilds the same version; start a new manual workflow
run to get a new version. The run counter belongs to this workflow: if you recreate it or
switch repositories, advance the `0.2` prefix in the workflow above all previously uploaded
versions. The source version must stay below the generated versions. Each Chrome version
component must be 0-65535, with no leading zeros; the packaging script validates this.

For local builds, the committed version is used:

```sh
npm run package:extension
```

The ZIP is written to `dist/artifacts/efatura-qr-reader-<version>.zip`. Production builds
are minified and exclude source maps; watch builds include source maps for debugging.
The manual alternative is described in workflow comments: disable the automatic step,
then use `npm run version:extension -- <version>` to synchronize the manifest, package,
and lockfile. Manual versions must exceed every version already uploaded to the store.

## VS Code tasks

Use **Terminal > Run Task** to build either target, package the extension, enter a manual
version, test, or typecheck. **Ctrl+Shift+B** builds both targets.

## Tests
`npm test` parses the 7 example messages from the spec, and renders each as a QR code (ECC M, 2 px
per module, 2-module margin, as the spec asks) to check the decoder reads them back. `npm run typecheck` for types.

## Known limits / TODO
- Field labels are the spec's Portuguese descriptions; the UI text is English.
- Values such as `D:FT` are shown raw (the spec doesn't enumerate document types).
- Spec v1.1 is from Oct 2020; check whether AT has published a later revision.
- Not yet exercised in a real browser: only the core (parse + decode) is covered by automated tests.
- The in-page overlay on Chrome's built-in PDF viewer is untested; if it doesn't appear there, that needs a closer look.

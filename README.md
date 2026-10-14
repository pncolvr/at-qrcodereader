# e-Fatura QR Reader

Chrome (MV3) extension. Click the toolbar button (or press Alt+Shift+Q) on a page, drag over
the QR code right on the page, and a panel appears with the e-Fatura fields as a table with a Copy
button on each row.

## Try it
```
npm install
npm run build        # outputs ./dist
```
Open `chrome://extensions`, enable Developer mode, **Load unpacked**, choose `dist/`.
Works in Chromium-based browsers (Chrome, Edge, Brave...). `npm run watch` rebuilds on change
(reload the extension after changing `background.ts` or the manifest).

- After rebuilding, click the reload icon for the extension at `chrome://extensions`, then refresh the page you're testing on.
- PDFs opened from disk (`file://`) need "Allow access to file URLs" enabled on the extension.
- Pages extensions can't script (`chrome://`, the Web Store) use a fallback: a viewer tab with a frozen capture
  (you can also paste or drop an image onto it).

## How it works
1. `src/chrome/background.ts` injects `content.js` into the tab (`activeTab` + `scripting`).
2. `src/content/content.ts` draws a selection overlay and, once you've dragged a box, hides itself and asks the
   background worker for a capture.
3. The worker takes `captureVisibleTab`, crops the selection (CSS px to device px) and decodes it with jsQR
   (`src/chrome/capture.ts`; retries at 1x, 2x, 3x, 0.5x and with inverted colours).
4. The overlay shows the result in a panel inside a closed shadow root, so page CSS can't affect it.
5. `src/core/` classifies the text (e-Fatura / link / other) and parses it with the field table in
   `fields.ts`, taken from the AT spec (Portaria n.º 195/2020, v1.1, Oct 2020). `src/ui/` renders the table.

## Tests
`npm test` parses the 7 example messages from the spec, and renders each as a QR code (ECC M, 2 px
per module, 2-module margin, as the spec asks) to check the decoder reads them back. `npm run typecheck` for types.

## Known limits / TODO
- Field labels are the spec's Portuguese descriptions; the UI text is English.
- Values such as `D:FT` are shown raw (the spec doesn't enumerate document types).
- Spec v1.1 is from Oct 2020; check whether AT has published a later revision.
- Not yet exercised in a real browser: only the core (parse + decode) is covered by automated tests.
- The in-page overlay on Chrome's built-in PDF viewer is untested; if it doesn't appear there, that needs a closer look.

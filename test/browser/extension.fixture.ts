import { test as base, expect, chromium, type BrowserContext, type CDPSession, type Page, type Worker } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface OverlayElement {
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
  text: string;
}

interface Extension {
  context: BrowserContext;
  page: Page;
  worker: Worker;
  action: () => Promise<void>;
  overlay: (selector: string) => Promise<OverlayElement | null>;
  click: (selector: string) => Promise<void>;
  selectQr: () => Promise<void>;
}

// A closed shadow root is intentional in production. Inspect it through DevTools
// instead of opening it or changing the extension for tests.
async function overlayRoot(session: CDPSession) {
  const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
  type DomNode = typeof root;
  const findHost = (node: DomNode): DomNode | undefined => {
    if (node.attributes?.some((value, index, attributes) => value === 'id' && attributes[index + 1] === 'at-qr-reader-host')) return node;
    for (const child of node.children ?? []) {
      const found = findHost(child);
      if (found) return found;
    }
  };
  const host = findHost(root);
  if (!host?.shadowRoots?.[0]) return null;
  const { object } = await session.send('DOM.resolveNode', { backendNodeId: host.shadowRoots[0].backendNodeId });
  return object.objectId;
}

export const test = base.extend<{ extension: Extension }>({
  extension: async ({}, use) => {
    const fixture = readFileSync(resolve('tests/test-qr-all-fields.html'), 'utf8');
    const qr = fixture.match(/src="(data:image\/png;base64,[^"]+)"/)![1];
    const server = createServer((request, response) => {
      if (request.url === '/invoice.pdf') {
        response.setHeader('Content-Type', 'application/pdf');
        response.end(readFileSync(resolve('tests/test-qr-all-fields.pdf')));
        return;
      }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (request.url === '/frame') {
        response.end('<input id="frame-input" value="Frame input"><div contenteditable="true" id="frame-editor">Frame editor</div>');
        return;
      }
      const port = (server.address() as { port: number }).port;
      response.end(`<!doctype html><html lang="en"><title>Extension keyboard fixture</title>
        <style>body { margin: 20px; min-height: 2000px; } input, textarea, iframe { display: block; margin-bottom: 15px; }
          iframe { width: 280px; height: 100px; } #qr { position: absolute; left: 360px; top: 60px; width: 340px; }</style>
        <input id="page-input" value="Main page input"><textarea id="page-textarea">Main textarea</textarea>
        <div id="page-editor" contenteditable="true">Editable content</div><div id="shadow-input"></div>
        <iframe id="same-frame" src="/frame"></iframe>
        <iframe id="cross-frame" src="http://localhost:${port}/frame"></iframe>
        <img id="qr" src="${qr}" alt="Test QR">
        <script>document.querySelector('#shadow-input').attachShadow({ mode: 'open' }).innerHTML = '<input id="nested-input">';</script>
      </html>`);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    let context: BrowserContext | undefined;
    try {
      const path = resolve('dist/extension');
      context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 900 },
        args: ['--enable-unsafe-extension-debugging', `--disable-extensions-except=${path}`, `--load-extension=${path}`],
      });
      const browserSession = await context.browser()!.newBrowserCDPSession();
      const { extensions } = await browserSession.send('Extensions.getExtensions');
      const installed = extensions.find((extension) => extension.path === path)!;
      expect(installed).toBeDefined();
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      await expect.poll(() => worker.evaluate(() => chrome.action.onClicked.hasListeners())).toBe(true);
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}/`);
      const session = await context.newCDPSession(page);
      const action = async () => {
        await page.bringToFront();
        const { targetInfos } = await browserSession.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
        const tab = targetInfos.find((target) => target.url === page.url())!;
        // Invoke the real action: activeTab permission, background worker, and
        // isolated-world script injection all run as they do on a toolbar click.
        await browserSession.send('Extensions.triggerAction', { id: installed.id, targetId: tab.targetId });
        await expect(page.locator('#at-qr-reader-host')).toHaveCount(1);
      };
      const overlay = async (selector: string): Promise<OverlayElement | null> => {
        const objectId = await overlayRoot(session);
        if (!objectId) return null;
        try {
          const { result } = await session.send('Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function(selector) {
              const element = this.querySelector(selector);
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                focused: this.activeElement === element, text: element.textContent };
            }`,
            arguments: [{ value: selector }],
            returnByValue: true,
          });
          return result.value;
        } finally {
          await session.send('Runtime.releaseObject', { objectId });
        }
      };
      const click = async (selector: string) => {
        const element = await overlay(selector);
        expect(element).not.toBeNull();
        await page.mouse.click(element!.x + element!.width / 2, element!.y + element!.height / 2);
      };
      const selectQr = async () => {
        const rect = await page.locator('#qr').boundingBox();
        await page.mouse.move(rect!.x - 3, rect!.y - 3);
        await page.mouse.down();
        await page.mouse.move(rect!.x + rect!.width + 3, rect!.y + rect!.height + 3, { steps: 8 });
        await page.mouse.up();
      };
      await use({ context, page, worker, action, overlay, click, selectQr });
    } finally {
      await context?.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
});

export { expect };

import { test, expect } from './extension.fixture';
import type { Worker } from '@playwright/test';

type CaptureState = { pending: Array<() => void>; finished: number };

async function delayCaptures(worker: Worker) {
  await worker.evaluate(() => {
    const state: CaptureState = { pending: [], finished: 0 };
    (globalThis as unknown as { captureState: CaptureState }).captureState = state;
    const capture = chrome.tabs.captureVisibleTab.bind(chrome.tabs);
    Object.defineProperty(chrome.tabs, 'captureVisibleTab', {
      value: async (windowId: number, options: chrome.extensionTypes.ImageDetails) => {
        const image = await capture(windowId, options);
        return new Promise<string>((done) => state.pending.push(() => { state.finished++; done(image); }));
      },
    });
  });
}

const pendingCaptures = (worker: Worker) => worker.evaluate(() =>
  (globalThis as unknown as { captureState: CaptureState }).captureState.pending.length);

async function releaseCapture(worker: Worker) {
  await worker.evaluate(() => (globalThis as unknown as { captureState: CaptureState }).captureState.pending.shift()!());
}

for (const target of ['body', 'input', 'textarea', 'editable', 'shadow input', 'same-origin iframe', 'cross-origin iframe']) {
  test(`Escape closes first and repeated activations with focus in ${target}`, async ({ extension }) => {
    const { page, action } = extension;
    const focus = async () => {
      if (target === 'input') await page.locator('#page-input').focus();
      if (target === 'textarea') await page.locator('#page-textarea').focus();
      if (target === 'editable') await page.locator('#page-editor').focus();
      if (target === 'shadow input') await page.locator('#nested-input').focus();
      if (target === 'same-origin iframe') await page.frameLocator('#same-frame').locator('input').focus();
      if (target === 'cross-origin iframe') await page.frameLocator('#cross-frame').locator('input').focus();
    };
    for (let activation = 0; activation < 3; activation++) {
      await focus();
      const before = await page.evaluate(() => document.activeElement?.id);
      await action();
      expect(await extension.overlay('.layer')).toMatchObject({ focused: true });
      expect(await extension.overlay('.layer button')).toBeNull();
      await page.keyboard.press('Escape');
      await expect(page.locator('#at-qr-reader-host')).toHaveCount(0);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe(before);
      if (target === 'shadow input') await expect(page.locator('#nested-input')).toBeFocused();
    }
  });
}

test('restarting selection with another action retains one overlay and Escape closes it', async ({ extension }) => {
  await extension.page.frameLocator('#cross-frame').locator('input').focus();
  await extension.action();
  await extension.action();
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(1);
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  await expect(extension.page.locator('#cross-frame')).toBeFocused();
});

test('a page keyboard handler below window cannot prevent Escape cancellation', async ({ extension }) => {
  await extension.page.evaluate(() => document.addEventListener('keydown', (event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
  }, { capture: true }));
  await extension.action();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Tab and Shift+Tab keep selection focused so Escape still closes it', async ({ extension }) => {
  await extension.page.frameLocator('#cross-frame').locator('input').focus();
  await extension.action();
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Tab']) {
    await extension.page.keyboard.press(key);
    expect(await extension.overlay('.layer')).toMatchObject({ focused: true });
  }
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  await expect(extension.page.locator('#cross-frame')).toBeFocused();
});

test('other keys do not close selection or type into the previously focused input', async ({ extension }) => {
  await extension.page.locator('#page-input').focus();
  await extension.action();
  await extension.page.keyboard.type('abc');
  await extension.page.keyboard.press('Enter');
  await expect(extension.page.locator('#page-input')).toHaveValue('Main page input');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(1);
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('opening and closing preserves scroll position and the original text selection', async ({ extension }) => {
  await extension.page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#page-input')!;
    input.focus();
    input.setSelectionRange(2, 7);
    window.scrollTo(0, 450);
  });
  await extension.action();
  expect(await extension.page.evaluate(() => scrollY)).toBe(450);
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#page-input')).toBeFocused();
  expect(await extension.page.evaluate(() => scrollY)).toBe(450);
  expect(await extension.page.locator('#page-input').evaluate((input: HTMLInputElement) =>
    [input.selectionStart, input.selectionEnd])).toEqual([2, 7]);
});

test('a removed original focus target does not prevent closing or the next activation', async ({ extension }) => {
  await extension.page.locator('#page-input').focus();
  await extension.action();
  await extension.page.locator('#page-input').evaluate((input) => input.remove());
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  await extension.action();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Escape closes during a drag without leaving a result panel', async ({ extension }) => {
  await extension.action();
  await extension.page.mouse.move(100, 500);
  await extension.page.mouse.down();
  await extension.page.mouse.move(250, 650);
  await extension.page.keyboard.press('Escape');
  await extension.page.mouse.up();
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Escape still works after a selection too small to capture', async ({ extension }) => {
  await extension.action();
  await extension.page.mouse.click(100, 500);
  expect(await extension.overlay('.layer')).not.toBeNull();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Escape closes before the screenshot starts', async ({ extension }) => {
  await delayCaptures(extension.worker);
  await extension.action();
  await extension.selectQr();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  // Let the double animation frame + 50ms capture delay elapse before checking
  // that cancelling did not send a screenshot request or resurrect the UI.
  await extension.page.waitForTimeout(200);
  expect(await pendingCaptures(extension.worker)).toBe(0);
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Escape closes during a pending capture and its result stays dismissed', async ({ extension }) => {
  await delayCaptures(extension.worker);
  await extension.action();
  await extension.selectQr();
  await expect.poll(() => pendingCaptures(extension.worker)).toBe(1);
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  await releaseCapture(extension.worker);
  await extension.page.waitForTimeout(300);
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

for (const cancelBeforeReopening of [false, true]) {
  test(`a late capture cannot replace a new selection (${cancelBeforeReopening ? 'Escape then reopen' : 'toolbar restart'})`, async ({ extension }) => {
    await delayCaptures(extension.worker);
    await extension.action();
    await extension.selectQr();
    await expect.poll(() => pendingCaptures(extension.worker)).toBe(1);
    if (cancelBeforeReopening) await extension.page.keyboard.press('Escape');
    await extension.action();
    await releaseCapture(extension.worker);
    await extension.page.waitForTimeout(300);
    expect(await extension.overlay('.layer')).toMatchObject({ focused: true });
    expect(await extension.overlay('.panel')).toBeNull();
    await extension.page.keyboard.press('Escape');
    await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  });
}

for (const closeMethod of ['Escape', 'button', 'select again']) {
  test(`a real QR capture result closes with ${closeMethod}`, async ({ extension }) => {
    await extension.page.frameLocator('#cross-frame').locator('input').focus();
    await extension.action();
    await extension.selectQr();
    await expect.poll(async () => (await extension.overlay('.panel'))?.text).toContain('FT TESTE/0042');
    expect(await extension.overlay('.panel')).toMatchObject({ focused: true });
    if (closeMethod === 'button') {
      await extension.click('.panel header .icon');
    } else {
      if (closeMethod === 'select again') {
        await extension.click('.panel header button');
        expect(await extension.overlay('.layer')).toMatchObject({ focused: true });
      }
      await extension.page.keyboard.press('Escape');
    }
    await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
    await expect(extension.page.locator('#cross-frame')).toBeFocused();
  });
}

test('a screenshot error panel also closes with Escape', async ({ extension }) => {
  await extension.worker.evaluate(() => Object.defineProperty(chrome.tabs, 'captureVisibleTab', {
    value: () => Promise.reject(new Error('Controlled screenshot failure')),
  }));
  await extension.action();
  await extension.selectQr();
  await expect.poll(async () => (await extension.overlay('.panel'))?.text).toContain('Controlled screenshot failure');
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('the action works after a cold restart of the background service worker', async ({ extension }) => {
  await extension.action();
  await extension.page.keyboard.press('Escape');
  const session = await extension.context.newCDPSession(extension.page);
  await session.send('ServiceWorker.enable');
  await session.send('ServiceWorker.stopAllWorkers');
  await session.detach();
  await extension.page.frameLocator('#cross-frame').locator('input').focus();
  await extension.action();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('closing a result panel leaves a newly focused page input alone', async ({ extension }) => {
  await extension.page.locator('#page-input').focus();
  await extension.action();
  await extension.selectQr();
  await expect.poll(async () => (await extension.overlay('.panel'))?.text).toContain('FT TESTE/0042');
  await extension.page.locator('#page-textarea').focus();
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
  await expect(extension.page.locator('#page-textarea')).toBeFocused();
});

test('the selection hint fits a narrow viewport and Escape closes selection', async ({ extension }) => {
  await extension.page.setViewportSize({ width: 375, height: 700 });
  await extension.action();
  const hint = (await extension.overlay('.hint'))!;
  expect(hint.x).toBeGreaterThanOrEqual(0);
  expect(hint.x + hint.width).toBeLessThanOrEqual(375);
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

test('Escape cancels selection over the built-in PDF viewer', async ({ extension }) => {
  await extension.page.goto(new URL('/invoice.pdf', extension.page.url()).href);
  await expect.poll(() => extension.page.frames().some((frame) =>
    /^chrome-extension:\/\/[^/]+\/index\.html/.test(frame.url()))).toBe(true);
  const viewer = extension.page.frames().find((frame) => /^chrome-extension:\/\/[^/]+\/index\.html/.test(frame.url()))!;
  await viewer.locator('pdf-viewer').waitFor();
  await expect.poll(() => extension.page.frames().filter((frame) => frame.url() === extension.page.url()).length).toBe(2);
  await extension.page.mouse.click(500, 400);
  await extension.action();
  expect(await extension.overlay('.layer')).toMatchObject({ focused: true });
  await extension.page.keyboard.press('Escape');
  await expect(extension.page.locator('#at-qr-reader-host')).toHaveCount(0);
});

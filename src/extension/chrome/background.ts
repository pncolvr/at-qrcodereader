// Toolbar click (or Alt+Shift+Q): inject the selection overlay into the page. The
// overlay asks us (message "capture") to screenshot the tab and decode the selected area.
// If the page can't be scripted, fall back to a viewer tab showing a frozen capture.
import { cropAndDecode, type Box } from './capture';

async function flagError(message: string) {
  console.error(message);
  await chrome.action.setBadgeBackgroundColor({ color: '#b3261e' });
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setTitle({ title: `AT QR: ${message}` });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Read AT QR code' });
  }, 4000);
}

async function openViewer(tab: chrome.tabs.Tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const key = String(Date.now());
    await chrome.storage.session.set({ [`capture:${key}`]: dataUrl });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?k=${key}`), index: tab.index + 1, openerTabId: tab.id });
  } catch (err) {
    await flagError(err instanceof Error ? err.message : 'could not capture this page');
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {
    await openViewer(tab); // e.g. a page extensions aren't allowed to script
  }
});

interface CaptureRequest { type: 'capture'; rect: Box; viewportWidth: number }

chrome.runtime.onMessage.addListener((msg: CaptureRequest, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || msg?.type !== 'capture' || !sender.tab) return;
  (async () => {
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab!.windowId, { format: 'png' });
    return { ok: true, text: await cropAndDecode(dataUrl, msg.rect, msg.viewportWidth) };
  })().then(sendResponse, (err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Could not capture this page.' }));
  return true; // keep the channel open for the async response
});

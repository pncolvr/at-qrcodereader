// Injected into the current tab on toolbar click. Draws a selection overlay, asks the
// background worker to capture + decode the selected area, and shows the fields in a
// panel on the page. Everything lives in a closed shadow root so page CSS can't interfere.
import { el, renderNotice, renderResult, resultCss } from '../ui/result';
import css from './content.css';

interface CaptureResponse { ok: boolean; text?: string | null; error?: string }

const MIN_SELECTION_PX = 8;
const GUARD = '__atQrReader';

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let layer: HTMLElement | null = null;
let panel: HTMLElement | null = null;

function teardown() {
  host?.remove();
  host = root = layer = panel = null;
  window.removeEventListener('keydown', onKey, true);
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); teardown(); }
}

function start() {
  teardown();
  host = el('div');
  host.id = 'at-qr-reader-host';
  // `all: initial` stops the page's inherited styles (font, color, ...) leaking into the shadow tree.
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  root = host.attachShadow({ mode: 'closed' });
  root.append(el('style', { textContent: resultCss + css }));
  document.documentElement.append(host);
  window.addEventListener('keydown', onKey, true);
  beginSelection();
}

// ---- selecting --------------------------------------------------------------

function beginSelection() {
  if (!root) return;
  panel?.remove();
  panel = null;
  layer?.remove();

  const box = el('div', { class: 'box' });
  box.hidden = true;
  const hint = el('div', { class: 'hint', textContent: 'Drag over the QR code · Esc to cancel' });
  const l = (layer = el('div', { class: 'layer' }, hint, box));
  root.append(l);

  let origin: { x: number; y: number } | null = null;
  let rect = { x: 0, y: 0, w: 0, h: 0 };

  l.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    l.setPointerCapture(e.pointerId);
    origin = { x: e.clientX, y: e.clientY };
    hint.hidden = true;
  });
  l.addEventListener('pointermove', (e) => {
    if (!origin) return;
    rect = { x: Math.min(origin.x, e.clientX), y: Math.min(origin.y, e.clientY), w: Math.abs(e.clientX - origin.x), h: Math.abs(e.clientY - origin.y) };
    Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    box.hidden = false;
    l.classList.add('dragging');
  });
  l.addEventListener('pointerup', () => {
    if (!origin) return;
    origin = null;
    if (rect.w < MIN_SELECTION_PX || rect.h < MIN_SELECTION_PX) {
      box.hidden = true;
      hint.hidden = false;
      l.classList.remove('dragging');
      return;
    }
    void readSelection(rect);
  });
}

// ---- reading ----------------------------------------------------------------

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))));

async function readSelection(rect: { x: number; y: number; w: number; h: number }) {
  if (!host) return;
  // Hide our own UI so it isn't part of the screenshot.
  host.style.visibility = 'hidden';
  await nextPaint();
  let response: CaptureResponse;
  try {
    response = await chrome.runtime.sendMessage({ type: 'capture', rect, viewportWidth: window.innerWidth });
  } catch {
    response = { ok: false, error: 'The extension was reloaded. Refresh this page and try again.' };
  }
  if (!host) return; // closed while capturing
  host.style.visibility = '';
  layer?.remove();
  layer = null;
  showPanel(response.ok
    ? renderResult(response.text ?? null)
    : renderNotice(response.error ?? 'Could not capture this page.', true));
}

// ---- result panel -----------------------------------------------------------

function showPanel(content: HTMLElement) {
  if (!root) return;
  panel?.remove();
  const again = el('button', { class: 'btn', type: 'button', textContent: 'Select again' });
  const close = el('button', { class: 'btn icon', type: 'button', textContent: '✕', ariaLabel: 'Close', title: 'Close (Esc)' });
  again.addEventListener('click', beginSelection);
  close.addEventListener('click', teardown);
  const header = el('header', {}, el('h2', { textContent: 'AT QR' }), again, close);
  panel = el('div', { class: 'panel', role: 'dialog', ariaLabel: 'AT QR code' },
    header,
    el('div', { class: 'body' }, content));
  const draggablePanel = panel;
  let drag: { pointerId: number; offsetX: number; offsetY: number } | null = null;
  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag || (event.target as Element).closest('button')) return;
    event.preventDefault();
    const bounds = draggablePanel.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    header.setPointerCapture(event.pointerId);
    header.classList.add('dragging');
  });
  header.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const bounds = draggablePanel.getBoundingClientRect();
    Object.assign(draggablePanel.style, {
      left: `${Math.max(0, Math.min(event.clientX - drag.offsetX, window.innerWidth - bounds.width))}px`,
      top: `${Math.max(0, Math.min(event.clientY - drag.offsetY, window.innerHeight - bounds.height))}px`,
      right: 'auto',
    });
  });
  const stopDragging = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    header.classList.remove('dragging');
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
  };
  header.addEventListener('pointerup', stopDragging);
  header.addEventListener('pointercancel', stopDragging);
  header.addEventListener('lostpointercapture', stopDragging);
  root.append(panel);
}

// Clicking the toolbar button again re-runs this script; reuse the first instance.
const w = window as unknown as Record<string, { start: () => void } | undefined>;
if (w[GUARD]) w[GUARD]!.start();
else { w[GUARD] = { start }; start(); }

// Injected into the current tab on toolbar click. Draws a selection overlay, asks the
// background worker to capture + decode the selected area, and shows the fields in a
// panel on the page. Everything lives in a closed shadow root so page CSS can't interfere.
import { el, renderNotice, renderResult, resultCss } from '../ui/result';
import css from './content.css';
import { listenForEscape } from './escape';
import { i18n } from '../i18n';

interface CaptureResponse { ok: boolean; text?: string | null; error?: string }

const MIN_SELECTION_PX = 8;
const GUARD = '__atQrReader';

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let layer: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let stopListeningForEscape: (() => void) | null = null;
let previousFocus: HTMLElement | null = null;

function teardown() {
  const restoreFocus = host && (document.activeElement === host || document.activeElement === document.body);
  host?.remove();
  host = root = layer = panel = null;
  stopListeningForEscape?.();
  stopListeningForEscape = null;
  const focusTarget = previousFocus;
  previousFocus = null;
  if (restoreFocus && focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
}

function start() {
  teardown();
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  previousFocus = focused instanceof HTMLElement ? focused : null;
  host = el('div');
  host.id = 'at-qr-reader-host';
  // `all: initial` stops the page's inherited styles (font, color, ...) leaking into the shadow tree.
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  root = host.attachShadow({ mode: 'closed' });
  root.append(el('style', { textContent: resultCss + css }));
  document.documentElement.append(host);
  stopListeningForEscape = listenForEscape(window, teardown);
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
  const hint = el('div', { class: 'hint', textContent: i18n('selectionHint') });
  hint.id = 'at-qr-selection-hint';
  const l = (layer = el('div', { class: 'layer', tabIndex: -1, role: 'dialog', ariaModal: 'true', ariaLabel: i18n('dialogLabel') }, hint, box));
  l.setAttribute('aria-describedby', hint.id);
  root.append(l);
  // Toolbar activation can leave focus inside an iframe. Its keyboard events
  // never reach our top-frame Escape listener, so move focus into the overlay.
  l.focus({ preventScroll: true });
  l.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    l.focus({ preventScroll: true });
  });

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
  const captureHost = host;
  // Hide our own UI so it isn't part of the screenshot.
  captureHost.style.visibility = 'hidden';
  await nextPaint();
  if (host !== captureHost) return; // closed or restarted before the screenshot
  let response: CaptureResponse;
  try {
    response = await chrome.runtime.sendMessage({ type: 'capture', rect, viewportWidth: window.innerWidth });
  } catch {
    response = { ok: false, error: i18n('extensionReloaded') };
  }
  if (host !== captureHost) return; // closed or restarted while capturing
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
  const again = el('button', { class: 'btn', type: 'button', textContent: i18n('selectAgain') });
  const close = el('button', { class: 'btn icon', type: 'button', textContent: '✕', ariaLabel: i18n('close'), title: i18n('closeWithEscape') });
  again.addEventListener('click', beginSelection);
  close.addEventListener('click', teardown);
  const header = el('header', {}, el('h2', { textContent: 'AT QR' }), again, close);
  panel = el('div', { class: 'panel', role: 'dialog', tabIndex: -1, ariaLabel: i18n('dialogLabel') },
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
  panel.focus({ preventScroll: true });
}

// Clicking the toolbar button again re-runs this script; reuse the first instance.
const w = window as unknown as Record<string, { start: () => void } | undefined>;
if (w[GUARD]) w[GUARD]!.start();
else { w[GUARD] = { start }; start(); }

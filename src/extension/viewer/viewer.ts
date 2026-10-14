import { cropSource } from '../core/crop';
import { decodeWithRetries } from '../core/decode';
import { el, renderResult, resultCss } from '../ui/result';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLDivElement>('stage');
const shot = $<HTMLImageElement>('shot');
const sel = $<HTMLDivElement>('sel');
const empty = $<HTMLParagraphElement>('empty');
const result = $<HTMLElement>('result');

document.head.append(el('style', { textContent: resultCss }));

const MIN_SELECTION_PX = 8;

function placeholder() {
  result.replaceChildren(el('p', { class: 'placeholder', textContent: 'Select the QR code on the capture to see its fields here.' }));
}

// ---- loading an image -------------------------------------------------------

async function loadImage(src: string) {
  shot.src = src;
  try { await shot.decode(); } catch { return showEmpty('That image could not be loaded.'); }
  empty.hidden = true;
  stage.hidden = false;
  clearSelection();
  placeholder();
}

function showEmpty(message?: string) {
  if (message) empty.textContent = message;
  empty.hidden = false;
  stage.hidden = true;
}

async function init() {
  const key = new URLSearchParams(location.search).get('k');
  if (key && typeof chrome !== 'undefined' && chrome.storage?.session) {
    const storageKey = `capture:${key}`;
    const stored = await chrome.storage.session.get(storageKey);
    await chrome.storage.session.remove(storageKey);
    const dataUrl = stored[storageKey];
    if (typeof dataUrl === 'string') return loadImage(dataUrl);
  }
  showEmpty();
}

// Paste or drop an image as an alternative to the toolbar button (handy for testing).
function loadFile(file: File | null | undefined) {
  if (file && file.type.startsWith('image/')) void loadImage(URL.createObjectURL(file));
}
document.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  loadFile(item?.getAsFile());
});
document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragover'); });
document.addEventListener('dragleave', () => document.body.classList.remove('dragover'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragover');
  loadFile(e.dataTransfer?.files[0]);
});

// ---- selecting a region -----------------------------------------------------

interface Box { x: number; y: number; w: number; h: number }
let origin: { x: number; y: number } | null = null;
let box: Box | null = null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function pointInImage(e: PointerEvent) {
  const r = shot.getBoundingClientRect();
  return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) };
}

function clearSelection() {
  origin = null;
  box = null;
  sel.hidden = true;
}

function drawSelection(b: Box) {
  Object.assign(sel.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
  sel.hidden = false;
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  stage.setPointerCapture(e.pointerId);
  origin = pointInImage(e);
  box = null;
  sel.hidden = true;
});

stage.addEventListener('pointermove', (e) => {
  if (!origin) return;
  const p = pointInImage(e);
  box = { x: Math.min(origin.x, p.x), y: Math.min(origin.y, p.y), w: Math.abs(p.x - origin.x), h: Math.abs(p.y - origin.y) };
  drawSelection(box);
});

stage.addEventListener('pointerup', () => {
  const done = box;
  origin = null;
  if (!done || done.w < MIN_SELECTION_PX || done.h < MIN_SELECTION_PX) return clearSelection();
  readSelection(done);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { clearSelection(); placeholder(); }
});

// ---- decoding the selection -------------------------------------------------

function readSelection(b: Box) {
  // Selection is in displayed pixels; the screenshot is at device resolution.
  const shown = shot.getBoundingClientRect();
  const kx = shot.naturalWidth / shown.width;
  const ky = shot.naturalHeight / shown.height;
  const sx = Math.round(b.x * kx), sy = Math.round(b.y * ky);
  const sw = Math.max(1, Math.round(b.w * kx)), sh = Math.max(1, Math.round(b.h * ky));
  const text = decodeWithRetries(cropSource(shot, sx, sy, sw, sh, document.createElement('canvas')));
  result.replaceChildren(renderResult(text));
}

void init();

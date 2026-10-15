import { classifyQr } from '../core/detect';
import { parseMessage, type ParsedField, type ParseResult } from '../core/parse';
import css from './result.css';

/** Stylesheet for everything this module renders; inject it once into the document or shadow root. */
export const resultCss: string = css;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  node.append(...kids);
  return node;
}

const wrap = (...kids: Node[]) => el('div', { class: 'atqr' }, ...kids);
const status = (message: string, warn = false) => el('p', { class: warn ? 'status warn' : 'status', textContent: message });

export function renderNotice(message: string, warn = false): HTMLElement {
  return wrap(status(message, warn));
}

/** Render the outcome of a decode attempt: `null` means no QR code was found. */
export function renderResult(text: string | null): HTMLElement {
  if (text === null) {
    return renderNotice('No QR code found in the selection. Select a tighter area around the code, or zoom the page in and try again.', true);
  }
  const kind = classifyQr(text);
  if (kind !== 'at') {
    return renderNotice(`A QR code was found, but it is not an AT QR code (${kind === 'url' ? 'it contains a link' : 'it contains plain text'}).`, true);
  }
  const parsed = parseMessage(text);
  const out = wrap(status(`AT QR code · ${parsed.fields.length} fields`));
  if (parsed.warnings.length) out.append(el('ul', { class: 'problems' }, ...parsed.warnings.map((w) => el('li', { textContent: w }))));
  out.append(buildTable(parsed));
  return out;
}

function buildTable(parsed: ParseResult) {
  const body = el('tbody');
  let currentGroup: string | undefined;
  for (const f of parsed.fields) {
    if (f.group && f.group !== currentGroup) {
      const region = parsed.regions[f.group];
      body.append(el('tr', { class: 'group' }, el('th', { colSpan: 3, scope: 'colgroup', textContent: region ? `Espaço fiscal ${region}` : 'Espaço fiscal' })));
    }
    currentGroup = f.group;
    body.append(fieldRow(f));
  }
  return el('table', {}, body);
}

function fieldRow(f: ParsedField) {
  const value = el('td', { class: 'value' }, f.value);
  for (const w of f.warnings) value.append(el('span', { class: 'note', textContent: w }));
  const btn = el('button', { type: 'button', textContent: 'Copy', ariaLabel: `Copy ${f.label}` });
  btn.addEventListener('click', () => copy(f.value, btn));
  return el('tr', {},
    el('th', { scope: 'row' }, f.label, el('span', { class: 'code', textContent: f.code })),
    value,
    el('td', { class: 'act' }, btn));
}

async function copy(value: string, btn: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Clipboard API is unavailable on non-secure pages; fall back to a temporary textarea.
    const ta = el('textarea', { value });
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn.textContent = 'Copied';
  btn.classList.add('done');
  setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1200);
}

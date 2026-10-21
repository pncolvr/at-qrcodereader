import { classifyQr } from '../core/detect';
import { FIELD_ORDER } from '../core/fields';
import { parseMessage, type ParsedField, type ParseResult } from '../core/parse';
import css from './result.css';
import { i18n } from '../i18n';

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

function improvementLink(): HTMLElement {
  return el('footer', { class: 'improvement' },
    el('p', { class: 'improvement-message', textContent: i18n('improvementMessage') }), '\n',
    el('a', {
      href: 'https://pncolvr.github.io/at-qrcodereader/',
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: i18n('improvementLink'),
      ariaLabel: i18n('improvementLinkNewTab'),
    }));
}

export function renderNotice(message: string, warn = false): HTMLElement {
  return wrap(el('div', { class: 'result-content' }, status(message, warn)), improvementLink());
}

/** Render the outcome of a decode attempt: `null` means no QR code was found. */
export function renderResult(text: string | null): HTMLElement {
  if (text === null) {
    return renderNotice(i18n('noQrFound'), true);
  }
  const kind = classifyQr(text);
  if (kind !== 'at') {
    return renderNotice(i18n('invalidQr'), true);
  }
  const parsed = parseMessage(text);
  const issues = [
    ...parsed.warnings,
    ...parsed.fields.flatMap((field) => field.warnings.map((warning) => `${field.code}: ${warning}`)),
  ];
  const content = el('div', { class: 'result-content' }, el('p', {
    class: issues.length ? 'status warn' : 'status',
  },
  el('span', { class: 'status-title', textContent: i18n(issues.length ? 'qrInvalidFieldCount' : 'qrFieldCount', String(parsed.fields.length)) }),
  validityIndicator(issues)));
  if (parsed.warnings.length) content.append(el('ul', { class: 'problems' }, ...parsed.warnings.map((w) => el('li', { textContent: translateWarning(w) }))));
  content.append(buildTable(parsed));
  return wrap(content, improvementLink());
}

function validityIndicator(issues: string[]) {
  const valid = issues.length === 0;
  const tooltip = el('span', { class: 'validity-tooltip', id: 'at-qr-validity-tooltip', role: 'tooltip' },
    el('strong', { textContent: i18n(valid ? 'formatValid' : 'formatInvalid') }),
    el('span', { textContent: i18n(valid ? 'formatNoIssues' : 'formatSeeIssues') }));
  const indicator = el('span', {
    class: valid ? 'validity is-valid' : 'validity is-invalid',
    role: 'img',
    tabIndex: 0,
    ariaLabel: valid
      ? i18n('formatValid')
      : i18n(issues.length === 1 ? 'formatInvalidAriaOne' : 'formatInvalidAriaMany', String(issues.length)),
  },
  el('span', { class: 'validity-icon', textContent: valid ? '✓' : '!' }), tooltip);
  indicator.setAttribute('aria-describedby', 'at-qr-validity-tooltip');
  return indicator;
}

function buildTable(parsed: ParseResult) {
  const body = el('tbody');
  let currentGroup: string | undefined;
  let othersSectionAdded = false;
  for (const f of parsed.fields) {
    if (!othersSectionAdded && (FIELD_ORDER.get(f.code) ?? -1) >= FIELD_ORDER.get('L')!) {
      body.append(el('tr', { class: 'group' }, el('th', { colSpan: 3, scope: 'colgroup', textContent: i18n('otherFields') })));
      othersSectionAdded = true;
    }
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
  for (const w of f.warnings) value.append(el('span', { class: 'note', textContent: translateWarning(w) }));
  const btn = el('button', { type: 'button', textContent: i18n('copy'), ariaLabel: i18n('copyField', f.label) });
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
  btn.textContent = i18n('copied');
  btn.classList.add('done');
  setTimeout(() => { btn.textContent = i18n('copy'); btn.classList.remove('done'); }, 1200);
}

function translateWarning(warning: string): string {
  let match = warning.match(/^Malformed segment "(.*)" \(expected CODE:value\)\.$/);
  if (match) return i18n('warningMalformedSegment', match[1]);
  match = warning.match(/^Longer than the maximum of (\d+) characters\.$/);
  if (match) return i18n('warningTooLong', match[1]);
  match = warning.match(/^Missing required field ([A-Z0-9]+) \((.*)\)\.$/);
  if (match) return i18n('warningMissingField', [match[1], match[2]]);

  const keys: Record<string, string> = {
    'Empty segment (stray "*").': 'warningEmptySegment',
    'Not a field defined in the specification.': 'warningUnknownField',
    'Value must not be empty.': 'warningEmptyValue',
    'Expected a number with two decimals (e.g. 12.34).': 'warningMoney',
    'Expected a date as YYYYMMDD.': 'warningDateFormat',
    'Expected a valid calendar date.': 'warningInvalidDate',
    'Out of order compared to the specification.': 'warningOrder',
    'Appears more than once.': 'warningDuplicate',
  };
  const key = keys[warning];
  return key ? i18n(key) : warning;
}

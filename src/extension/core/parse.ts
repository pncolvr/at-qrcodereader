import { FIELD_BY_CODE, FIELD_DEFS, FIELD_ORDER, vatGroupOf, type VatGroup } from './fields';

export interface ParsedField {
  code: string;
  label: string;
  value: string;
  group?: VatGroup;
  known: boolean;
  warnings: string[];
}

export interface ParseResult {
  fields: ParsedField[];
  /** Fiscal space per VAT block, taken from I1 / J1 / K1. */
  regions: Partial<Record<VatGroup, string>>;
  /** Problems with the message as a whole (missing required fields, malformed segments...). */
  warnings: string[];
}

const MONEY_RE = /^-?\d+\.\d{2}$/;
const DATE_RE = /^\d{8}$/;
const clip = (s: string) => (s.length > 24 ? s.slice(0, 24) + '…' : s);

function isValidCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Parse an AT QR message: fields joined by "*", each as "CODE:value".
 * Split on the FIRST ":" only, since values (e.g. field S) may contain ":".
 * Never throws; problems are reported as warnings so the user still sees the data.
 */
export function parseMessage(raw: string): ParseResult {
  const warnings: string[] = [];
  const fields: ParsedField[] = [];
  const regions: Partial<Record<VatGroup, string>> = {};
  const seen = new Set<string>();
  let lastOrder = -1;

  for (const segment of raw.trim().split('*')) {
    const i = segment.indexOf(':');
    if (i <= 0) {
      warnings.push(segment ? `Malformed segment "${clip(segment)}" (expected CODE:value).` : 'Empty segment (stray "*").');
      continue;
    }
    const code = segment.slice(0, i).trim();
    const value = segment.slice(i + 1).trim();
    const def = FIELD_BY_CODE.get(code);
    const fieldWarnings: string[] = [];

    if (!def) {
      fieldWarnings.push('Not a field defined in the specification.');
    } else {
      if (value.length > def.maxLen) fieldWarnings.push(`Longer than the maximum of ${def.maxLen} characters.`);
      if (!value) fieldWarnings.push('Value must not be empty.');
      if (def.kind === 'money' && !MONEY_RE.test(value)) fieldWarnings.push('Expected a number with two decimals (e.g. 12.34).');
      if (def.kind === 'date' && !DATE_RE.test(value)) fieldWarnings.push('Expected a date as YYYYMMDD.');
      else if (def.kind === 'date' && !isValidCalendarDate(value)) fieldWarnings.push('Expected a valid calendar date.');
      const order = FIELD_ORDER.get(code)!;
      if (order < lastOrder) fieldWarnings.push('Out of order compared to the specification.');
      lastOrder = Math.max(lastOrder, order);
    }
    if (seen.has(code)) fieldWarnings.push('Appears more than once.');
    seen.add(code);

    const group = vatGroupOf(code);
    if (group && code.endsWith('1')) regions[group] = value;

    fields.push({ code, label: def?.label ?? 'Campo desconhecido', value, group, known: !!def, warnings: fieldWarnings });
  }

  for (const def of FIELD_DEFS) {
    if (def.required && !seen.has(def.code)) warnings.push(`Missing required field ${def.code} (${def.label}).`);
  }
  return { fields, regions, warnings };
}

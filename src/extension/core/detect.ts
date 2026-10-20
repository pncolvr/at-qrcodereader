import { parseMessage } from './parse';

export type QrKind = 'at' | 'url' | 'text';

// Use several distinct invoice fields to recognise an AT payload. Requiring all
// mandatory fields here would hide incomplete invoices before validation runs.
const CORE_CODES = ['A', 'B', 'D', 'F', 'G', 'N', 'O'];

export function classifyQr(text: string): QrKind {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return 'url';
  const codes = new Set(parseMessage(t).fields.map((f) => f.code));
  return CORE_CODES.filter((code) => codes.has(code)).length >= 3 ? 'at' : 'text';
}

import { parseMessage } from './parse';

export type QrKind = 'at' | 'url' | 'text';

// Fields that any AT QR message must carry, however short (see spec examples 2–7).
const CORE_CODES = ['A', 'B', 'D', 'F', 'G', 'N', 'O'];

export function classifyQr(text: string): QrKind {
  const t = text.trim();
  if (/^A:[^*:]+\*B:/.test(t)) {
    const codes = new Set(parseMessage(t).fields.map((f) => f.code));
    if (CORE_CODES.every((c) => codes.has(c))) return 'at';
  }
  return /^https?:\/\//i.test(t) ? 'url' : 'text';
}

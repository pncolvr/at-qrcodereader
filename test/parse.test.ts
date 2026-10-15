import { describe, expect, it } from 'vitest';
import { parseMessage } from '../src/extension/core/parse';
import { classifyQr } from '../src/extension/core/detect';
import { EXAMPLES } from './fixtures';

describe('parseMessage', () => {
  for (const [name, msg] of Object.entries(EXAMPLES)) {
    it(`parses spec example "${name}" without warnings`, () => {
      const r = parseMessage(msg);
      expect(r.warnings).toEqual([]);
      expect(r.fields.flatMap((f) => f.warnings.map((w) => `${f.code}: ${w}`))).toEqual([]);
      expect(r.fields.every((f) => f.known)).toBe(true);
    });
  }

  it('keeps spaces inside values and splits on the first colon only', () => {
    const r = parseMessage(EXAMPLES.fatura);
    expect(r.fields.find((f) => f.code === 'G')?.value).toBe('FT AB2019/0035');
    expect(r.fields.find((f) => f.code === 'S')?.value).toBe('TB;PT00000000000000000000000;513500.58');
    expect(parseMessage('A:1*S:MB:x:y').fields[1].value).toBe('MB:x:y');
  });

  it('tracks fiscal spaces and groups VAT fields', () => {
    const r = parseMessage(EXAMPLES.fatura);
    expect(r.regions).toEqual({ I: 'PT', J: 'PT-AC', K: 'PT-MA' });
    expect(r.fields.find((f) => f.code === 'J7')?.group).toBe('J');
    expect(r.fields.find((f) => f.code === 'N')?.group).toBeUndefined();
  });

  it('trims stray spaces like the ones in the spec example 6 text', () => {
    const r = parseMessage('A:123456789*B:500000000*C:PT*D:ND*E:N*F:20190216*G: M1F KLG/6145*H: RQD8L6DG-6145*I1:PT-MA*N:26.50*O:26.50*Q:h1rB*R:9999');
    expect(r.fields.find((f) => f.code === 'G')?.value).toBe('M1F KLG/6145');
  });

  it('reports problems without throwing', () => {
    const r = parseMessage('A:12345678901*B*Z:1*N:3.5*N:4.00*');
    const all = r.fields.flatMap((f) => f.warnings).join('|') + r.warnings.join('|');
    expect(all).toMatch(/maximum of 9/);
    expect(all).toMatch(/Malformed segment "B"/);
    expect(all).toMatch(/Not a field defined/);
    expect(all).toMatch(/two decimals/);
    expect(all).toMatch(/more than once/);
    expect(all).toMatch(/Empty segment/);
    expect(all).toMatch(/Missing required field O/);
  });

  it('flags out-of-order fields', () => {
    const r = parseMessage('B:1*A:2');
    expect(r.fields[1].warnings.join()).toMatch(/Out of order/);
  });
});

describe('classifyQr', () => {
  it('recognises all spec examples as AT QR messages', () => {
    for (const msg of Object.values(EXAMPLES)) expect(classifyQr(msg)).toBe('at');
  });
  it('rejects other QR content', () => {
    expect(classifyQr('https://example.com/x')).toBe('url');
    expect(classifyQr('hello')).toBe('text');
    expect(classifyQr('A:123456789*B:999999990')).toBe('text'); // prefix alone is not enough
  });
});

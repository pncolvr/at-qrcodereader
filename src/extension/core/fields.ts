// Field table for the e-Fatura QR code.
// Source: "Especificações Técnicas – Código de Barras Bidimensional – Código QR",
// Portaria n.º 195/2020, v1.1 (Oct 2020), section 4. The order here is the order
// the fields must appear in the message.

export type FieldKind = 'text' | 'date' | 'money';

export interface FieldDef {
  code: string;
  label: string; // Portuguese description, as in the spec
  maxLen: number;
  required: boolean;
  kind: FieldKind;
}

const text = (code: string, label: string, maxLen: number, required = false): FieldDef => ({
  code, label, maxLen, required, kind: 'text',
});
const money = (code: string, label: string, required = false): FieldDef => ({
  code, label, maxLen: 16, required, kind: 'money',
});

// I, J and K are three optional VAT blocks, one per fiscal space (e.g. PT, PT-AC, PT-MA, FR).
const vatBlock = (g: 'I' | 'J' | 'K'): FieldDef[] => [
  text(`${g}1`, 'Espaço fiscal', 5, g === 'I'),
  money(`${g}2`, 'Base tributável isenta de IVA'),
  money(`${g}3`, 'Base tributável de IVA à taxa reduzida'),
  money(`${g}4`, 'Total de IVA à taxa reduzida'),
  money(`${g}5`, 'Base tributável de IVA à taxa intermédia'),
  money(`${g}6`, 'Total de IVA à taxa intermédia'),
  money(`${g}7`, 'Base tributável de IVA à taxa normal'),
  money(`${g}8`, 'Total de IVA à taxa normal'),
];

export const FIELD_DEFS: FieldDef[] = [
  text('A', 'NIF do emitente', 9, true),
  text('B', 'NIF do adquirente', 30, true),
  text('C', 'País do adquirente', 12, true),
  text('D', 'Tipo de documento', 2, true),
  text('E', 'Estado do documento', 1, true),
  { code: 'F', label: 'Data do documento', maxLen: 8, required: true, kind: 'date' },
  text('G', 'Identificação única do documento', 60, true),
  text('H', 'ATCUD', 70, true),
  ...vatBlock('I'),
  ...vatBlock('J'),
  ...vatBlock('K'),
  money('L', 'Não sujeito / não tributável em IVA / outras situações'),
  money('M', 'Imposto do Selo'),
  money('N', 'Total de impostos', true),
  money('O', 'Total do documento com impostos', true),
  money('P', 'Retenções na fonte'),
  text('Q', '4 carateres do Hash', 4, true),
  text('R', 'Nº do certificado', 4, true),
  text('S', 'Outras informações', 65),
];

export const FIELD_BY_CODE: ReadonlyMap<string, FieldDef> = new Map(FIELD_DEFS.map((d) => [d.code, d]));
export const FIELD_ORDER: ReadonlyMap<string, number> = new Map(FIELD_DEFS.map((d, i) => [d.code, i]));

export type VatGroup = 'I' | 'J' | 'K';
export const vatGroupOf = (code: string): VatGroup | undefined =>
  /^[IJK][1-8]$/.test(code) ? (code[0] as VatGroup) : undefined;

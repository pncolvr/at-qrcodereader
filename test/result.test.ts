import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES, INVALID_EXAMPLE } from './fixtures';

// Only the DOM operations used while constructing the result; no browser capture is mocked.
class Element {
  className = '';
  children: (Element | string)[] = [];
  attributes: Record<string, string> = {};
  constructor(public tag: string) {}
  set textContent(value: string) { this.children = [value]; }
  get textContent(): string { return this.children.map((child) => typeof child === 'string' ? child : child.textContent).join(''); }
  append(...children: (Element | string)[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener() {}
}

function find(root: Element, predicate: (element: Element) => boolean): Element[] {
  return [
    ...(predicate(root) ? [root] : []),
    ...root.children.flatMap((child) => typeof child === 'string' ? [] : find(child, predicate)),
  ];
}

async function render(payload: string | null, language = 'en-US') {
  vi.resetModules();
  vi.stubGlobal('navigator', { languages: [language] });
  vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
  const { renderResult } = await import('../src/extension/ui/result');
  return renderResult(payload) as unknown as Element;
}

afterEach(() => vi.unstubAllGlobals());

describe('QR results', () => {
  it('keeps every existing field and displays invalid-value and missing-field warnings', async () => {
    const result = await render(INVALID_EXAMPLE);
    expect(find(result, (node) => node.className === 'code').map((node) => node.textContent)).toEqual(['A', 'B', 'D', 'F', 'G', 'N', 'O']);
    expect(result.textContent).toContain('20260230Expected a valid calendar date.');
    expect(result.textContent).toContain('1.0Expected a number with two decimals');
    expect(result.textContent).toContain('Missing required field C (');
    expect(find(result, (node) => node.className === 'validity is-invalid')).toHaveLength(1);
  });

  it('still displays the remaining fields when a core mandatory field is missing', async () => {
    const result = await render(INVALID_EXAMPLE.replace('*O:1.00', ''));
    expect(find(result, (node) => node.tag === 'table')).toHaveLength(1);
    expect(result.textContent).toContain('FT TEST/0001');
    expect(result.textContent).toContain('Missing required field O (');
  });

  it('translates both missing-field and invalid-value warnings to Portuguese', async () => {
    const result = await render(INVALID_EXAMPLE, 'pt-PT');
    expect(result.textContent).toContain('Campo obrigatório C (');
    expect(result.textContent).toContain('em falta.');
    expect(result.textContent).toContain('A data indicada não é válida.');
    expect(result.textContent).toContain('Esperado um número com duas casas decimais');
    expect(result.textContent).not.toContain('Missing required field');
    expect(result.textContent).toContain('Estamos a trabalhar numa nova versão e numa aplicação nativa para Windows.\nQuer saber mais?\nClique aqui');
  });

  it('shows a valid invoice without warnings', async () => {
    const result = await render(EXAMPLES.simplificada);
    expect(find(result, (node) => node.tag === 'table')).toHaveLength(1);
    expect(find(result, (node) => node.className === 'validity is-valid')).toHaveLength(1);
    expect(find(result, (node) => node.className === 'problems' || node.className === 'note')).toHaveLength(0);
  });

  it.each([null, 'hello', 'https://example.com'])('shows a notice without invoice fields for %s', async (payload) => {
    const result = await render(payload);
    expect(find(result, (node) => node.tag === 'table')).toHaveLength(0);
    expect(result.textContent).not.toBe('');
  });

  it.each([EXAMPLES.simplificada, INVALID_EXAMPLE, 'hello', 'https://example.com', null])('offers the site in a new tab after the result for %s', async (payload) => {
    const result = await render(payload);
    const footer = result.children.at(-1) as Element;
    expect(footer.textContent).toBe("We're working on a new version and a native Windows app.\nWant to know more?\nClick here");
    expect(find(footer, (node) => node.tag === 'a')).toEqual([
      expect.objectContaining({
        href: 'https://pncolvr.github.io/efatura-qr/',
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    ]);
  });
});

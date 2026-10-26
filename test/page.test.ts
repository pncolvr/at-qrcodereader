import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../src/page/page.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/page/index.html', import.meta.url), 'utf8');

function openPage(navigator?: { languages?: string[]; language?: string }) {
  const inputs = {
    en: { value: 'en', checked: false, change: () => {}, addEventListener(_event: string, callback: () => void) { this.change = callback; } },
    pt: { value: 'pt', checked: true, change: () => {}, addEventListener(_event: string, callback: () => void) { this.change = callback; } },
  };
  const textElements = Array.from(html.matchAll(/data-text="([^"]+)"/g), (match) => ({
    dataset: { text: match[1] },
    textContent: '',
  }));
  const metaDescription = {
    content: '',
    setAttribute(_name: string, value: string) { this.content = value; },
  };
  const document = {
    documentElement: { lang: 'pt-PT' },
    title: '',
    querySelector(selector: string) {
      if (selector === '.wordmark') return { setAttribute() {} };
      if (selector === 'meta[name="description"]') return metaDescription;
      return selector.includes('"en"') ? inputs.en : inputs.pt;
    },
    querySelectorAll(selector: string) {
      return selector === 'input[name="language"]' ? Object.values(inputs) : textElements;
    },
  };
  runInNewContext(script, { document, navigator });
  return { document, inputs, textElements, metaDescription };
}

describe('site language selection', () => {
  it.each([
    { languages: ['en-US', 'pt-PT'], expected: 'en' },
    { languages: ['pt-PT', 'en-US'], expected: 'pt-PT' },
    { languages: ['fr-FR', 'en-US'], expected: 'en' },
    { languages: ['fr-FR'], expected: 'pt-PT' },
    { languages: [], expected: 'pt-PT' },
  ])('uses supported preferences before Portuguese for $languages', ({ languages, expected }) => {
    expect(openPage({ languages }).document.documentElement.lang).toBe(expected);
  });

  it('uses navigator.language when a preference list is unavailable', () => {
    expect(openPage({ language: 'en-GB' }).document.documentElement.lang).toBe('en');
  });

  it('uses Portuguese without browser language information', () => {
    expect(openPage().document.documentElement.lang).toBe('pt-PT');
  });

  it('lets users switch to English after falling back to Portuguese', () => {
    const { document, inputs } = openPage();
    inputs.en.change();
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('AT QR Reader | Portuguese invoices');
  });

  it('translates every page label, action, and description in both languages', () => {
    const { inputs, textElements, metaDescription } = openPage({ language: 'pt-PT' });
    const text = (key: string) => textElements.find((element) => element.dataset.text === key)?.textContent;
    expect(text('install')).toBe('Instalar extensão');
    expect(text('action')).toBe('Quero receber novidades');
    expect(text('invitation')).toContain('possibilidade de criar uma aplicação para Windows');
    expect(metaDescription.content).toBe(text('description'));
    expect(textElements.every((element) => typeof element.textContent === 'string' && element.textContent.length > 0)).toBe(true);

    inputs.en.change();
    expect(text('install')).toBe('Install extension');
    expect(text('action')).toBe('Keep me updated');
    expect(text('invitation')).toContain('possibility of creating a Windows app');
    expect(metaDescription.content).toBe(text('description'));
    expect(textElements.every((element) => typeof element.textContent === 'string' && element.textContent.length > 0)).toBe(true);

    inputs.pt.change();
    expect(text('action')).toBe('Quero receber novidades');
    expect(metaDescription.content).toBe(text('description'));
  });
});

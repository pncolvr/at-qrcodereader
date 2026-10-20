import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMessage } from '../src/extension/i18n';

afterEach(() => vi.unstubAllGlobals());

describe('extension UI language', () => {
  it.each([
    ['pt-PT', 'en-US', 'Fechar'],
    ['pt-BR', 'en-US', 'Fechar'],
    ['en-US', 'pt-PT', 'Close'],
    ['fr-FR', 'pt-PT', 'Close'],
  ])('uses browser UI language %s over preferred language %s', async (uiLanguage, preferredLanguage, expected) => {
    vi.resetModules();
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => uiLanguage } });
    vi.stubGlobal('navigator', { language: preferredLanguage, languages: [preferredLanguage] });
    const { i18n } = await import('../src/extension/i18n');
    expect(i18n('close')).toBe(expected);
  });

  it.each([
    ['pt-PT', 'en-US', 'Fechar'],
    ['en-US', 'pt-PT', 'Close'],
  ])('falls back to preferred page language %s without the Chrome i18n API', async (preferredLanguage, navigatorLanguage, expected) => {
    vi.resetModules();
    vi.stubGlobal('chrome', { runtime: {} });
    vi.stubGlobal('navigator', { language: navigatorLanguage, languages: [preferredLanguage] });
    const { i18n } = await import('../src/extension/i18n');
    expect(i18n('close')).toBe(expected);
  });

  it('falls back to English without browser APIs', async () => {
    vi.resetModules();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('navigator', undefined);
    const { i18n } = await import('../src/extension/i18n');
    expect(i18n('close')).toBe('Close');
  });

  it('substitutes Chrome numbered locale placeholders', () => {
    expect(formatMessage({
      message: 'Copy $field$',
      placeholders: { field: { content: '$1' } },
    }, 'A')).toBe('Copy A');
  });
});

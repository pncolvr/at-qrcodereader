import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMessage } from '../src/extension/i18n';

afterEach(() => vi.unstubAllGlobals());

describe('extension UI language', () => {
  it.each([
    ['pt-PT', 'en-US', 'Close'],
    ['pt-BR', 'en-US', 'Close'],
    ['en-GB', 'pt-PT', 'Fechar'],
    ['en-US', 'pt-BR', 'Fechar'],
    ['fr-FR', 'pt-PT', 'Fechar'],
    ['fr-FR', 'en-US', 'Close'],
    ['fr-FR', 'de-DE', 'Fechar'],
  ])('uses page preference when browser UI is %s and page preference is %s', async (uiLanguage, preferredLanguage, expected) => {
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

  it('falls back to Portuguese without browser APIs', async () => {
    vi.resetModules();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('navigator', undefined);
    const { i18n } = await import('../src/extension/i18n');
    expect(i18n('close')).toBe('Fechar');
  });

  it('tries supported page preferences before the final Portuguese fallback', async () => {
    vi.resetModules();
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'de-DE' } });
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'en-US'] });
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

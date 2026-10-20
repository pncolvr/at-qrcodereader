import { describe, expect, it } from 'vitest';
import { formatMessage, preferredLocale } from '../src/extension/i18n';

describe('preferred extension locale', () => {
  it('uses Portuguese when it is the first preferred language', () => {
    expect(preferredLocale(['pt-PT', 'en-US'])).toBe('pt');
  });

  it('uses English when Portuguese is not the first preferred language', () => {
    expect(preferredLocale(['en-US', 'pt-PT'])).toBe('en');
  });

  it('substitutes Chrome numbered locale placeholders', () => {
    expect(formatMessage({
      message: 'Copy $field$',
      placeholders: { field: { content: '$1' } },
    }, 'A')).toBe('Copy A');
  });
});
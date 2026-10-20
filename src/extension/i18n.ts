import enMessages from './public/_locales/en/messages.json';
import ptMessages from './public/_locales/pt_PT/messages.json';

type Message = { message: string; placeholders?: Record<string, { content: string }> };
type Catalog = Record<string, Message>;

export function formatMessage(entry: Message, substitutions: string | string[] = []): string {
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return entry.message.replace(/\$([\w]+)\$/g, (placeholder, name: string) => {
    const index = Number(entry.placeholders?.[name.toLowerCase()]?.content.match(/^\$(\d+)$/)?.[1]) - 1;
    return Number.isInteger(index) && index >= 0 ? values[index] ?? '' : placeholder;
  });
}

export function preferredLocale(languages: readonly string[]): 'en' | 'pt' {
  return languages[0]?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

const locale = preferredLocale(typeof navigator === 'undefined' ? [] : navigator.languages ?? []);
const catalog = (locale === 'pt' ? ptMessages : enMessages) as Catalog;

export function i18n(key: string, substitutions?: string | string[]): string {
  const entry = catalog[key] ?? (enMessages as Catalog)[key];
  if (!entry) return key;
  return formatMessage(entry, substitutions);
}

export function localizeDocument(root: ParentNode = document) {
  document.documentElement.lang = locale === 'pt' ? 'pt-PT' : 'en';
  document.title = i18n('viewerTitle');

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = i18n(key);
  });
  for (const attribute of ['aria-label', 'alt'] as const) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach((element) => {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      if (key) element.setAttribute(attribute, i18n(key));
    });
  }
}
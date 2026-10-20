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

// Follow the user's preferred page languages, with Portuguese as the final fallback.
// Browser UI language lookup kept for reference:
// const uiLanguage = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
//   ? chrome.i18n.getUILanguage()
//   : '';
const pageLanguages = typeof navigator === 'undefined' ? []
  : navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
const locale = pageLanguages
  .map((language) => language.toLowerCase().split(/[-_]/)[0])
  .find((language) => language === 'pt' || language === 'en') ?? 'pt';
const catalog = (locale === 'pt' ? ptMessages : enMessages) as Catalog;

export function i18n(key: string, substitutions?: string | string[]): string {
  const entry = catalog[key] ?? (ptMessages as Catalog)[key];
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

const policyTranslations = {
  pt: {
    brand: 'Leitor de códigos QR AT',
    brandLead: 'Leitor de',
    brandRest: 'códigos QR AT',
    privacyPolicy: 'Política de privacidade',
    language: 'Idioma',
    home: 'início',
    lastUpdated: 'Última atualização:',
    date: '27 de outubro de 2026',
    description: 'Política de privacidade do Leitor de códigos QR AT.',
  },
  en: {
    brand: 'AT QR Reader',
    brandLead: 'AT',
    brandRest: 'QR Reader',
    privacyPolicy: 'Privacy policy',
    language: 'Language',
    home: 'home',
    lastUpdated: 'Last updated:',
    date: '27 October 2026',
    description: 'AT QR Reader privacy policy.',
  },
};

const preferredLanguage = (navigator.languages?.length ? navigator.languages : [navigator.language ?? ''])
  .map((language) => language.toLowerCase().split(/[-_]/)[0])
  .find((language) => language === 'pt' || language === 'en') ?? 'pt';

function updatePolicyLanguage() {
  const selectedLanguage = new URLSearchParams(location.search).get('lang');
  const language = selectedLanguage === 'pt' || selectedLanguage === 'en' ? selectedLanguage : preferredLanguage;
  const copy = policyTranslations[language];
  document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  document.title = `${copy.privacyPolicy} | ${copy.brand}`;
  document.querySelector('meta[name="description"]').setAttribute('content', copy.description);
  document.querySelector('.wordmark').setAttribute('aria-label', `${copy.brand} — ${copy.home}`);
  document.querySelector('.languages').setAttribute('aria-label', copy.language);
  document.querySelectorAll('[data-policy-text]').forEach((element) => {
    element.textContent = copy[element.dataset.policyText];
  });
  document.querySelectorAll('main section').forEach((section) => {
    section.hidden = section.id !== language;
  });
  document.querySelectorAll('.languages a').forEach((link) => {
    if (new URLSearchParams(link.search).get('lang') === language) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

updatePolicyLanguage();

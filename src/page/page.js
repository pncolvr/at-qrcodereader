const translations = {
  en: {
    brand: 'AT QR Reader',
    brandLead: 'AT',
    brandRest: 'QR Reader',
    language: 'Language',
    status: 'Chrome extension',
    description: 'Read the QR codes on Portuguese invoices directly in your browser and view the details in a simple, organized way.',
    install: 'Install extension',
    title: 'We want to make the reader even better.',
    invitation: "We're exploring new features for AT QR Reader and the possibility of creating a Windows app.\n\nWe want to understand how we can make reading QR codes on Portuguese invoices even more useful.\n\nLeave your email to receive updates about future versions.",
    action: 'Keep me updated',
    privacy: "No spam. We'll never sell your email. Your data will only be used for communications you've agreed to receive.",
    provider: 'Signup opens Google Forms, where your responses are collected.',
    newTab: ' (opens in a new tab)',
    footer: 'Made for the details that matter.',
    pageTitle: 'AT QR Reader | Portuguese invoices',
  },
  pt: {
    brand: 'Leitor de códigos QR AT',
    brandLead: 'Leitor de',
    brandRest: 'códigos QR AT',
    language: 'Idioma',
    status: 'Extensão para o Chrome',
    description: 'Leia os códigos QR das faturas portuguesas diretamente no seu navegador e consulte os dados de forma simples e organizada.',
    install: 'Instalar extensão',
    title: 'Queremos tornar o leitor ainda melhor.',
    invitation: 'Estamos a explorar novas funcionalidades para o AT QR Reader e a possibilidade de criar uma aplicação para Windows.\n\nQueremos perceber como podemos tornar a leitura dos códigos QR das faturas portuguesas ainda mais útil.\n\nDeixe o seu email para receber novidades sobre futuras versões.',
    action: 'Quero receber novidades',
    privacy: 'Sem spam. Nunca venderemos o seu email. Os seus dados serão utilizados apenas para as comunicações autorizadas.',
    provider: 'A inscrição abre o Google Forms, onde são recolhidas as suas respostas.',
    newTab: ' (abre num novo separador)',
    footer: 'Feito para os detalhes que importam.',
    pageTitle: 'Leitor de códigos QR AT | Faturas portuguesas',
  },
};

function setLanguage(language) {
  const copy = translations[language];
  document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  document.title = copy.pageTitle;
  document.querySelector('meta[name="description"]').setAttribute('content', copy.description);
  document.querySelector('.wordmark').setAttribute('aria-label', `${copy.brand} ${language === 'pt' ? '— início' : 'home'}`);
  document.querySelectorAll('[data-text]').forEach((element) => {
    element.textContent = copy[element.dataset.text];
  });
  document.querySelector(`input[value="${language}"]`).checked = true;
}

document.querySelectorAll('input[name="language"]').forEach((input) => {
  input.addEventListener('change', () => setLanguage(input.value));
});

const pageLanguages = typeof navigator === 'undefined' ? []
  : navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
const initialLanguage = pageLanguages
  .map((language) => language.toLowerCase().split(/[-_]/)[0])
  .find((language) => language === 'pt' || language === 'en') ?? 'pt';
setLanguage(initialLanguage);

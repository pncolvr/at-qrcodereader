const translations = {
  en: {
    brand: 'AT QR Reader',
    brandLead: 'AT',
    brandRest: 'QR Reader',
    language: 'Language',
    status: 'Work in progress',
    description: 'A Chrome extension to read the QR code on your Portuguese invoices and make sense of the details.',
    title: 'A new version is on the way.',
    invitation: "We're preparing a new version and a native Windows app.\nOur goal is to make reading your invoice QR codes and viewing the details even easier.\nLeave your email and we'll let you know as soon as they're ready.",
    action: 'Notify me at launch',
    privacy: "No spam. We'll never sell your email. Just a notification when we release.",
    provider: 'Signup opens Google Forms. Your email is collected there, not on this website.',
    newTab: ' (opens in a new tab)',
    footer: 'Made for the details that matter.',
    pageTitle: 'AT QR Reader | Coming soon',
  },
  pt: {
    brand: 'Leitor de códigos QR AT',
    brandLead: 'Leitor de',
    brandRest: 'códigos QR AT',
    language: 'Idioma',
    status: 'Em desenvolvimento',
    description: 'Uma extensão para o Chrome que lê o código QR das suas faturas portuguesas e ajuda a compreender os detalhes.',
    title: 'Uma nova versão está a caminho.',
    invitation: 'Estamos a preparar uma nova versão e uma aplicação nativa para Windows.\nQueremos tornar a leitura dos códigos QR das suas faturas ainda mais simples e prática.\nDeixe o seu email e avisamos assim que estiverem disponíveis.',
    action: 'Avisem-me no lançamento',
    privacy: 'Sem spam. Nunca venderemos o seu email. Apenas uma notificação no lançamento.',
    provider: 'A inscrição abre o Google Forms. O seu email é recolhido lá, não neste site.',
    newTab: ' (abre num novo separador)',
    footer: 'Feito para os detalhes que importam.',
    pageTitle: 'Leitor de códigos QR AT | Em breve',
  },
};

function setLanguage(language) {
  const copy = translations[language];
  document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  document.title = copy.pageTitle;
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

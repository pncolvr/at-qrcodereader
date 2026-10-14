const translations = {
  en: {
    language: 'Language',
    status: 'Work in progress',
    description: 'A Chrome extension to read the QR code on your Portuguese invoices and make sense of the details.',
    title: "A little more time. One email when it's ready.",
    invitation: "The project is still in development. If you're interested, leave your email and we'll let you know when the full version launches.",
    action: 'Notify me at launch',
    privacy: "No spam. We'll never sell your email. Just a notification when we release.",
    provider: 'Signup opens Google Forms. Your email is collected there, not on this website.',
    newTab: ' (opens in a new tab)',
    footer: 'Made for the details that matter.',
    pageTitle: 'e-Fatura QR Reader | Coming soon',
  },
  pt: {
    language: 'Idioma',
    status: 'Em desenvolvimento',
    description: 'Uma extensão para o Chrome que lê o código QR das suas faturas portuguesas e ajuda a compreender os detalhes.',
    title: 'Mais um pouco de tempo. Um email quando estiver pronto.',
    invitation: 'O projeto ainda está em desenvolvimento. Se tiver interesse, deixe o seu email e avisamos quando a versão completa for lançada.',
    action: 'Avisem-me no lançamento',
    privacy: 'Sem spam. Nunca venderemos o seu email. Apenas uma notificação no lançamento.',
    provider: 'A inscrição abre o Google Forms. O seu email é recolhido lá, não neste site.',
    newTab: ' (abre num novo separador)',
    footer: 'Feito para os detalhes que importam.',
    pageTitle: 'e-Fatura QR Reader | Em breve',
  },
};

function setLanguage(language) {
  const copy = translations[language];
  document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  document.title = copy.pageTitle;
  document.querySelectorAll('[data-text]').forEach((element) => {
    element.textContent = copy[element.dataset.text];
  });
  document.querySelector(`input[value="${language}"]`).checked = true;
}

document.querySelectorAll('input[name="language"]').forEach((input) => {
  input.addEventListener('change', () => setLanguage(input.value));
});

setLanguage(navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en');
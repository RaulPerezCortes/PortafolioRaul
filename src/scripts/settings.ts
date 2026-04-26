type Language = 'es' | 'en';
type Theme = 'dark' | 'light';

const translations: Record<Language, Record<string, string>> = {
  es: {
    'settings.eyebrow': 'Configuracion',
    'settings.theme': 'Tema',
    'settings.dark': 'Negro',
    'settings.light': 'Blanco',
    'settings.language': 'Idioma',
    'projects.eyebrow': 'Proyectos',
    'projects.title': 'Bento de trabajos destacados.',
    'projects.items.0.title': 'Dashboard SaaS',
    'projects.items.0.description': 'Panel operativo con metricas, filtros y gestion de usuarios.',
    'projects.items.1.title': 'Ecommerce',
    'projects.items.1.description': 'Catalogo rapido con checkout y administracion de productos.',
    'projects.items.2.title': 'App de tareas',
    'projects.items.2.description': 'Flujos simples, estados claros y persistencia local.',
    'projects.items.3.title': 'Landing tecnica',
    'projects.items.3.description': 'Pagina enfocada en conversion con rendimiento alto.',
    'tech.eyebrow': 'Tecnologias',
    'tech.title': 'Stack para construir rapido.',
    'tech.copy': 'Herramientas para interfaces, APIs, datos y experiencias web modernas.',
    'contact.eyebrow': 'Contacto',
    'contact.title': 'Hablemos de tu proximo proyecto.',
    'contact.copy': 'Estoy disponible para construir interfaces, productos web y prototipos interactivos.',
    'contact.projectsButton': 'Ver proyectos',
  },
  en: {
    'settings.eyebrow': 'Settings',
    'settings.theme': 'Theme',
    'settings.dark': 'Black',
    'settings.light': 'White',
    'settings.language': 'Language',
    'projects.eyebrow': 'Projects',
    'projects.title': 'A bento of featured work.',
    'projects.items.0.title': 'SaaS dashboard',
    'projects.items.0.description': 'Operations panel with metrics, filters, and user management.',
    'projects.items.1.title': 'Ecommerce',
    'projects.items.1.description': 'Fast catalog with checkout and product administration.',
    'projects.items.2.title': 'Task app',
    'projects.items.2.description': 'Simple flows, clear states, and local persistence.',
    'projects.items.3.title': 'Technical landing',
    'projects.items.3.description': 'Conversion-focused page with high performance.',
    'tech.eyebrow': 'Technologies',
    'tech.title': 'A stack for building fast.',
    'tech.copy': 'Tools for interfaces, APIs, data, and modern web experiences.',
    'contact.eyebrow': 'Contact',
    'contact.title': 'Let us talk about your next project.',
    'contact.copy': 'I am available to build interfaces, web products, and interactive prototypes.',
    'contact.projectsButton': 'View projects',
  },
};

const root = document.documentElement;
const settingsCard = document.querySelector<HTMLElement>('[data-settings-card]');
const settingsToggle = document.querySelector<HTMLButtonElement>('[data-settings-toggle]');
const settingsClose = document.querySelector<HTMLButtonElement>('[data-settings-close]');
const themeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')];
const languageButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-language-choice]')];

const getInitialTheme = (): Theme => {
  const savedTheme = localStorage.getItem('portfolio-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const getInitialLanguage = (): Language => {
  const savedLanguage = localStorage.getItem('portfolio-language');
  if (savedLanguage === 'es' || savedLanguage === 'en') {
    return savedLanguage;
  }

  return root.lang === 'en' ? 'en' : 'es';
};

const applyTranslations = (language: Language) => {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (key && translations[language][key]) {
      node.textContent = translations[language][key];
    }
  });
};

const setTheme = (theme: Theme) => {
  root.dataset.theme = theme;
  localStorage.setItem('portfolio-theme', theme);
  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  window.dispatchEvent(new CustomEvent('studio:theme-change', { detail: theme }));
};

const setLanguage = (language: Language) => {
  root.lang = language;
  root.dataset.language = language;
  localStorage.setItem('portfolio-language', language);
  applyTranslations(language);
  languageButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.languageChoice === language));
  });
  window.dispatchEvent(new CustomEvent('studio:language-change', { detail: language }));
};

settingsToggle?.addEventListener('click', () => {
  settingsCard?.classList.toggle('is-open');
});

settingsClose?.addEventListener('click', () => {
  settingsCard?.classList.remove('is-open');
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice;
    if (theme === 'dark' || theme === 'light') {
      setTheme(theme);
    }
  });
});

languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const language = button.dataset.languageChoice;
    if (language === 'es' || language === 'en') {
      setLanguage(language);
    }
  });
});

setTheme(getInitialTheme());
setLanguage(getInitialLanguage());

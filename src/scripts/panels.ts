const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
const panelBackdrop = document.querySelector<HTMLElement>('[data-panel-backdrop]');

const openPanel = (panelName: string) => {
  document.documentElement.dataset.screenMode = panelName;

  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === panelName;
    panel.classList.toggle('is-open', isActive);
    panel.setAttribute('aria-hidden', String(!isActive));
  });

  panelBackdrop?.classList.add('is-open');
};

const closePanels = () => {
  delete document.documentElement.dataset.screenMode;

  panels.forEach((panel) => {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  });

  panelBackdrop?.classList.remove('is-open');
  window.dispatchEvent(new CustomEvent('studio:exit-screen'));
};

document.querySelectorAll<HTMLElement>('[data-close-panel]').forEach((trigger) => {
  trigger.addEventListener('click', closePanels);
});

document.querySelectorAll<HTMLElement>('[data-open-panel]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const panelName = trigger.dataset.openPanel;

    if (panelName) {
      openPanel(panelName);
    }
  });
});

panelBackdrop?.addEventListener('click', closePanels);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePanels();
  }
});

window.addEventListener('studio:open-panel', (event) => {
  const panelName = (event as CustomEvent<string>).detail;

  if (panelName) {
    openPanel(panelName);
  }
});

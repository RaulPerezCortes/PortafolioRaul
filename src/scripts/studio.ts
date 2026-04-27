import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector<HTMLCanvasElement>('#studio-canvas');

if (canvas) {
  const doorMenu = document.querySelector<HTMLElement>('[data-door-menu]');
  const doorMenuRoom = document.querySelector<HTMLButtonElement>('[data-door-menu-room]');
  const loadingScreen = document.querySelector<HTMLElement>('[data-loading-screen]');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080a0f');
  scene.fog = new THREE.Fog('#080a0f', 8, 18);

  const baseCameraFov = 81.44;
  const baseViewportAspect = 16 / 10;
  const baseCameraPosition = new THREE.Vector3(2.157, 2.229, 3.581);
  const baseCameraTarget = new THREE.Vector3(0.98, 1.384, -0.97);
  const camera = new THREE.PerspectiveCamera(baseCameraFov, 1, 0.1, 100);
  camera.position.copy(baseCameraPosition);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    precision: 'highp',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(baseCameraTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableRotate = false;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 0.82;
  controls.rotateSpeed = 0.72;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  controls.maxPolarAngle = Math.PI;
  controls.minPolarAngle = 0;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const interactive: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  const textureLoader = new THREE.TextureLoader();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const terminalKeyboard = document.createElement('input');
  const cameraGoal = baseCameraPosition.clone();
  const targetGoal = baseCameraTarget.clone();
  const defaultCamera = baseCameraPosition.clone();
  const defaultTarget = baseCameraTarget.clone();
  let isCompactViewport = false;
  let hasInitializedViewport = false;
  let hasShownFirstFrame = false;
  let hoveredObject: THREE.Object3D | null = null;
  let pendingPanel: string | null = null;
  let pendingPanelAt = 0;
  let pendingNavigationHref: string | null = null;
  let pendingNavigationAt = 0;
  let pendingDoorMenuAt = 0;
  let isEnteringScreen = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let isLookDragging = false;
  let lookDragX = 0;
  let lookDragY = 0;
  let transitionStart = 0;
  let transitionDuration = 380;
  let settingsPanelOpen = false;
  let doorMenuOpen = false;
  let doorOpenTarget = 0;
  let doorOpenAmount = 0;
  let terminalFocused = false;
  let terminalInput = '';
  let terminalRenderQueued = false;
  let lastTerminalCursorVisible = false;
  let currentTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  let currentLanguage = document.documentElement.dataset.language === 'en' || document.documentElement.lang === 'en' ? 'en' : 'es';
  const transitionFromCamera = new THREE.Vector3();
  const transitionFromTarget = new THREE.Vector3();
  const doorReturnCamera = new THREE.Vector3();
  const doorReturnTarget = new THREE.Vector3();
  let doorPivot: THREE.Group | null = null;
  const cameraRoomBounds = {
    minX: -3.72,
    maxX: 3.72,
    minY: 0.55,
    maxY: 4.18,
    minZ: -2.78,
    maxZ: 6.55,
  };
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  terminalKeyboard.className = 'terminal-keyboard-proxy';
  terminalKeyboard.type = 'text';
  terminalKeyboard.inputMode = 'text';
  terminalKeyboard.autocomplete = 'off';
  terminalKeyboard.autocapitalize = 'off';
  terminalKeyboard.spellcheck = false;
  terminalKeyboard.enterKeyHint = 'send';
  terminalKeyboard.setAttribute('aria-label', 'Entrada de la terminal');
  canvas.parentElement?.append(terminalKeyboard);

  const sharpenTexture = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  };

  const makeWallControlTexture = (
    title: string,
    subtitle: string,
    accent = '#22d3ee',
    active = false,
    icon = '',
  ) => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 512;
    textureCanvas.height = 384;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 512, 384);
      gradient.addColorStop(0, active ? accent : '#0f172a');
      gradient.addColorStop(1, active ? '#f8fafc' : '#172033');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 384);
      context.strokeStyle = active ? '#f8fafc' : accent;
      context.lineWidth = 14;
      context.strokeRect(22, 22, 468, 340);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (icon) {
        context.fillStyle = active ? '#082f49' : '#f8fafc';
        context.font = '900 118px Arial';
        context.fillText(icon, 256, 142);
        context.fillStyle = active ? '#0f172a' : accent;
        context.font = '900 42px Arial';
        context.fillText(title, 256, 278);
      } else {
        context.fillStyle = active ? '#0f172a' : accent;
        context.font = '900 34px Arial';
        context.fillText(subtitle, 256, 104);
        context.fillStyle = active ? '#082f49' : '#f8fafc';
        context.font = '900 66px Arial';
        context.fillText(title, 256, 218);
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makeRoundToolTexture = (active = false, accent = '#67e8f9') => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 512;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.clearRect(0, 0, 512, 512);
      context.fillStyle = active ? accent : '#0f172a';
      context.beginPath();
      context.arc(256, 256, 220, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = active ? '#f8fafc' : accent;
      context.lineWidth = 18;
      context.stroke();

      context.save();
      context.translate(256, 256);
      for (let i = 0; i < 8; i += 1) {
        context.rotate(Math.PI / 4);
        context.fillStyle = active ? '#0f172a' : '#f8fafc';
        context.fillRect(-22, -168, 44, 66);
      }
      context.restore();

      context.fillStyle = active ? '#0f172a' : '#f8fafc';
      context.beginPath();
      context.arc(256, 256, 104, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = active ? accent : '#0f172a';
      context.beginPath();
      context.arc(256, 256, 42, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makeSquareControlTexture = (
    title: string,
    accent = '#67e8f9',
    active = false,
    icon = '',
  ) => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 512;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.fillStyle = accent;
      context.fillRect(0, 0, 512, 512);
      context.strokeStyle = 'rgb(15 23 42 / 0.55)';
      context.lineWidth = active ? 24 : 18;
      context.strokeRect(24, 24, 464, 464);
      context.fillStyle = '#111827';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = icon ? '900 156px Arial' : '900 152px Arial';
      context.fillText(icon || title, 256, icon ? 206 : 256);
      if (icon) {
        context.font = '900 62px Arial';
        context.fillText(title, 256, 366);
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makeScreenTexture = (title: string, subtitle: string, accent = '#22d3ee') => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 1024, 512);
      gradient.addColorStop(0, '#07111f');
      gradient.addColorStop(1, '#0f2535');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1024, 512);
      context.strokeStyle = accent;
      context.lineWidth = 16;
      context.strokeRect(28, 28, 968, 456);
      context.fillStyle = accent;
      context.globalAlpha = 0.22;
      context.fillRect(60, 350, 904, 54);
      context.globalAlpha = 1;
      context.fillStyle = '#f8fafc';
      context.font = '900 104px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(title, 512, 224);
      context.fillStyle = accent;
      context.font = '800 38px Arial';
      context.fillText(subtitle, 512, 358);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const terminalCanvas = document.createElement('canvas');
  terminalCanvas.width = 2048;
  terminalCanvas.height = 1536;
  const terminalContext = terminalCanvas.getContext('2d');
  type TerminalLineType = 'prompt' | 'heading' | 'command' | 'output' | 'error' | 'success';
  type TerminalLine = {
    text: string;
    type: TerminalLineType;
    commandText?: string;
    descriptionText?: string;
  };

  const terminalCopy = {
    es: {
      title: 'LEFT-WALL TERMINAL',
      online: 'ONLINE / ESCRIBIENDO',
      idle: 'CLICK PARA ESCRIBIR',
      available: 'Comandos disponibles:',
      commands: [
        ['help', 'Lista comandos'],
        ['sobre-mi', 'Abre descripcion, curriculum y contacto'],
        ['portfolio', 'Abre experiencia, proyectos y skills'],
        ['blog', 'Abre DEV NOTES'],
        ['juego', 'Abre el easter egg'],
        ['theme dark/light', 'Cambia el tema'],
        ['lang es/en', 'Cambia el idioma'],
        ['whoami', 'Muestra una descripcion breve'],
        ['skills', 'Lista tecnologias'],
        ['clear', 'Limpia la terminal'],
      ],
      opening: (label: string) => `Abriendo ${label}...`,
      cleared: 'Terminal limpia. Escribe help para ver comandos.',
      darkTheme: 'Tema cambiado a negro.',
      lightTheme: 'Tema cambiado a blanco.',
      language: 'Idioma cambiado a espanol.',
      whoami: [
        'Desarrollador frontend orientado a interfaces limpias,',
        'experiencias interactivas y productos web con detalle visual.',
      ],
      skills: 'Stack: Astro, TypeScript, Three.js, HTML, CSS, UI/UX, Git.',
      notFound: (command: string) => `Comando no encontrado: ${command}`,
      hint: 'Escribe help para ver los comandos disponibles.',
    },
    en: {
      title: 'LEFT-WALL TERMINAL',
      online: 'ONLINE / TYPING',
      idle: 'CLICK TO TYPE',
      available: 'Available commands:',
      commands: [
        ['help', 'List commands'],
        ['about', 'Open description, resume and contact'],
        ['portfolio', 'Open experience, projects and skills'],
        ['blog', 'Open DEV NOTES'],
        ['game', 'Open the easter egg'],
        ['theme dark/light', 'Change theme'],
        ['lang es/en', 'Change language'],
        ['whoami', 'Show a short description'],
        ['skills', 'List technologies'],
        ['clear', 'Clear terminal'],
      ],
      opening: (label: string) => `Opening ${label}...`,
      cleared: 'Terminal cleared. Type help to see commands.',
      darkTheme: 'Theme changed to dark.',
      lightTheme: 'Theme changed to light.',
      language: 'Language changed to English.',
      whoami: [
        'Frontend developer focused on clean interfaces,',
        'interactive experiences and detailed web products.',
      ],
      skills: 'Stack: Astro, TypeScript, Three.js, HTML, CSS, UI/UX, Git.',
      notFound: (command: string) => `Command not found: ${command}`,
      hint: 'Type help to see the available commands.',
    },
  } as const;

  const getTerminalCopy = () => terminalCopy[currentLanguage];
  const makeHelpLines = (): TerminalLine[] => [
    { text: getTerminalCopy().available, type: 'heading' },
    ...getTerminalCopy().commands.map(([commandName, description]) => ({
      text: `  ${commandName.padEnd(16, ' ')} ${description}`,
      type: 'command' as const,
      commandText: commandName,
      descriptionText: description,
    })),
  ];
  const terminalLines: TerminalLine[] = [
    { text: 'raul@portfolio:~$ help', type: 'prompt' },
    ...makeHelpLines(),
  ];

  const terminalTexture = new THREE.CanvasTexture(terminalCanvas);
  terminalTexture.colorSpace = THREE.SRGBColorSpace;
  terminalTexture.anisotropy = maxAnisotropy;
  terminalTexture.minFilter = THREE.LinearMipmapLinearFilter;
  terminalTexture.magFilter = THREE.LinearFilter;

  const wrapTerminalLine = (
    context: CanvasRenderingContext2D,
    line: string,
    maxWidth: number,
  ) => {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const continuationIndent = indent || (line.startsWith('raul@portfolio') ? '  ' : '');
    const hardWrapWord = (word: string, prefix = '') => {
      const chunks: string[] = [];
      let current = prefix;

      [...word].forEach((character) => {
        const candidate = `${current}${character}`;
        if (current !== prefix && context.measureText(candidate).width > maxWidth) {
          chunks.push(current);
          current = `${continuationIndent}${character}`;
          return;
        }
        current = candidate;
      });

      if (current.trim()) {
        chunks.push(current);
      }

      return chunks;
    };
    const rows: string[] = [];
    const words = line.trim().split(/\s+/).filter(Boolean);
    let current = indent;

    if (!words.length) {
      return [' '];
    }

    words.forEach((word) => {
      const separator = current.trim() ? ' ' : '';
      const candidate = `${current}${separator}${word}`;

      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }

      if (current.trim()) {
        rows.push(current);
        current = `${continuationIndent}${word}`;
      } else {
        current = `${continuationIndent}${word}`;
      }

      if (context.measureText(current).width > maxWidth) {
        rows.push(...hardWrapWord(word, continuationIndent));
        current = continuationIndent;
        return;
      }
    });

    if (current.trim()) {
      rows.push(current);
    }

    return rows;
  };

  const drawHelpCommandLine = (
    context: CanvasRenderingContext2D,
    line: TerminalLine,
    x: number,
    y: number,
  ) => {
    if (!line.commandText || !line.descriptionText) {
      context.fillText(line.text, x, y);
      return;
    }

    const commandX = x + context.measureText('  ').width;
    const descriptionX = x + context.measureText(`  ${line.commandText.padEnd(16, ' ')} `).width;
    context.fillStyle = '#f59e0b';
    context.fillText(line.commandText, commandX, y);
    context.fillStyle = '#cbd5e1';
    context.fillText(line.descriptionText, descriptionX, y);
  };

  const renderTerminalTexture = () => {
    terminalRenderQueued = false;
    if (!terminalContext) {
      return;
    }

    const contentX = 150;
    const contentRight = terminalCanvas.width - 150;
    const contentWidth = contentRight - contentX;
    const bodyTop = 238;
    const lineHeight = 74;
    const maxBodyRows = 14;
    const cursorVisible = terminalFocused && Math.floor(performance.now() / 520) % 2 === 0;
    terminalContext.fillStyle = '#020617';
    terminalContext.fillRect(0, 0, terminalCanvas.width, terminalCanvas.height);

    const gradient = terminalContext.createLinearGradient(0, 0, terminalCanvas.width, terminalCanvas.height);
    gradient.addColorStop(0, 'rgb(34 211 238 / 0.16)');
    gradient.addColorStop(0.55, 'rgb(15 23 42 / 0)');
    gradient.addColorStop(1, 'rgb(245 158 11 / 0.12)');
    terminalContext.fillStyle = gradient;
    terminalContext.fillRect(0, 0, terminalCanvas.width, terminalCanvas.height);

    terminalContext.strokeStyle = terminalFocused ? '#67e8f9' : '#1f9eb5';
    terminalContext.lineWidth = 18;
    terminalContext.strokeRect(44, 44, terminalCanvas.width - 88, terminalCanvas.height - 88);
    terminalContext.fillStyle = '#07111f';
    terminalContext.fillRect(72, 72, terminalCanvas.width - 144, 98);
    terminalContext.fillStyle = '#67e8f9';
    terminalContext.font = '700 64px Consolas, monospace';
    terminalContext.textBaseline = 'top';
    terminalContext.save();
    terminalContext.beginPath();
    terminalContext.rect(contentX, 72, contentWidth, 98);
    terminalContext.clip();
    terminalContext.fillText(getTerminalCopy().title, contentX, 98);
    terminalContext.restore();
    terminalContext.fillStyle = terminalFocused ? '#f59e0b' : '#64748b';
    terminalContext.font = '700 42px Consolas, monospace';
    terminalContext.textAlign = 'right';
    terminalContext.fillText(terminalFocused ? getTerminalCopy().online : getTerminalCopy().idle, contentRight, 112);
    terminalContext.textAlign = 'left';

    terminalContext.font = '700 58px Consolas, monospace';
    const visibleLines = terminalLines
      .flatMap((line) => {
        if (line.type === 'command') {
          return [line];
        }

        return wrapTerminalLine(terminalContext, line.text, contentWidth).map((text) => ({
          text,
          type: line.type,
        }));
      })
      .slice(-maxBodyRows);
    terminalContext.save();
    terminalContext.beginPath();
    terminalContext.rect(contentX, bodyTop, contentWidth, lineHeight * maxBodyRows);
    terminalContext.clip();
    visibleLines.forEach((line, index) => {
      const y = bodyTop + index * lineHeight;
      const lineColors: Record<TerminalLineType, string> = {
        prompt: '#67e8f9',
        heading: '#f8fafc',
        command: '#f59e0b',
        output: '#cbd5e1',
        error: '#fb7185',
        success: '#34d399',
      };
      terminalContext.fillStyle = lineColors[line.type];
      if (line.type === 'command') {
        drawHelpCommandLine(terminalContext, line, contentX, y);
        return;
      }
      terminalContext.fillText(line.text, contentX, y);
    });
    terminalContext.restore();

    terminalContext.fillStyle = '#67e8f9';
    const prompt = `raul@portfolio:~$ ${terminalInput}${cursorVisible ? '_' : ''}`;
    terminalContext.save();
    terminalContext.beginPath();
    terminalContext.rect(contentX, terminalCanvas.height - 150, contentWidth, 86);
    terminalContext.clip();
    terminalContext.fillText(prompt, contentX, terminalCanvas.height - 130);
    terminalContext.restore();

    for (let y = 0; y < terminalCanvas.height; y += 10) {
      terminalContext.fillStyle = 'rgb(255 255 255 / 0.025)';
      terminalContext.fillRect(0, y, terminalCanvas.width, 1);
    }

    terminalTexture.needsUpdate = true;
  };

  const scheduleTerminalTextureRender = () => {
    if (terminalRenderQueued) {
      return;
    }

    terminalRenderQueued = true;
    requestAnimationFrame(renderTerminalTexture);
  };

  const terminalMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    map: terminalTexture,
    side: THREE.DoubleSide,
  });

  const pushTerminalLine = (text: string, type: TerminalLineType = 'output') => {
    terminalLines.push({ text, type });
    renderTerminalTexture();
  };

  const runTerminalCommand = (rawCommand: string) => {
    const command = rawCommand.trim().toLowerCase();
    const copy = getTerminalCopy();
    if (terminalLines.length && terminalLines.at(-1)?.text.trim()) {
      terminalLines.push({ text: ' ', type: 'output' });
    }
    terminalLines.push({ text: `raul@portfolio:~$ ${rawCommand}`, type: 'prompt' });

    const openRoute = (route: string, label: string) => {
      terminalLines.push({ text: copy.opening(label), type: 'success' });
      renderTerminalTexture();
      window.location.href = route;
    };

    if (!command) {
      renderTerminalTexture();
      return;
    }

    if (command === 'help') {
      terminalLines.push(...makeHelpLines());
      renderTerminalTexture();
      return;
    }

    if (command === 'clear') {
      terminalLines.splice(0, terminalLines.length, { text: copy.cleared, type: 'success' });
      renderTerminalTexture();
      return;
    }

    if (['sobre-mi', 'about', 'mi'].includes(command)) {
      openRoute('/sobre-mi', 'Sobre mi');
      return;
    }

    if (['portfolio', 'proyectos'].includes(command)) {
      openRoute('/portfolio', 'Portfolio');
      return;
    }

    if (['blog', 'dev-notes', 'notes'].includes(command)) {
      openRoute('/blog', 'DEV NOTES');
      return;
    }

    if (['juego', 'game', 'easter', 'easter-egg'].includes(command)) {
      openRoute('/easter-egg', 'Easter egg');
      return;
    }

    if (['home', 'inicio'].includes(command)) {
      openRoute('/', 'inicio');
      return;
    }

    if (command === 'theme dark' || command === 'tema negro') {
      terminalLines.push({ text: copy.darkTheme, type: 'success' });
      window.dispatchEvent(new CustomEvent('settings:set-theme', { detail: 'dark' }));
      renderTerminalTexture();
      return;
    }

    if (command === 'theme light' || command === 'tema blanco') {
      terminalLines.push({ text: copy.lightTheme, type: 'success' });
      window.dispatchEvent(new CustomEvent('settings:set-theme', { detail: 'light' }));
      renderTerminalTexture();
      return;
    }

    if (command === 'lang es' || command === 'idioma es') {
      window.dispatchEvent(new CustomEvent('settings:set-language', { detail: 'es' }));
      terminalLines.push({ text: terminalCopy.es.language, type: 'success' });
      renderTerminalTexture();
      return;
    }

    if (command === 'lang en' || command === 'idioma en') {
      window.dispatchEvent(new CustomEvent('settings:set-language', { detail: 'en' }));
      terminalLines.push({ text: terminalCopy.en.language, type: 'success' });
      renderTerminalTexture();
      return;
    }

    if (command === 'whoami') {
      copy.whoami.forEach((line) => terminalLines.push({ text: line, type: 'output' }));
      renderTerminalTexture();
      return;
    }

    if (command === 'skills') {
      terminalLines.push({ text: copy.skills, type: 'output' });
      renderTerminalTexture();
      return;
    }

    terminalLines.push({ text: copy.notFound(rawCommand), type: 'error' });
    terminalLines.push({ text: copy.hint, type: 'output' });
    renderTerminalTexture();
  };

  const syncTerminalKeyboard = () => {
    if (terminalKeyboard.value !== terminalInput) {
      terminalKeyboard.value = terminalInput;
    }
    terminalKeyboard.setSelectionRange(terminalKeyboard.value.length, terminalKeyboard.value.length);
  };

  const focusTerminal = (event?: PointerEvent) => {
    terminalFocused = true;
    syncTerminalKeyboard();
    if (event) {
      terminalKeyboard.style.left = `${event.clientX}px`;
      terminalKeyboard.style.top = `${event.clientY}px`;
    }
    terminalKeyboard.focus({ preventScroll: true });
    scheduleTerminalTextureRender();
  };

  const blurTerminal = () => {
    if (!terminalFocused) {
      return;
    }

    terminalFocused = false;
    terminalKeyboard.blur();
    scheduleTerminalTextureRender();
  };

  const submitTerminalCommand = () => {
    const command = terminalInput;
    terminalInput = '';
    syncTerminalKeyboard();
    runTerminalCommand(command);
  };

  renderTerminalTexture();

  const makeSlatWallTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const baseGradient = context.createLinearGradient(0, 0, 1024, 512);
      baseGradient.addColorStop(0, '#202832');
      baseGradient.addColorStop(0.52, '#293440');
      baseGradient.addColorStop(1, '#171d25');
      context.fillStyle = baseGradient;
      context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

      // Crear patron de paneles verticales.
      for (let x = 0; x < 1024; x += 72) {
        const slat = context.createLinearGradient(x, 0, x + 58, 0);
        slat.addColorStop(0, 'rgb(255 255 255 / 0.03)');
        slat.addColorStop(0.52, 'rgb(255 255 255 / 0.11)');
        slat.addColorStop(1, 'rgb(0 0 0 / 0.18)');
        context.fillStyle = slat;
        context.fillRect(x, 0, 58, 512);

        context.fillStyle = 'rgb(0 0 0 / 0.28)';
        context.fillRect(x + 58, 0, 8, 512);
        context.fillStyle = 'rgb(255 255 255 / 0.05)';
        context.fillRect(x + 3, 0, 2, 512);
      }

      // Sutiles juntas horizontales para romper la repeticion.
      for (let y = 0; y < 512; y += 128) {
        context.fillStyle = 'rgb(255 255 255 / 0.035)';
        context.fillRect(0, y, 1024, 2);
      }

      // Sombreado suave para profundidad.
      const vignette = context.createLinearGradient(0, 0, 0, 512);
      vignette.addColorStop(0, 'rgb(255 255 255 / 0.08)');
      vignette.addColorStop(0.58, 'rgb(255 255 255 / 0)');
      vignette.addColorStop(1, 'rgb(0 0 0 / 0.2)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, 1024, 512);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 1.05);
    return texture;
  };

  const makeParquetFloorTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.fillStyle = '#b7a58f';
      context.fillRect(0, 0, 1024, 512);

      const plankHeight = 38;
      const plankLength = 430;
      const woodColors = ['#b6a28b', '#c2af98', '#ad9a84', '#c8b9a3', '#a99682', '#d0bea6'];

      for (let y = 0; y < 512; y += plankHeight) {
        const row = Math.floor(y / plankHeight);
        const offset = (row % 4) * 108;

        context.strokeStyle = 'rgb(38 20 12 / 0.62)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(1024, y);
        context.stroke();

        for (let x = -offset - plankLength; x < 1024; x += plankLength) {
          const color = woodColors[(row + Math.floor((x + offset) / plankLength) + woodColors.length * 2) % woodColors.length];
          const plankGradient = context.createLinearGradient(x, y, x, y + plankHeight);
          plankGradient.addColorStop(0, color);
          plankGradient.addColorStop(0.5, '#d8c8ad');
          plankGradient.addColorStop(1, color);
          context.fillStyle = plankGradient;
          context.fillRect(x, y + 1, plankLength, plankHeight - 2);

          context.strokeStyle = 'rgb(38 20 12 / 0.5)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(x, y + 2);
          context.lineTo(x, y + plankHeight - 2);
          context.stroke();

          for (let grain = 0; grain < 5; grain += 1) {
            const grainY = y + 8 + grain * 6 + ((row + grain) % 3);
            context.strokeStyle = `rgb(88 68 52 / ${0.03 + ((row + grain) % 4) * 0.008})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(x + 18, grainY);
            context.bezierCurveTo(x + 120, grainY - 5, x + 260, grainY + 7, x + plankLength - 24, grainY);
            context.stroke();
          }
        }
      }

      const varnish = context.createLinearGradient(0, 0, 1024, 512);
      varnish.addColorStop(0, 'rgb(255 250 240 / 0.1)');
      varnish.addColorStop(0.58, 'rgb(255 255 255 / 0)');
      varnish.addColorStop(1, 'rgb(0 0 0 / 0.18)');
      context.fillStyle = varnish;
      context.fillRect(0, 0, 1024, 512);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.25, 3.6);
    return texture;
  };

  const makeCorkTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 768;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.fillStyle = '#b7834f';
      context.fillRect(0, 0, 768, 512);
      context.fillStyle = '#f8fafc';
      context.font = '900 54px Arial';
      context.textAlign = 'center';
      context.fillText('MIS AVENTURAS', 384, 74);
      const cards = [
        [70, 120, 130, 94, '#dbeafe'],
        [235, 118, 98, 118, '#fef3c7'],
        [372, 112, 146, 100, '#fee2e2'],
        [555, 118, 122, 132, '#dcfce7'],
        [96, 292, 118, 92, '#e0f2fe'],
        [288, 282, 130, 108, '#f8fafc'],
        [500, 292, 152, 98, '#fde68a'],
      ];
      cards.forEach(([x, y, width, height, color], index) => {
        context.save();
        context.translate(x + width / 2, y + height / 2);
        context.rotate(((index % 3) - 1) * 0.08);
        context.fillStyle = color as string;
        context.fillRect(-width / 2, -height / 2, width, height);
        context.strokeStyle = '#334155';
        context.lineWidth = 4;
        context.strokeRect(-width / 2, -height / 2, width, height);
        context.fillStyle = '#0f172a';
        context.font = '800 28px Arial';
        context.fillText(`${index + 1}`, 0, 10);
        context.restore();
      });
      context.fillStyle = '#111827';
      context.font = '900 64px Arial';
      context.fillText('30+', 610, 214);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makePhotoTexture = (index: number) => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1536;
    textureCanvas.height = 1024;
    const context = textureCanvas.getContext('2d');
    const palettes = [
      ['#0f172a', '#22d3ee', '#f8fafc'],
      ['#1f2937', '#f59e0b', '#fef3c7'],
      ['#064e3b', '#34d399', '#ecfdf5'],
      ['#3b0764', '#c084fc', '#faf5ff'],
    ];
    const palette = palettes[index % palettes.length];

    if (context) {
      context.scale(2, 2);
      const gradient = context.createLinearGradient(0, 0, 768, 512);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(1, palette[1]);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 768, 512);
      context.fillStyle = '#0f172a';
      context.fillRect(38, 38, 692, 436);
      const sky = context.createLinearGradient(0, 54, 0, 320);
      sky.addColorStop(0, palette[1]);
      sky.addColorStop(0.58, palette[0]);
      sky.addColorStop(1, '#020617');
      context.fillStyle = sky;
      context.fillRect(66, 66, 636, 338);
      context.fillStyle = 'rgb(255 255 255 / 0.8)';
      context.beginPath();
      context.arc(570, 128, 42, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#111827';
      context.beginPath();
      context.moveTo(66, 404);
      context.lineTo(246, 206);
      context.lineTo(384, 404);
      context.closePath();
      context.fill();
      context.fillStyle = '#1f2937';
      context.beginPath();
      context.moveTo(260, 404);
      context.lineTo(448, 176);
      context.lineTo(702, 404);
      context.closePath();
      context.fill();
      context.fillStyle = palette[1];
      context.globalAlpha = 0.36;
      context.fillRect(66, 332, 636, 72);
      context.globalAlpha = 1;
      context.fillStyle = palette[2];
      for (let i = 0; i < 4; i += 1) {
        context.beginPath();
        context.arc(336 + i * 32, 444, 8, 0, Math.PI * 2);
        context.fill();
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    return sharpenTexture(texture);
  };

  const makeMagazineTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 512;
    textureCanvas.height = 768;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 512, 768);
      gradient.addColorStop(0, '#111827');
      gradient.addColorStop(0.58, '#1e293b');
      gradient.addColorStop(1, '#0f172a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 768);
      context.strokeStyle = '#f59e0b';
      context.lineWidth = 18;
      context.strokeRect(26, 26, 460, 716);
      context.fillStyle = '#f8fafc';
      context.font = '900 82px Arial';
      context.textAlign = 'center';
      context.fillText('DEV', 256, 180);
      context.fillText('NOTES', 256, 270);
      context.fillStyle = '#f59e0b';
      context.font = '900 38px Arial';
      context.fillText('BLOG', 256, 350);
      context.fillStyle = '#cbd5e1';
      context.font = '700 30px Arial';
      context.fillText('Historias, ideas', 256, 458);
      context.fillText('y codigo', 256, 502);
      context.fillStyle = '#22d3ee';
      context.font = '900 46px Arial';
      context.fillText('#12', 256, 650);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const makeParkViewTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 768;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const sky = context.createLinearGradient(0, 0, 0, 420);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(0.62, '#bae6fd');
      sky.addColorStop(1, '#dcfce7');
      context.fillStyle = sky;
      context.fillRect(0, 0, 1024, 768);

      context.fillStyle = 'rgba(255, 255, 255, 0.78)';
      [
        [142, 116, 82],
        [206, 92, 58],
        [668, 98, 76],
        [730, 116, 62],
      ].forEach(([x, y, radius]) => {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.arc(x + radius * 0.72, y + 8, radius * 0.72, 0, Math.PI * 2);
        context.arc(x - radius * 0.78, y + 18, radius * 0.62, 0, Math.PI * 2);
        context.fill();
      });

      context.fillStyle = '#34d399';
      context.fillRect(0, 390, 1024, 378);
      context.fillStyle = '#22c55e';
      context.beginPath();
      context.moveTo(0, 430);
      for (let x = 0; x <= 1024; x += 64) {
        context.lineTo(x, 410 + Math.sin(x * 0.02) * 22);
      }
      context.lineTo(1024, 768);
      context.lineTo(0, 768);
      context.closePath();
      context.fill();

      const path = context.createLinearGradient(420, 360, 590, 768);
      path.addColorStop(0, '#d9c6a5');
      path.addColorStop(1, '#bca078');
      context.fillStyle = path;
      context.beginPath();
      context.moveTo(484, 382);
      context.bezierCurveTo(440, 505, 396, 620, 348, 768);
      context.lineTo(676, 768);
      context.bezierCurveTo(610, 628, 562, 506, 540, 382);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      context.lineWidth = 8;
      for (let y = 442; y < 748; y += 58) {
        context.beginPath();
        context.moveTo(420 - (y - 442) * 0.18, y);
        context.lineTo(610 + (y - 442) * 0.16, y + 8);
        context.stroke();
      }

      const drawTree = (x: number, y: number, scale: number, color: string) => {
        context.fillStyle = '#7c4a2d';
        context.fillRect(x - 10 * scale, y, 20 * scale, 130 * scale);
        context.fillStyle = color;
        [
          [0, -58, 58],
          [-36, -28, 50],
          [34, -30, 52],
          [-10, 12, 46],
          [22, 12, 42],
        ].forEach(([offsetX, offsetY, radius]) => {
          context.beginPath();
          context.arc(x + offsetX * scale, y + offsetY * scale, radius * scale, 0, Math.PI * 2);
          context.fill();
        });
      };

      drawTree(116, 368, 1.08, '#15803d');
      drawTree(286, 414, 0.78, '#16a34a');
      drawTree(792, 382, 1.02, '#15803d');
      drawTree(908, 444, 0.72, '#22c55e');

      context.fillStyle = '#fef3c7';
      context.beginPath();
      context.arc(862, 108, 46, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#14532d';
      for (let i = 0; i < 36; i += 1) {
        const x = i * 34;
        const h = 18 + Math.sin(i * 1.7) * 11;
        context.fillRect(x, 748 - h, 26, h);
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    return sharpenTexture(texture);
  };

  const makeScreenMaterial = (title: string, subtitle: string, accent = '#22d3ee') => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: accent,
    emissiveIntensity: 0.82,
    map: makeScreenTexture(title, subtitle, accent),
    roughness: 0.2,
  });

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#c2ad94', roughness: 0.7, metalness: 0.02, map: makeParquetFloorTexture() }),
    wall: new THREE.MeshStandardMaterial({ color: '#dfe9f2', roughness: 0.86, metalness: 0.02 }),
    sideWall: new THREE.MeshStandardMaterial({ color: '#dfe9f2', roughness: 0.86, metalness: 0.02 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.88 }),
    desk: new THREE.MeshStandardMaterial({ color: '#8a5438', roughness: 0.58, metalness: 0.08 }),
    deskEdge: new THREE.MeshStandardMaterial({ color: '#4a2a1d', roughness: 0.64, metalness: 0.05 }),
    deskMat: new THREE.MeshStandardMaterial({ color: '#101827', roughness: 0.72, metalness: 0.04 }),
    rug: new THREE.MeshStandardMaterial({ color: '#1f6f78', roughness: 0.94, metalness: 0.01 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2a3441', roughness: 0.35, metalness: 0.68 }),
    cable: new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.58, metalness: 0.08 }),
    dark: new THREE.MeshStandardMaterial({ color: '#050811', roughness: 0.65, metalness: 0.15 }),
    door: new THREE.MeshStandardMaterial({ color: '#6f3f28', roughness: 0.72, metalness: 0.03 }),
    doorInset: new THREE.MeshStandardMaterial({ color: '#8a5438', roughness: 0.68, metalness: 0.04 }),
    doorKnob: new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 0.65,
      roughness: 0.28,
      metalness: 0.72,
    }),
    doorVoid: new THREE.MeshStandardMaterial({
      color: '#030712',
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: 0.9,
      metalness: 0.02,
    }),
    projectsScreen: makeScreenMaterial('SOBRE MI', 'DESCRIPCION / CV / CONTACTO', '#22d3ee'),
    techScreen: makeScreenMaterial('PORTFOLIO', 'EXPERIENCIA / PROYECTOS / SKILLS', '#a855f7'),
    contactScreen: makeScreenMaterial('CONTACTO', 'ENVIAR EMAIL', '#f59e0b'),
    settingsToggle: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#67e8f9',
      emissiveIntensity: 0.82,
      map: makeRoundToolTexture(),
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
    }),
    settingsHeader: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#67e8f9',
      emissiveIntensity: 0.6,
      map: makeWallControlTexture('CONFIG', 'AJUSTES', '#67e8f9'),
      roughness: 0.28,
      metalness: 0.04,
    }),
    settingsDark: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      emissiveIntensity: 0,
      map: makeSquareControlTexture('DARK', '#3b82f6', currentTheme === 'dark', '☾'),
      roughness: 0.7,
      metalness: 0.02,
    }),
    settingsLight: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      emissiveIntensity: 0,
      map: makeSquareControlTexture('LIGHT', '#facc15', currentTheme === 'light', '☀'),
      roughness: 0.7,
      metalness: 0.02,
    }),
    settingsEs: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      emissiveIntensity: 0,
      map: makeSquareControlTexture('ES', '#22c55e', currentLanguage === 'es'),
      roughness: 0.7,
      metalness: 0.02,
    }),
    settingsEn: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      emissiveIntensity: 0,
      map: makeSquareControlTexture('EN', '#ef4444', currentLanguage === 'en'),
      roughness: 0.7,
      metalness: 0.02,
    }),
    settingsThemeLabel: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#67e8f9',
      emissiveIntensity: 0.4,
      map: makeWallControlTexture('TEMAS', '', '#67e8f9'),
      roughness: 0.38,
      metalness: 0.02,
    }),
    settingsLanguageLabel: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#67e8f9',
      emissiveIntensity: 0.4,
      map: makeWallControlTexture('IDIOMA', '', '#67e8f9'),
      roughness: 0.38,
      metalness: 0.02,
    }),
    cyanGlow: new THREE.MeshStandardMaterial({
      color: '#0f3d4d',
      emissive: '#22d3ee',
      emissiveIntensity: 1.4,
      roughness: 0.32,
      metalness: 0.1,
    }),
    greenGlow: new THREE.MeshStandardMaterial({
      color: '#0d3b1f',
      emissive: '#34d399',
      emissiveIntensity: 1.15,
      roughness: 0.4,
      metalness: 0.08,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: '#8a3f0a',
      emissive: '#f59e0b',
      emissiveIntensity: 1.8,
      roughness: 0.32,
      metalness: 0.05,
    }),
    lightModeCeiling: new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#fff7d6',
      emissiveIntensity: 0.08,
      roughness: 0.18,
      metalness: 0.02,
    }),
    paper: new THREE.MeshStandardMaterial({ color: '#f5f7fa', roughness: 0.82, metalness: 0.02 }),
    plant: new THREE.MeshStandardMaterial({ color: '#1e7e34', roughness: 0.75, metalness: 0.01 }),
    rubikWhite: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.58, metalness: 0.02 }),
    rubikYellow: new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.58, metalness: 0.02 }),
    rubikRed: new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.58, metalness: 0.02 }),
    rubikOrange: new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.58, metalness: 0.02 }),
    rubikBlue: new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.58, metalness: 0.02 }),
    rubikGreen: new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.58, metalness: 0.02 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#8dd9f5',
      emissive: '#38bdf8',
      emissiveIntensity: 0.32,
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
    }),
    cork: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, map: makeCorkTexture(), metalness: 0.01 }),
    photoFrame: new THREE.MeshBasicMaterial({ color: '#ffffff', map: makePhotoTexture(0) }),
    galleryPhoto: new THREE.MeshBasicMaterial({ color: '#ffffff', map: makePhotoTexture(1) }),
    magazine: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48, map: makeMagazineTexture(), metalness: 0.02 }),
    parkView: new THREE.MeshBasicMaterial({ color: '#ffffff', map: makeParkViewTexture() }),
    bedFrame: new THREE.MeshStandardMaterial({ color: '#5b3424', roughness: 0.7, metalness: 0.04 }),
    mattress: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.84, metalness: 0.01 }),
    blanket: new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.9, metalness: 0.01 }),
    blanketFold: new THREE.MeshStandardMaterial({ color: '#14b8a6', roughness: 0.86, metalness: 0.01 }),
    pillow: new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.92, metalness: 0.01 }),
    curtain: new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.78, metalness: 0.01 }),
    parkGrass: new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.82, metalness: 0.01 }),
    hitbox: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    hover: new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
    shelfControlHover: new THREE.MeshBasicMaterial({
      color: '#020617',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  };

  const screenCopy = {
    es: {
      projects: ['SOBRE MI', 'DESCRIPCION / CV / CONTACTO'],
      tech: ['PORTFOLIO', 'EXPERIENCIA / PROYECTOS / SKILLS'],
      contact: ['CONTACTO', 'ENVIAR EMAIL'],
    },
    en: {
      projects: ['ABOUT ME', 'DESCRIPTION / RESUME / CONTACT'],
      tech: ['PORTFOLIO', 'EXPERIENCE / PROJECTS / SKILLS'],
      contact: ['CONTACT', 'SEND EMAIL'],
    },
  } as const;

  const setScreenTexture = (
    material: THREE.MeshStandardMaterial,
    title: string,
    subtitle: string,
    accent: string,
  ) => {
    material.map?.dispose();
    material.map = makeScreenTexture(title, subtitle, accent);
    material.needsUpdate = true;
  };

  const setWallControlTexture = (
    material: THREE.MeshStandardMaterial,
    title: string,
    subtitle: string,
    active = false,
    icon = '',
  ) => {
    material.map?.dispose();
    material.map = makeWallControlTexture(title, subtitle, '#67e8f9', active, icon);
    material.needsUpdate = true;
  };

  const refreshSettingsTextures = () => {
    const isEnglish = currentLanguage === 'en';
    materials.settingsToggle.map?.dispose();
    materials.settingsToggle.map = makeRoundToolTexture(settingsPanelOpen);
    materials.settingsToggle.needsUpdate = true;
    setWallControlTexture(materials.settingsHeader, isEnglish ? 'SETTINGS' : 'CONFIG', isEnglish ? 'OPTIONS' : 'AJUSTES');
    materials.settingsDark.map?.dispose();
    materials.settingsDark.map = makeSquareControlTexture(isEnglish ? 'DARK' : 'NEGRO', '#3b82f6', currentTheme === 'dark', '☾');
    materials.settingsDark.needsUpdate = true;
    materials.settingsLight.map?.dispose();
    materials.settingsLight.map = makeSquareControlTexture(isEnglish ? 'LIGHT' : 'CLARO', '#facc15', currentTheme === 'light', '☀');
    materials.settingsLight.needsUpdate = true;
    materials.settingsEs.map?.dispose();
    materials.settingsEs.map = makeSquareControlTexture('ES', '#22c55e', currentLanguage === 'es');
    materials.settingsEs.needsUpdate = true;
    materials.settingsEn.map?.dispose();
    materials.settingsEn.map = makeSquareControlTexture('EN', '#ef4444', currentLanguage === 'en');
    materials.settingsEn.needsUpdate = true;
    setWallControlTexture(materials.settingsThemeLabel, isEnglish ? 'THEMES' : 'TEMAS', '');
    setWallControlTexture(materials.settingsLanguageLabel, isEnglish ? 'LANGUAGE' : 'IDIOMA', '');
  };

  const applyStudioLanguage = (language: string) => {
    currentLanguage = language === 'en' ? 'en' : 'es';
    const copy = language === 'en' ? screenCopy.en : screenCopy.es;
    setScreenTexture(materials.projectsScreen, copy.projects[0], copy.projects[1], '#22d3ee');
    setScreenTexture(materials.techScreen, copy.tech[0], copy.tech[1], '#a855f7');
    setScreenTexture(materials.contactScreen, copy.contact[0], copy.contact[1], '#f59e0b');
    terminalLines.splice(0, terminalLines.length, { text: 'raul@portfolio:~$ help', type: 'prompt' }, ...makeHelpLines());
    renderTerminalTexture();
    refreshSettingsTextures();
  };

  const lightModeCeilingFixtures: THREE.Mesh[] = [];
  const lightModeCeilingLamps: THREE.PointLight[] = [];

  const applyStudioTheme = (theme: string) => {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    const isLight = theme === 'light';
    const background = isLight ? '#e4eef7' : '#050a12';
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(background, isLight ? 10 : 8.5, isLight ? 22 : 18);
    materials.ceiling.color.set(isLight ? '#f8fafc' : '#0a0f1a');
    materials.floor.color.set(isLight ? '#d0bea6' : '#8f7c66');
    const wallColor = isLight ? '#dfe9f2' : '#2b3440';
    materials.wall.color.set(wallColor);
    materials.sideWall.color.set(wallColor);
    materials.floor.roughness = isLight ? 0.68 : 0.76;
    materials.wall.roughness = isLight ? 0.86 : 0.9;
    materials.sideWall.roughness = materials.wall.roughness;
    materials.lightModeCeiling.emissiveIntensity = isLight ? 2.8 : 0.08;
    materials.lightModeCeiling.color.set(isLight ? '#ffffff' : '#d6dde5');
    lightModeCeilingFixtures.forEach((fixture) => {
      fixture.visible = true;
    });
    lightModeCeilingLamps.forEach((lamp) => {
      lamp.intensity = isLight ? 4.8 : 0;
      lamp.distance = isLight ? 5.8 : 3.5;
      lamp.decay = 1.45;
    });
    
    refreshSettingsTextures();
  };

  const makeBox = (
    name: string,
    size: THREE.Vector3Tuple,
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const makeWallPlane = (
    name: string,
    size: [number, number],
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const makeBoxInGroup = (
    group: THREE.Group,
    name: string,
    size: THREE.Vector3Tuple,
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const makeWallCircle = (
    name: string,
    radius: number,
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const makeBackWallPlane = (
    name: string,
    size: [number, number],
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const makeRearWallPlane = (
    name: string,
    size: [number, number],
    position: THREE.Vector3Tuple,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.y = Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const isVisibleInScene = (object: THREE.Object3D) => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (!current.visible) {
        return false;
      }
      current = current.parent;
    }
    return true;
  };

  const getVisibleInteractiveObjects = () => interactive.filter((object) => isVisibleInScene(object));

  const keepCameraInsideRoom = () => {
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, cameraRoomBounds.minX, cameraRoomBounds.maxX);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, cameraRoomBounds.minY, cameraRoomBounds.maxY);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, cameraRoomBounds.minZ, cameraRoomBounds.maxZ);
  };

  const room = new THREE.Group();
  scene.add(room);

  const floor = makeBox('floor', [8, 0.16, 10.8], [0, -0.08, 1.9], materials.floor);
  const ceiling = makeBox('ceiling', [8, 0.16, 10.8], [0, 4.55, 1.9], materials.ceiling);
  const backWall = makeBox('back-wall', [8, 4.65, 0.16], [0, 2.24, -3.05], materials.wall);
  const leftWall = makeBox('left-wall', [0.16, 4.65, 10.8], [-4, 2.24, 1.9], materials.wall);
  const rightWall = makeBox('right-wall', [0.16, 4.65, 10.8], [4, 2.24, 1.9], materials.wall);
  const frontLeftWall = makeBox('front-left-wall', [2.1, 4.65, 0.16], [-2.95, 2.24, 6.85], materials.wall);
  const frontRightWall = makeBox('front-right-wall', [2.1, 4.65, 0.16], [2.95, 2.24, 6.85], materials.wall);
  const frontCenterWall = makeBox('front-center-wall', [3.9, 3.6, 0.16], [0, 1.75, 6.85], materials.wall);
  const frontTopWall = makeBox('front-top-wall', [3.9, 1.05, 0.16], [0, 4.05, 6.85], materials.wall);
  [backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontCenterWall, frontTopWall].forEach((wallMesh) => {
    wallMesh.receiveShadow = true;
  });
  
  room.add(floor, ceiling, backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontCenterWall, frontTopWall);

  const doorPortal = makeBox('right-wall-door-portal', [0.035, 2.76, 1.56], [3.895, 1.46, 0.32], materials.doorVoid);
  doorPortal.castShadow = false;
  const doorFrameTop = makeBox('right-wall-door-frame-top', [0.16, 0.14, 1.68], [3.82, 2.87, 0.32], materials.metal);
  const doorFrameBack = makeBox('right-wall-door-frame-back', [0.16, 2.9, 0.12], [3.82, 1.49, -0.46], materials.metal);
  const doorFrameFront = makeBox('right-wall-door-frame-front', [0.16, 2.9, 0.12], [3.82, 1.49, 1.1], materials.metal);
  [doorFrameTop, doorFrameBack, doorFrameFront].forEach((frame) => {
    frame.castShadow = true;
    frame.receiveShadow = true;
  });

  doorPivot = new THREE.Group();
  doorPivot.name = 'right-wall-menu-door';
  doorPivot.position.set(3.82, 0.08, -0.4);
  scene.add(doorPivot);
  const doorPanel = makeBoxInGroup(doorPivot, 'right-wall-menu-door-panel', [0.1, 2.66, 1.34], [0, 1.33, 0.67], materials.door);
  const doorInsetTop = makeBoxInGroup(doorPivot, 'right-wall-menu-door-inset-top', [0.035, 0.76, 0.92], [-0.06, 1.92, 0.67], materials.doorInset);
  const doorInsetBottom = makeBoxInGroup(doorPivot, 'right-wall-menu-door-inset-bottom', [0.035, 0.86, 0.92], [-0.06, 0.82, 0.67], materials.doorInset);
  [doorPanel, doorInsetTop, doorInsetBottom].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
  });

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 18), materials.doorKnob);
  knob.name = 'right-wall-menu-door-knob';
  knob.position.set(-0.115, 1.43, 1.18);
  knob.castShadow = true;
  knob.receiveShadow = true;
  doorPivot.add(knob);
  const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 24), materials.doorKnob);
  knobStem.name = 'right-wall-menu-door-knob-stem';
  knobStem.position.set(-0.06, 1.43, 1.18);
  knobStem.rotation.z = Math.PI / 2;
  knobStem.castShadow = true;
  knobStem.receiveShadow = true;
  doorPivot.add(knobStem);
  const knobHit = makeBoxInGroup(doorPivot, 'right-wall-menu-door-knob-hitbox', [0.28, 0.46, 0.46], [-0.14, 1.43, 1.18], materials.hitbox);
  knobHit.userData.action = 'door:open-menu';
  knobHit.userData.isDoorKnob = true;
  interactive.push(knobHit);

  const terminalWall = makeWallPlane('left-wall-terminal', [8.3, 3.26], [-3.915, 2.32, 1.86], terminalMaterial);
  const terminalHover = makeWallPlane('left-wall-terminal-hover', [8.38, 3.34], [-3.912, 2.32, 1.86], materials.hover);
  const terminalHit = makeWallPlane('left-wall-terminal-hitbox', [8.52, 3.48], [-3.905, 2.32, 1.86], materials.hitbox);
  terminalHover.visible = false;
  terminalHit.userData.action = 'terminal:focus';
  terminalHit.userData.hover = terminalHover;
  interactive.push(terminalHit);
  makeBox('terminal-frame-top', [0.04, 0.08, 8.48], [-3.9, 3.99, 1.86], materials.metal);
  makeBox('terminal-frame-bottom', [0.04, 0.08, 8.48], [-3.9, 0.65, 1.86], materials.metal);
  makeBox('terminal-frame-back', [0.04, 3.34, 0.08], [-3.9, 2.32, -2.38], materials.metal);
  makeBox('terminal-frame-front', [0.04, 3.34, 0.08], [-3.9, 2.32, 6.1], materials.metal);
  terminalWall.userData.isTerminal = true;
  
  [
    [-2.15, 4.43, -1.22],
    [0, 4.43, -1.22],
    [2.15, 4.43, -1.22],
    [-2.15, 4.43, 2.72],
    [0, 4.43, 2.72],
    [2.15, 4.43, 2.72],
  ].forEach((position, index) => {
    const fixture = makeBox(
      `light-mode-ceiling-panel-${index + 1}`,
      [1.05, 0.04, 0.42],
      position as THREE.Vector3Tuple,
      materials.lightModeCeiling,
    );
    fixture.castShadow = false;
    lightModeCeilingFixtures.push(fixture);

    const lamp = new THREE.PointLight('#fff7d6', 0, 5.8);
    lamp.name = `light-mode-ceiling-lamp-${index + 1}`;
    lamp.position.set(position[0], 3.92, position[2]);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(512, 512);
    lamp.shadow.bias = -0.0012;
    scene.add(lamp);
    lightModeCeilingLamps.push(lamp);
  });

  makeBox('desk-rug', [5.35, 0.035, 2.85], [0, 0.02, -0.52], materials.rug);
  makeBox('desk-rug-front-edge', [5.15, 0.018, 0.06], [0, 0.055, 0.84], materials.cyanGlow);
  makeBox('desk-rug-back-edge', [5.15, 0.018, 0.06], [0, 0.055, -1.88], materials.cyanGlow);

  makeBox('desk-top', [4.55, 0.18, 1.7], [0, 0.94, -0.55], materials.desk);
  makeBox('desk-front-edge', [4.7, 0.12, 0.08], [0, 1.03, 0.34], materials.deskEdge);
  makeBox('desk-back-edge', [4.58, 0.1, 0.08], [0, 1.02, -1.43], materials.deskEdge);
  makeBox('desk-left-edge', [0.08, 0.1, 1.72], [-2.33, 1.02, -0.55], materials.deskEdge);
  makeBox('desk-right-edge', [0.08, 0.1, 1.72], [2.33, 1.02, -0.55], materials.deskEdge);
  makeBox('desk-left-front-leg', [0.16, 0.92, 0.16], [-2.02, 0.43, 0.12], materials.metal);
  makeBox('desk-right-front-leg', [0.16, 0.92, 0.16], [2.02, 0.43, 0.12], materials.metal);
  makeBox('desk-left-back-leg', [0.14, 0.86, 0.14], [-2.02, 0.45, -1.16], materials.metal);
  makeBox('desk-right-back-leg', [0.14, 0.86, 0.14], [2.02, 0.45, -1.16], materials.metal);
  makeBox('desk-back-cable-tray', [3.55, 0.12, 0.18], [0, 0.72, -1.22], materials.cable);
  makeBox('desk-under-led', [3.2, 0.035, 0.04], [0, 0.84, 0.27], materials.cyanGlow);

  const keyboardX = -0.36;
  const keyboardZ = -0.22;
  makeBox('keyboard-case', [1.62, 0.055, 0.52], [keyboardX, 1.075, keyboardZ], materials.dark);
  makeBox('keyboard-back-rail', [1.5, 0.05, 0.045], [keyboardX, 1.125, keyboardZ - 0.265], materials.metal);
  makeBox('keyboard-front-lip', [1.54, 0.026, 0.055], [keyboardX, 1.122, keyboardZ + 0.285], materials.deskMat);
  makeBox('keyboard-accent-strip', [1.38, 0.012, 0.024], [keyboardX, 1.153, keyboardZ - 0.205], materials.cyanGlow);

  const keyUnit = 0.074;
  const keyGap = 0.008;
  const keyHeight = 0.026;
  const keyDepth = 0.052;
  const keyLayoutOffsetX = -0.045;
  const drawKey = (
    name: string,
    units: number,
    x: number,
    z: number,
    material: THREE.Material = materials.dark,
    depth = keyDepth,
  ) => {
    const width = keyUnit * units - keyGap;
    makeBox(name, [width, keyHeight, depth], [keyboardX + keyLayoutOffsetX + x + width / 2, 1.14, keyboardZ + z], material);
    return x + width + keyGap;
  };

  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.85],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.35],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25],
  ].forEach((row, rowIndex) => {
    const rowWidths = row as number[];
    const totalWidth = rowWidths.reduce((total, units) => total + keyUnit * units, 0) - keyGap;
    let x = -totalWidth / 2;
    const z = -0.165 + rowIndex * 0.09;

    rowWidths.forEach((units, keyIndex) => {
      const isAccent = rowIndex === 0 && [0, 13].includes(keyIndex);
      x = drawKey(
        `keyboard-iso-key-${rowIndex}-${keyIndex}`,
        units,
        x,
        z,
        isAccent ? materials.cyanGlow : materials.dark,
      );
    });
  });

  makeBox('keyboard-iso-enter-vertical', [0.088, keyHeight, 0.132], [keyboardX + keyLayoutOffsetX + 0.664, 1.145, keyboardZ + 0.015], materials.dark);
  makeBox('keyboard-iso-enter-corner', [0.158, keyHeight, 0.052], [keyboardX + keyLayoutOffsetX + 0.629, 1.148, keyboardZ + 0.06], materials.cyanGlow);
  makeBox('keyboard-spacebar-highlight', [0.38, 0.012, 0.018], [keyboardX + keyLayoutOffsetX - 0.02, 1.157, keyboardZ + 0.196], materials.cyanGlow);

  makeBox('mouse-pad', [0.82, 0.018, 0.54], [1.02, 1.045, -0.22], materials.deskMat);
  makeBox('mouse-body', [0.28, 0.075, 0.38], [1.02, 1.105, -0.22], materials.dark);
  makeBox('mouse-left-button', [0.12, 0.018, 0.16], [0.955, 1.153, -0.33], materials.metal);
  makeBox('mouse-right-button', [0.12, 0.018, 0.16], [1.085, 1.153, -0.33], materials.metal);
  makeBox('mouse-scroll-wheel', [0.038, 0.026, 0.075], [1.02, 1.168, -0.33], materials.cyanGlow);

  const chairX = -0.18;
  const chairZ = 1.02;
  const chair = new THREE.Group();
  chair.name = 'desk-chair';
  chair.position.set(chairX, 0, chairZ);
  chair.rotation.y = -0.22;
  scene.add(chair);
  makeBoxInGroup(chair, 'chair-seat-cushion', [1.15, 0.18, 0.95], [0, 0.66, 0], materials.dark);
  makeBoxInGroup(chair, 'chair-seat-front-roll', [1.08, 0.12, 0.12], [0, 0.74, 0.48], materials.deskMat);
  makeBoxInGroup(chair, 'chair-back-rest', [1.08, 1.1, 0.16], [0, 1.28, 0.42], materials.dark);
  makeBoxInGroup(chair, 'chair-back-inner-pad', [0.86, 0.76, 0.06], [0, 1.28, 0.325], materials.deskMat);
  makeBoxInGroup(chair, 'chair-headrest', [0.72, 0.18, 0.16], [0, 1.92, 0.42], materials.dark);
  makeBoxInGroup(chair, 'chair-left-arm', [0.12, 0.12, 0.74], [-0.66, 0.98, 0.06], materials.metal);
  makeBoxInGroup(chair, 'chair-right-arm', [0.12, 0.12, 0.74], [0.66, 0.98, 0.06], materials.metal);
  makeBoxInGroup(chair, 'chair-left-arm-pad', [0.18, 0.06, 0.46], [-0.66, 1.08, 0.06], materials.dark);
  makeBoxInGroup(chair, 'chair-right-arm-pad', [0.18, 0.06, 0.46], [0.66, 1.08, 0.06], materials.dark);
  makeBoxInGroup(chair, 'chair-gas-lift', [0.16, 0.46, 0.16], [0, 0.35, 0], materials.metal);
  makeBoxInGroup(chair, 'chair-base-hub', [0.32, 0.12, 0.32], [0, 0.13, 0], materials.metal);
  [
    [0, 0.56],
    [0.53, 0.18],
    [0.33, -0.46],
    [-0.33, -0.46],
    [-0.53, 0.18],
  ].forEach(([x, z], index) => {
    makeBoxInGroup(chair, `chair-star-leg-${index}`, [0.14, 0.08, 0.62], [x * 0.52, 0.12, z * 0.52], materials.metal);
    makeBoxInGroup(chair, `chair-wheel-${index}`, [0.18, 0.12, 0.12], [x * 0.72, 0.06, z * 0.72], materials.dark);
  });
  
  // Pequenos objetos en el escritorio
  const pencilCupX = 1.82;
  const pencilCupZ = -0.58;
  makeBox('pencil-cup-body', [0.26, 0.28, 0.26], [pencilCupX, 1.16, pencilCupZ], materials.metal);
  makeBox('pencil-cup-base', [0.32, 0.035, 0.32], [pencilCupX, 1.03, pencilCupZ], materials.dark);
  [
    [-0.07, 0.02, 0.34, materials.greenGlow],
    [0.0, -0.06, 0.42, materials.amber],
    [0.08, 0.04, 0.38, materials.paper],
    [0.04, 0.09, 0.3, materials.cyanGlow],
  ].forEach(([x, z, height, material], index) => {
    makeBox(`pencil-${index}`, [0.028, height as number, 0.028], [pencilCupX + (x as number), 1.29 + (height as number) / 2, pencilCupZ + (z as number)], material as THREE.Material);
    makeBox(`pencil-tip-${index}`, [0.04, 0.045, 0.04], [pencilCupX + (x as number), 1.32 + (height as number), pencilCupZ + (z as number)], materials.desk);
  });
  const setSettingsPanelOpen = (isOpen: boolean) => {
    settingsPanelOpen = isOpen;
    refreshSettingsTextures();
  };

  const makeMonitor = (
    key: string,
    href: string,
    x: number,
    material: THREE.MeshStandardMaterial,
  ) => {
    const group = new THREE.Group();
    group.name = key;
    const frame = makeBox(`${key}-monitor-frame`, [1.72, 1.08, 0.1], [x, 1.8, -1.08], materials.dark);
    const screen = makeBox(`${key}-monitor-screen`, [1.5, 0.86, 0.04], [x, 1.82, -0.995], material);
    
    makeBox(`${key}-monitor-bezel`, [1.56, 0.92, 0.04], [x, 1.82, -1.02], materials.metal);
    makeBox(`${key}-monitor-bottom-lip`, [1.52, 0.08, 0.055], [x, 1.36, -0.99], materials.dark);
    makeBox(`${key}-monitor-status-light`, [0.08, 0.025, 0.018], [x + 0.64, 1.36, -0.955], materials.cyanGlow);
    
    const glow = makeBox(`${key}-monitor-hover`, [1.52, 0.88, 0.022], [x, 1.82, -0.96], materials.hover);
    const stand = makeBox(`${key}-monitor-stand`, [0.12, 0.26, 0.12], [x, 1.12, -1.08], materials.metal);
    makeBox(`${key}-monitor-base`, [0.5, 0.05, 0.24], [x, 1.0, -1.08], materials.metal);
    makeBox(`${key}-monitor-cable-port`, [0.12, 0.06, 0.04], [x, 0.92, -1.16], materials.dark);
    
    glow.visible = false;
    group.add(frame, screen, stand, glow);
    scene.add(group);

    const hit = makeBox(`${key}-monitor-hitbox`, [1.86, 1.28, 0.18], [x, 1.82, -0.82], materials.hitbox);
    hit.userData.href = href;
    hit.userData.screenX = x;
    hit.userData.hover = glow;
    interactive.push(hit);
  };

  makeMonitor('about', '/sobre-mi', -0.98, materials.projectsScreen);
  makeMonitor('portfolio', '/portfolio', 0.88, materials.techScreen);

  const bed = new THREE.Group();
  bed.name = 'back-wall-bed-right-to-left';
  bed.position.set(1.78, 0, 6.14);
  scene.add(bed);
  makeBoxInGroup(bed, 'bed-low-shadow-base', [3.82, 0.08, 1.34], [0, 0.18, 0], materials.deskEdge);
  makeBoxInGroup(bed, 'bed-wood-frame', [3.92, 0.26, 1.44], [0, 0.34, 0], materials.bedFrame);
  makeBoxInGroup(bed, 'bed-left-side-rail', [3.98, 0.18, 0.1], [0, 0.55, -0.72], materials.doorInset);
  makeBoxInGroup(bed, 'bed-right-side-rail', [3.98, 0.18, 0.1], [0, 0.55, 0.72], materials.doorInset);
  makeBoxInGroup(bed, 'bed-left-end-footboard', [0.14, 0.72, 1.48], [-2.04, 0.68, 0], materials.bedFrame);
  makeBoxInGroup(bed, 'bed-right-end-headboard', [0.2, 1.12, 1.52], [2.06, 0.88, 0], materials.bedFrame);
  makeBoxInGroup(bed, 'mattress', [3.62, 0.34, 1.22], [-0.06, 0.68, 0], materials.mattress);
  makeBoxInGroup(bed, 'mattress-front-piping', [3.48, 0.035, 0.035], [-0.14, 0.87, 0.64], materials.paper);
  makeBoxInGroup(bed, 'mattress-back-piping', [3.48, 0.035, 0.035], [-0.14, 0.87, -0.64], materials.paper);
  makeBoxInGroup(bed, 'teal-blanket-main', [2.5, 0.12, 1.12], [-0.5, 0.94, 0], materials.blanket);
  makeBoxInGroup(bed, 'teal-blanket-fold', [0.28, 0.16, 1.14], [0.84, 1.0, 0], materials.blanketFold);
  makeBoxInGroup(bed, 'teal-blanket-left-drop', [0.12, 0.44, 1.08], [-1.78, 0.74, 0], materials.blanket);
  makeBoxInGroup(bed, 'pillow-right-main', [0.64, 0.2, 0.88], [1.48, 1.02, 0], materials.pillow);
  makeBoxInGroup(bed, 'pillow-right-top-softness', [0.48, 0.06, 0.72], [1.46, 1.16, 0], materials.paper);
  makeBoxInGroup(bed, 'pillow-right-seam-front', [0.5, 0.024, 0.025], [1.46, 1.16, 0.43], materials.metal);
  makeBoxInGroup(bed, 'pillow-right-seam-back', [0.5, 0.024, 0.025], [1.46, 1.16, -0.43], materials.metal);
  [
    [-1.72, -0.56],
    [-1.72, 0.56],
    [1.72, -0.56],
    [1.72, 0.56],
  ].forEach(([x, z], index) => {
    makeBoxInGroup(bed, `bed-square-leg-${index + 1}`, [0.16, 0.38, 0.16], [x, 0.02, z], materials.deskEdge);
  });

  const bedRug = makeBox('back-bed-rug', [4.25, 0.028, 1.76], [1.78, 0.018, 6.14], materials.rug);
  bedRug.receiveShadow = true;

  const windowCenterX = -0.85;
  const windowCenterY = 2.66;
  const windowZ = 6.58;
  makeBox('park-window-recess-shadow', [1.86, 1.42, 0.08], [windowCenterX, windowCenterY, 6.92], materials.doorVoid);
  const parkView = makeRearWallPlane('park-window-view', [1.58, 1.12], [windowCenterX, windowCenterY, windowZ], materials.parkView);
  parkView.castShadow = false;
  parkView.receiveShadow = false;
  const windowGlass = makeRearWallPlane('park-window-glass', [1.58, 1.12], [windowCenterX, windowCenterY, windowZ - 0.018], materials.glass);
  windowGlass.castShadow = false;
  windowGlass.receiveShadow = false;
  makeBox('park-window-frame-top', [1.84, 0.12, 0.1], [windowCenterX, windowCenterY + 0.67, 6.54], materials.metal);
  makeBox('park-window-frame-bottom', [1.84, 0.12, 0.1], [windowCenterX, windowCenterY - 0.67, 6.54], materials.metal);
  makeBox('park-window-frame-left', [0.12, 1.44, 0.1], [windowCenterX - 0.92, windowCenterY, 6.54], materials.metal);
  makeBox('park-window-frame-right', [0.12, 1.44, 0.1], [windowCenterX + 0.92, windowCenterY, 6.54], materials.metal);
  makeBox('park-window-center-mullion', [0.08, 1.3, 0.08], [windowCenterX, windowCenterY, 6.51], materials.metal);
  makeBox('park-window-cross-mullion', [1.66, 0.07, 0.08], [windowCenterX, windowCenterY + 0.05, 6.51], materials.metal);
  makeBox('park-window-sill', [2.12, 0.12, 0.32], [windowCenterX, windowCenterY - 0.83, 6.38], materials.desk);
  makeBox('park-window-sill-lip', [2.22, 0.055, 0.1], [windowCenterX, windowCenterY - 0.75, 6.22], materials.deskEdge);
  
  // Detalles adicionales en las estanterias
  
  
  
  
  const galleryX = -1.22;
  const galleryBoard = makeBox('wall-gallery-wood-board', [3.28, 1.98, 0.18], [galleryX, 2.82, -2.88], materials.door);
  const wallGallery = makeBackWallPlane('wall-photo-gallery', [2.96, 1.66], [galleryX, 2.82, -2.775], materials.galleryPhoto);
  galleryBoard.castShadow = false;
  galleryBoard.receiveShadow = false;
  wallGallery.castShadow = false;
  wallGallery.receiveShadow = false;
  wallGallery.userData.isPhotoFrame = true;

  makeBox('books-shelf', [2.3, 0.16, 0.52], [2.05, 3.32, -2.71], materials.desk);
  makeBox('book-a', [0.16, 0.58, 0.34], [1.26, 3.72, -2.72], materials.amber);
  makeBox('book-b', [0.16, 0.5, 0.34], [1.48, 3.68, -2.72], materials.greenGlow);
  makeBox('book-c', [0.16, 0.62, 0.34], [1.7, 3.74, -2.72], materials.cyanGlow);
  makeBox('book-d', [0.16, 0.54, 0.34], [1.92, 3.7, -2.72], materials.paper);
  const magazine = makeBackWallPlane('blog-magazine', [0.66, 0.86], [2.58, 3.76, -2.965], materials.magazine);
  const magazineGlow = makeBackWallPlane('blog-magazine-hover', [0.69, 0.89], [2.58, 3.76, -2.955], materials.hover);
  magazineGlow.visible = false;
  const magazineHit = makeBox('blog-magazine-hitbox', [0.84, 1.04, 0.18], [2.58, 3.76, -2.88], materials.hitbox);
  magazineHit.userData.href = '/blog';
  magazineHit.userData.hover = magazineGlow;
  interactive.push(magazineHit);

  makeBox('toys-shelf', [1.9, 0.16, 0.52], [2.35, 2.18, -2.71], materials.desk);
  const registerShelfControl = (
    name: string,
    position: THREE.Vector3Tuple,
    material: THREE.Material,
    action: string,
  ) => {
    const base = makeBox(`${name}-cube`, [0.28, 0.28, 0.28], position, material);
    const face = makeBackWallPlane(name, [0.24, 0.24], [position[0], position[1], position[2] + 0.145], material);
    const hover = makeBackWallPlane(`${name}-hover`, [0.29, 0.29], [position[0], position[1], position[2] + 0.18], materials.shelfControlHover);
    const hit = makeBox(`${name}-hitbox`, [0.32, 0.32, 0.34], [position[0], position[1], position[2] + 0.03], materials.hitbox);
    hover.visible = false;
    hit.userData.action = action;
    hit.userData.hover = hover;
    interactive.push(hit);
    return { base, face, hover, hit };
  };

  registerShelfControl('shelf-theme-dark', [1.62, 2.68, -2.78], materials.settingsDark, 'settings:theme:dark');
  registerShelfControl('shelf-theme-light', [1.94, 2.68, -2.78], materials.settingsLight, 'settings:theme:light');
  registerShelfControl('shelf-language-es', [1.62, 2.4, -2.78], materials.settingsEs, 'settings:language:es');
  registerShelfControl('shelf-language-en', [1.94, 2.4, -2.78], materials.settingsEn, 'settings:language:en');

  makeBox('shelf-trophy-base', [0.34, 0.08, 0.24], [2.42, 2.31, -2.78], materials.metal);
  makeBox('shelf-trophy-stem', [0.08, 0.24, 0.08], [2.42, 2.47, -2.78], materials.amber);
  makeBox('shelf-trophy-cup', [0.26, 0.28, 0.18], [2.42, 2.66, -2.78], materials.amber);
  makeBox('shelf-trophy-top-lip', [0.34, 0.045, 0.22], [2.42, 2.82, -2.78], materials.amber);
  makeBox('shelf-trophy-left-handle', [0.055, 0.2, 0.045], [2.24, 2.66, -2.78], materials.amber);
  makeBox('shelf-trophy-right-handle', [0.055, 0.2, 0.045], [2.6, 2.66, -2.78], materials.amber);

  const rubikOrigin: THREE.Vector3Tuple = [2.9, 2.41, -2.78];
  const rubikSize = 0.3;
  const rubikHalf = rubikSize / 2;
  const rubikCell = 0.082;
  const rubikStep = 0.09;
  const rubikFaceOffset = rubikHalf + 0.008;
  const rubikColors = [
    materials.rubikWhite,
    materials.rubikYellow,
    materials.rubikRed,
    materials.rubikOrange,
    materials.rubikBlue,
    materials.rubikGreen,
  ];
  makeBox('rubik-body', [rubikSize, rubikSize, rubikSize], rubikOrigin, materials.dark);

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const x = -rubikStep + column * rubikStep;
      const y = rubikStep - row * rubikStep;
      const colorIndex = row * 3 + column;
      makeBox(`rubik-front-${row}-${column}`, [rubikCell, rubikCell, 0.012], [rubikOrigin[0] + x, rubikOrigin[1] + y, rubikOrigin[2] + rubikFaceOffset], rubikColors[colorIndex % rubikColors.length]);
      makeBox(`rubik-back-${row}-${column}`, [rubikCell, rubikCell, 0.012], [rubikOrigin[0] - x, rubikOrigin[1] + y, rubikOrigin[2] - rubikFaceOffset], rubikColors[(colorIndex + 1) % rubikColors.length]);
      makeBox(`rubik-right-${row}-${column}`, [0.012, rubikCell, rubikCell], [rubikOrigin[0] + rubikFaceOffset, rubikOrigin[1] + y, rubikOrigin[2] - x], rubikColors[(colorIndex + 2) % rubikColors.length]);
      makeBox(`rubik-left-${row}-${column}`, [0.012, rubikCell, rubikCell], [rubikOrigin[0] - rubikFaceOffset, rubikOrigin[1] + y, rubikOrigin[2] + x], rubikColors[(colorIndex + 3) % rubikColors.length]);
      makeBox(`rubik-top-${row}-${column}`, [rubikCell, 0.012, rubikCell], [rubikOrigin[0] + x, rubikOrigin[1] + rubikFaceOffset, rubikOrigin[2] + y], rubikColors[(colorIndex + 4) % rubikColors.length]);
      makeBox(`rubik-bottom-${row}-${column}`, [rubikCell, 0.012, rubikCell], [rubikOrigin[0] + x, rubikOrigin[1] - rubikFaceOffset, rubikOrigin[2] - y], rubikColors[(colorIndex + 5) % rubikColors.length]);
    }
  }

  const monkey = new THREE.Group();
  monkey.name = 'easter-egg-monkey';
  const plush = new THREE.MeshStandardMaterial({ color: '#7c4a2d', roughness: 0.92 });
  const plushFace = new THREE.MeshStandardMaterial({ color: '#d6a06a', roughness: 0.9 });
  const plushDark = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.86 });
  const monkeyBaseColor = new THREE.Color('#7c4a2d');
  const monkeyFaceBaseColor = new THREE.Color('#d6a06a');
  const monkeyHoverColor = new THREE.Color('#22d3ee');
  const monkeyFaceHoverColor = new THREE.Color('#fde68a');
  const makeMonkeyPart = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: THREE.Vector3Tuple,
    scale: THREE.Vector3Tuple,
    rotation: THREE.Vector3Tuple = [0, 0, 0],
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.rotation.set(...rotation);
    part.scale.set(...scale);
    part.castShadow = true;
    part.receiveShadow = true;
    monkey.add(part);
    return part;
  };

  makeMonkeyPart(new THREE.SphereGeometry(0.34, 32, 20), plush, [0, 0.58, 0], [1.05, 1.22, 0.9]);
  makeMonkeyPart(new THREE.SphereGeometry(0.22, 24, 16), plushFace, [0, 0.53, 0.22], [1.08, 1.28, 0.38]);
  makeMonkeyPart(new THREE.SphereGeometry(0.27, 32, 20), plush, [0, 1.08, 0.03], [1.02, 0.98, 0.92]);
  makeMonkeyPart(new THREE.SphereGeometry(0.17, 24, 14), plushFace, [0, 0.98, 0.25], [1.2, 0.74, 0.46]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 20, 14), plush, [-0.28, 1.1, 0.02], [0.9, 1, 0.68]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 20, 14), plush, [0.28, 1.1, 0.02], [0.9, 1, 0.68]);
  makeMonkeyPart(new THREE.SphereGeometry(0.07, 18, 12), plushFace, [-0.29, 1.1, 0.04], [0.9, 0.9, 0.45]);
  makeMonkeyPart(new THREE.SphereGeometry(0.07, 18, 12), plushFace, [0.29, 1.1, 0.04], [0.9, 0.9, 0.45]);
  makeMonkeyPart(new THREE.SphereGeometry(0.032, 14, 10), plushDark, [-0.09, 1.14, 0.27], [1, 1, 1]);
  makeMonkeyPart(new THREE.SphereGeometry(0.032, 14, 10), plushDark, [0.09, 1.14, 0.27], [1, 1, 1]);
  makeMonkeyPart(new THREE.SphereGeometry(0.022, 12, 8), plushDark, [0, 1.01, 0.33], [1.1, 0.8, 0.8]);
  makeMonkeyPart(new THREE.BoxGeometry(0.13, 0.018, 0.018), plushDark, [0, 0.94, 0.34], [1, 1, 1]);
  makeMonkeyPart(new THREE.CylinderGeometry(0.055, 0.07, 0.56, 18), plush, [-0.34, 0.58, 0.05], [1, 1, 1], [0.42, 0.02, 0.42]);
  makeMonkeyPart(new THREE.CylinderGeometry(0.055, 0.07, 0.56, 18), plush, [0.34, 0.58, 0.05], [1, 1, 1], [0.42, -0.02, -0.42]);
  makeMonkeyPart(new THREE.SphereGeometry(0.075, 16, 10), plushFace, [-0.42, 0.26, 0.22], [1.2, 0.72, 1]);
  makeMonkeyPart(new THREE.SphereGeometry(0.075, 16, 10), plushFace, [0.42, 0.26, 0.22], [1.2, 0.72, 1]);
  makeMonkeyPart(new THREE.CylinderGeometry(0.075, 0.095, 0.58, 20), plush, [-0.22, 0.18, 0.24], [1, 1, 1], [1.38, -0.1, -0.72]);
  makeMonkeyPart(new THREE.CylinderGeometry(0.075, 0.095, 0.58, 20), plush, [0.22, 0.18, 0.24], [1, 1, 1], [1.38, 0.1, 0.72]);
  makeMonkeyPart(new THREE.SphereGeometry(0.105, 18, 12), plushFace, [-0.48, 0.1, 0.32], [1.34, 0.72, 0.92]);
  makeMonkeyPart(new THREE.SphereGeometry(0.105, 18, 12), plushFace, [0.48, 0.1, 0.32], [1.34, 0.72, 0.92]);
  makeMonkeyPart(new THREE.TorusGeometry(0.24, 0.034, 12, 40, Math.PI * 1.35), plush, [0.34, 0.42, -0.24], [1, 1, 1], [0.28, -0.85, 1.24]);

  monkey.position.set(3.62, 0.06, -2.82);
  monkey.rotation.y = -0.96;
  monkey.scale.set(1.08, 1.08, 1.08);
  scene.add(monkey);
  const monkeyHit = makeBox('monkey-hitbox', [0.95, 1.48, 0.66], [3.58, 0.84, -2.78], materials.hitbox);
  monkeyHit.userData.href = '/easter-egg';
  monkeyHit.userData.isMonkey = true;
  interactive.push(monkeyHit);

  const hemisphereLight = new THREE.HemisphereLight('#e8f4f8', '#0a0e16', 1.35);
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight('#ffffff', 2.8);
  keyLight.position.set(3.2, 5.8, 4.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#7dd3fc', 0.6);
  fillLight.position.set(-4, 3.2, 2);
  scene.add(fillLight);

  const rightWallSoftLight = new THREE.PointLight('#dbeafe', 2.0, 5.2);
  rightWallSoftLight.position.set(3.1, 2.55, 2.4);
  scene.add(rightWallSoftLight);

  const backWallSoftLight = new THREE.PointLight('#f8fafc', 1.45, 5.8);
  backWallSoftLight.position.set(0.1, 3.05, -2.3);
  scene.add(backWallSoftLight);

  const leftWallSoftShadowLight = new THREE.PointLight('#bfdbfe', 1.25, 4.8);
  leftWallSoftShadowLight.position.set(-3.35, 2.35, 3.1);
  scene.add(leftWallSoftShadowLight);

  const cyanLight = new THREE.PointLight('#22d3ee', 18, 8.5);
  cyanLight.position.set(-1.5, 2.8, -1.5);
  cyanLight.shadow.mapSize.set(512, 512);
  scene.add(cyanLight);

  const amberLight = new THREE.PointLight('#f59e0b', 10, 6.2);
  amberLight.position.set(-3.5, 2.2, -2.0);
  scene.add(amberLight);

  const windowLight = new THREE.PointLight('#bae6fd', 6, 6.2);
  windowLight.position.set(-3.5, 2.6, 2.6);
  scene.add(windowLight);

  const deskKeyLight = new THREE.PointLight('#e0f2fe', 5, 4.5);
  deskKeyLight.position.set(0.2, 2.2, 0.8);
  scene.add(deskKeyLight);

  let photoIndex = 0;
  let lastPhotoChange = 0;
  const photoTextures = [0, 1, 2, 3].map((index) => makePhotoTexture(index));
  const photoExtensions = ['webp', 'jpg', 'jpeg', 'png', 'svg'];

  const loadPhotoTexture = (index: number, extensionIndex = 0) => {
    if (extensionIndex >= photoExtensions.length) {
      return;
    }

    textureLoader.load(
      `/photos/photo-${index + 1}.${photoExtensions[extensionIndex]}`,
      (texture) => {
        sharpenTexture(texture);
        photoTextures[index].dispose();
        photoTextures[index] = texture;
        if (index === photoIndex) {
          materials.photoFrame.map = texture;
          materials.galleryPhoto.map = texture;
          materials.photoFrame.needsUpdate = true;
          materials.galleryPhoto.needsUpdate = true;
        }
      },
      undefined,
      () => loadPhotoTexture(index, extensionIndex + 1),
    );
  };

  photoTextures.forEach((_, index) => loadPhotoTexture(index));

  applyStudioTheme(document.documentElement.dataset.theme ?? 'dark');
  applyStudioLanguage(document.documentElement.dataset.language ?? document.documentElement.lang);

  window.addEventListener('studio:theme-change', (event) => {
    applyStudioTheme((event as CustomEvent<string>).detail);
  });

  window.addEventListener('studio:language-change', (event) => {
    applyStudioLanguage((event as CustomEvent<string>).detail);
  });

  const setCameraTarget = (target: string) => {
    controls.enabled = false;
    isEnteringScreen = true;
    transitionStart = performance.now();
    transitionDuration = 380;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);

    if (target === 'projects') {
      cameraGoal.set(-0.38, 1.84, -0.16);
      targetGoal.set(-0.38, 1.82, -1.02);
      pendingPanel = 'projects';
      pendingPanelAt = transitionStart + transitionDuration + 90;
      return;
    }

    if (target === 'tech') {
      cameraGoal.set(2.55, 3.5, -1.92);
      targetGoal.set(2.55, 3.5, -2.78);
      pendingPanel = 'tech';
      pendingPanelAt = transitionStart + transitionDuration + 90;
      return;
    }

    cameraGoal.set(1.25, 1.5, 0.36);
    targetGoal.set(1.25, 1.5, -0.38);
    pendingPanel = 'contact';
    pendingPanelAt = transitionStart + transitionDuration + 90;
  };

  const resetCamera = () => {
    pendingPanel = null;
    pendingNavigationHref = null;
    pendingDoorMenuAt = 0;
    doorMenuOpen = false;
    doorOpenTarget = 0;
    doorMenu?.classList.remove('is-open');
    doorMenu?.setAttribute('aria-hidden', 'true');
    isEnteringScreen = false;
    transitionStart = performance.now();
    transitionDuration = 520;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);
    cameraGoal.copy(defaultCamera);
    targetGoal.copy(defaultTarget);
  };

  const enterScreenRoute = (href: string, screenX: number) => {
    pendingPanel = null;
    pendingNavigationHref = href;
    controls.enabled = false;
    isEnteringScreen = true;
    transitionStart = performance.now();
    transitionDuration = 760;
    pendingNavigationAt = transitionStart + transitionDuration + 80;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);
    cameraGoal.set(screenX, 1.82, -0.58);
    targetGoal.set(screenX, 1.82, -1.06);
  };

  const openDoorMenu = () => {
    pendingPanel = null;
    pendingNavigationHref = null;
    pendingDoorMenuAt = performance.now() + 1180;
    doorMenuOpen = true;
    doorOpenTarget = 1;
    controls.enabled = false;
    isEnteringScreen = true;
    transitionStart = performance.now();
    transitionDuration = 920;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);
    doorReturnCamera.copy(camera.position);
    doorReturnTarget.copy(controls.target);
    cameraGoal.set(2.75, 1.72, 0.24);
    targetGoal.set(3.88, 1.52, 0.26);
  };

  const closeDoorMenu = () => {
    pendingDoorMenuAt = 0;
    doorMenuOpen = false;
    doorOpenTarget = 0;
    doorMenu?.classList.remove('is-open');
    doorMenu?.setAttribute('aria-hidden', 'true');
    controls.enabled = false;
    isEnteringScreen = false;
    transitionStart = performance.now();
    transitionDuration = 520;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);
    cameraGoal.copy(doorReturnCamera.lengthSq() ? doorReturnCamera : defaultCamera);
    targetGoal.copy(doorReturnTarget.lengthSq() ? doorReturnTarget : defaultTarget);
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const rotateCameraInPlace = (deltaX: number, deltaY: number) => {
    const lookOffset = controls.target.clone().sub(camera.position);
    const distance = Math.max(0.8, lookOffset.length());
    const spherical = new THREE.Spherical().setFromVector3(lookOffset);
    spherical.theta -= deltaX * 0.0042;
    spherical.phi -= deltaY * 0.0036;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.12, Math.PI - 0.12);
    spherical.radius = distance;
    controls.target.copy(camera.position).add(new THREE.Vector3().setFromSpherical(spherical));
    cameraGoal.copy(camera.position);
    targetGoal.copy(controls.target);
  };

  const moveCameraTowardPointer = (event: WheelEvent) => {
    if (!controls.enabled || isEnteringScreen) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);

    const deltaModeMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 120 : 1;
    const normalizedDelta = THREE.MathUtils.clamp(event.deltaY * deltaModeMultiplier, -140, 140);
    const moveAmount = -normalizedDelta * 0.0042;
    const previousPosition = camera.position.clone();

    camera.position.addScaledVector(raycaster.ray.direction, moveAmount);
    keepCameraInsideRoom();
    const actualMove = camera.position.clone().sub(previousPosition);
    controls.target.add(actualMove);
    cameraGoal.copy(camera.position);
    targetGoal.copy(controls.target);
  };

  canvas.addEventListener('wheel', moveCameraTowardPointer, { passive: false, capture: true });

  canvas.addEventListener('pointermove', (event) => {
    if (isLookDragging && controls.enabled && !isEnteringScreen && (event.buttons & 1) === 1) {
      rotateCameraInPlace(event.clientX - lookDragX, event.clientY - lookDragY);
      lookDragX = event.clientX;
      lookDragY = event.clientY;
      event.preventDefault();
    }

    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(getVisibleInteractiveObjects(), false)[0];
    const nextHover = hit?.object ?? null;

    if (hoveredObject !== nextHover) {
      const previousHoverMesh = hoveredObject?.userData.hover as THREE.Object3D | undefined;
      const nextHoverMesh = nextHover?.userData.hover as THREE.Object3D | undefined;
      if (previousHoverMesh) {
        previousHoverMesh.visible = false;
      }
      if (nextHoverMesh) {
        nextHoverMesh.visible = true;
      }
      hoveredObject = nextHover;
    }

    canvas.style.cursor = nextHover ? 'pointer' : 'grab';
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    if (event.button === 0) {
      isLookDragging = true;
      lookDragX = event.clientX;
      lookDragY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }
  });

  const activateScreenFromPointer = (event: PointerEvent) => {
    const moved = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
    if (moved > 6 || isEnteringScreen) {
      return;
    }

    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(getVisibleInteractiveObjects(), false)[0];
    const action = hit?.object.userData.action;
    if (typeof action === 'string') {
      if (action === 'terminal:focus') {
        focusTerminal(event);
        return;
      }

      blurTerminal();

      if (action === 'settings:toggle') {
        setSettingsPanelOpen(!settingsPanelOpen);
        return;
      }

      if (action === 'door:open-menu') {
        openDoorMenu();
        return;
      }

      if (action === 'settings:theme:dark' || action === 'settings:theme:light') {
        window.dispatchEvent(new CustomEvent('settings:set-theme', { detail: action.endsWith('dark') ? 'dark' : 'light' }));
        return;
      }

      if (action === 'settings:language:es' || action === 'settings:language:en') {
        window.dispatchEvent(new CustomEvent('settings:set-language', { detail: action.endsWith('es') ? 'es' : 'en' }));
        return;
      }
    }

    const href = hit?.object.userData.href;
    if (typeof href === 'string') {
      blurTerminal();
      if (typeof hit?.object.userData.screenX === 'number') {
        enterScreenRoute(href, hit.object.userData.screenX);
        return;
      }

      window.location.href = href;
      return;
    }

    const target = hit?.object.userData.target;

    if (typeof target === 'string') {
      blurTerminal();
      setCameraTarget(target);
      return;
    }

    blurTerminal();
  };

  canvas.addEventListener('pointerup', (event) => {
    isLookDragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    activateScreenFromPointer(event);
  });

  canvas.addEventListener('pointercancel', (event) => {
    isLookDragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target === canvas || event.target === terminalKeyboard) {
      return;
    }

    blurTerminal();
  });

  terminalKeyboard.addEventListener('input', () => {
    terminalInput = terminalKeyboard.value.slice(0, 44);
    syncTerminalKeyboard();
    scheduleTerminalTextureRender();
  });

  terminalKeyboard.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitTerminalCommand();
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      blurTerminal();
      event.preventDefault();
    }
  });

  terminalKeyboard.addEventListener('blur', () => {
    if (terminalFocused) {
      terminalFocused = false;
      renderTerminalTexture();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.target === terminalKeyboard) {
      return;
    }

    if (!terminalFocused) {
      return;
    }

    if (event.key === 'Escape') {
      blurTerminal();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Enter') {
      submitTerminalCommand();
      event.preventDefault();
      return;
    }

    if (event.key === 'Backspace') {
      terminalInput = terminalInput.slice(0, -1);
      syncTerminalKeyboard();
      scheduleTerminalTextureRender();
      event.preventDefault();
      return;
    }

    if (event.key.length === 1 && terminalInput.length < 44) {
      terminalInput += event.key;
      syncTerminalKeyboard();
      scheduleTerminalTextureRender();
      event.preventDefault();
    }
  });

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) {
      return;
    }

    const aspect = clientWidth / clientHeight;
    const compactAmount = Math.min(1, Math.max(0, (baseViewportAspect - aspect) / 0.9));
    const shouldApplyInitialCamera = !hasInitializedViewport;
    const distanceScale = 1 + compactAmount * 0.12;
    const targetLift = compactAmount * 0.02;
    const cameraOffset = baseCameraPosition.clone().sub(baseCameraTarget).multiplyScalar(distanceScale);

    isCompactViewport = compactAmount > 0.08;
    defaultTarget.copy(baseCameraTarget).add(new THREE.Vector3(0, targetLift, 0));
    defaultCamera.copy(defaultTarget).add(cameraOffset);

    if (shouldApplyInitialCamera && !isEnteringScreen && !pendingPanel) {
      cameraGoal.copy(defaultCamera);
      targetGoal.copy(defaultTarget);
      camera.position.copy(defaultCamera);
      controls.target.copy(defaultTarget);
      hasInitializedViewport = true;
    }

    camera.aspect = aspect;
    camera.fov = baseCameraFov + compactAmount * 6;
    camera.updateProjectionMatrix();
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    controls.zoomSpeed = isCompactViewport ? 1.35 : 0.82;
    controls.rotateSpeed = isCompactViewport ? 0.58 : 0.72;
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const animate = () => {
    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();
    
    // Animacion mas realista de las pantallas
    materials.projectsScreen.emissiveIntensity = 0.82 + Math.sin(elapsed * 2.1) * 0.14;
    materials.contactScreen.emissiveIntensity = 0.80 + Math.sin(elapsed * 2.6 + 1.2) * 0.14;
    materials.techScreen.emissiveIntensity = 0.80 + Math.sin(elapsed * 2.3 + 0.5) * 0.14;
    doorOpenAmount = THREE.MathUtils.lerp(doorOpenAmount, doorOpenTarget, Math.min(1, delta * 5.6));
    if (doorPivot) {
      doorPivot.rotation.y = -doorOpenAmount * 1.68;
    }
    if (hoveredObject?.userData.isDoorKnob) {
      const knobColor = new THREE.Color().setHSL((elapsed * 0.42) % 1, 0.92, 0.56);
      materials.doorKnob.color.copy(knobColor);
      materials.doorKnob.emissive.copy(knobColor);
      materials.doorKnob.emissiveIntensity = 1.45 + Math.sin(elapsed * 8) * 0.32;
    } else {
      materials.doorKnob.color.set('#f59e0b');
      materials.doorKnob.emissive.set('#f59e0b');
      materials.doorKnob.emissiveIntensity = 0.65;
    }
    const monkeyHoverAmount = hoveredObject?.userData.isMonkey ? (0.42 + Math.sin(elapsed * 5.2) * 0.18) : 0;
    plush.color.copy(monkeyBaseColor).lerp(monkeyHoverColor, monkeyHoverAmount);
    plush.emissive.copy(monkeyHoverColor).multiplyScalar(monkeyHoverAmount * 0.45);
    plush.emissiveIntensity = monkeyHoverAmount;
    plushFace.color.copy(monkeyFaceBaseColor).lerp(monkeyFaceHoverColor, monkeyHoverAmount * 0.75);
    
    // Luces dinamicas mas realistas
    cyanLight.intensity = (currentTheme === 'light' ? 5.4 : 16) + Math.sin(elapsed * 1.5) * (currentTheme === 'light' ? 0.7 : 2.5);
    amberLight.intensity = (currentTheme === 'light' ? 2.8 : 10) + Math.sin(elapsed * 1.2) * (currentTheme === 'light' ? 0.45 : 1.8);
    deskKeyLight.intensity = (currentTheme === 'light' ? 2.2 : 4.5) + Math.sin(elapsed * 0.8) * (currentTheme === 'light' ? 0.45 : 1.2);

    if (elapsed - lastPhotoChange > 3.2) {
      photoIndex = (photoIndex + 1) % 4;
      materials.photoFrame.map = photoTextures[photoIndex];
      materials.galleryPhoto.map = photoTextures[photoIndex];
      materials.photoFrame.needsUpdate = true;
      materials.galleryPhoto.needsUpdate = true;
      lastPhotoChange = elapsed;
    }

    if (terminalFocused) {
      const cursorVisible = Math.floor(performance.now() / 520) % 2 === 0;
      if (cursorVisible !== lastTerminalCursorVisible) {
        lastTerminalCursorVisible = cursorVisible;
        renderTerminalTexture();
      }
    }

    if (isEnteringScreen || !controls.enabled) {
      const progress = Math.min(1, (performance.now() - transitionStart) / transitionDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(transitionFromCamera, cameraGoal, eased);
      controls.target.lerpVectors(transitionFromTarget, targetGoal, eased);
      if (!isEnteringScreen && progress >= 1) {
        controls.enabled = true;
      }
    } else {
      camera.position.lerp(cameraGoal, Math.min(1, delta * 2.4));
      controls.target.lerp(targetGoal, Math.min(1, delta * 2.6));
    }
    controls.update();
    keepCameraInsideRoom();

    if (controls.enabled && !isEnteringScreen) {
      cameraGoal.copy(camera.position);
      targetGoal.copy(controls.target);
    }

    if (pendingPanel && performance.now() >= pendingPanelAt) {
      window.dispatchEvent(new CustomEvent('studio:open-panel', { detail: pendingPanel }));
      pendingPanel = null;
    }

    if (pendingNavigationHref && performance.now() >= pendingNavigationAt) {
      window.location.href = pendingNavigationHref;
      pendingNavigationHref = null;
    }

    if (pendingDoorMenuAt && performance.now() >= pendingDoorMenuAt) {
      doorMenu?.classList.add('is-open');
      doorMenu?.setAttribute('aria-hidden', 'false');
      pendingDoorMenuAt = 0;
    }

    renderer.render(scene, camera);
    if (!hasShownFirstFrame) {
      hasShownFirstFrame = true;
      requestAnimationFrame(() => loadingScreen?.classList.add('is-hidden'));
    }
    requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resize);
  window.addEventListener('studio:exit-screen', resetCamera);
  doorMenuRoom?.addEventListener('click', closeDoorMenu);
  resize();
  animate();
}

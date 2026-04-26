import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector<HTMLCanvasElement>('#studio-canvas');
const loader = document.querySelector<HTMLElement>('[data-studio-loader]');

if (canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080a0f');
  scene.fog = new THREE.Fog('#080a0f', 8, 18);

  const baseCameraFov = 58;
  const baseViewportAspect = 16 / 10;
  const baseCameraPosition = new THREE.Vector3(0.05, 1.78, 5.45);
  const baseCameraTarget = new THREE.Vector3(-0.15, 1.45, -1.05);
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
  controls.zoomSpeed = 0.82;
  controls.rotateSpeed = 0.72;
  controls.minDistance = 1.7;
  controls.maxDistance = 7.2;
  controls.maxPolarAngle = Math.PI * 0.54;
  controls.minPolarAngle = Math.PI * 0.36;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

  const interactive: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  const textureLoader = new THREE.TextureLoader();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const cameraGoal = baseCameraPosition.clone();
  const targetGoal = baseCameraTarget.clone();
  const defaultCamera = baseCameraPosition.clone();
  const defaultTarget = baseCameraTarget.clone();
  let isCompactViewport = false;
  let hoveredObject: THREE.Object3D | null = null;
  let pendingPanel: string | null = null;
  let pendingPanelAt = 0;
  let isEnteringScreen = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let transitionStart = 0;
  let transitionDuration = 380;
  let settingsPanelOpen = false;
  let terminalFocused = false;
  let terminalInput = '';
  let lastTerminalCursorVisible = false;
  let currentTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  let currentLanguage = document.documentElement.dataset.language === 'en' || document.documentElement.lang === 'en' ? 'en' : 'es';
  const transitionFromCamera = new THREE.Vector3();
  const transitionFromTarget = new THREE.Vector3();
  const cameraRoomBounds = {
    minX: -3.72,
    maxX: 3.72,
    minY: 0.55,
    maxY: 4.18,
    minZ: -2.78,
    maxZ: 6.55,
  };
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

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

  const makeConcreteFloorTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      const baseGradient = context.createLinearGradient(0, 0, 1024, 512);
      baseGradient.addColorStop(0, '#2a3036');
      baseGradient.addColorStop(0.48, '#3a4249');
      baseGradient.addColorStop(1, '#1f252b');
      context.fillStyle = baseGradient;
      context.fillRect(0, 0, 1024, 512);

      for (let x = 0; x <= 1024; x += 256) {
        context.strokeStyle = 'rgb(255 255 255 / 0.075)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 512);
        context.stroke();
        context.strokeStyle = 'rgb(0 0 0 / 0.18)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 4, 0);
        context.lineTo(x + 4, 512);
        context.stroke();
      }

      for (let y = 0; y <= 512; y += 128) {
        context.strokeStyle = 'rgb(255 255 255 / 0.055)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(1024, y);
        context.stroke();
        context.strokeStyle = 'rgb(0 0 0 / 0.16)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, y + 3);
        context.lineTo(1024, y + 3);
        context.stroke();
      }

      for (let i = 0; i < 220; i += 1) {
        const alpha = 0.025 + Math.random() * 0.075;
        context.fillStyle = Math.random() > 0.5 ? `rgb(255 255 255 / ${alpha})` : `rgb(0 0 0 / ${alpha})`;
        context.fillRect(Math.random() * 1024, Math.random() * 512, 1 + Math.random() * 4, 1 + Math.random() * 3);
      }

      const varnish = context.createLinearGradient(0, 0, 1024, 512);
      varnish.addColorStop(0, 'rgb(103 232 249 / 0.08)');
      varnish.addColorStop(0.58, 'rgb(255 255 255 / 0)');
      varnish.addColorStop(1, 'rgb(0 0 0 / 0.16)');
      context.fillStyle = varnish;
      context.fillRect(0, 0, 1024, 512);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.7, 2.2);
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

  const makeScreenMaterial = (title: string, subtitle: string, accent = '#22d3ee') => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: accent,
    emissiveIntensity: 0.82,
    map: makeScreenTexture(title, subtitle, accent),
    roughness: 0.2,
  });

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#303840', roughness: 0.86, metalness: 0.04, map: makeConcreteFloorTexture() }),
    wall: new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.82, metalness: 0.03, map: makeSlatWallTexture() }),
    sideWall: new THREE.MeshStandardMaterial({ color: '#4a5568', roughness: 0.85 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.88 }),
    desk: new THREE.MeshStandardMaterial({ color: '#8a5438', roughness: 0.58, metalness: 0.08 }),
    deskEdge: new THREE.MeshStandardMaterial({ color: '#4a2a1d', roughness: 0.64, metalness: 0.05 }),
    deskMat: new THREE.MeshStandardMaterial({ color: '#101827', roughness: 0.72, metalness: 0.04 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2a3441', roughness: 0.35, metalness: 0.68 }),
    cable: new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.58, metalness: 0.08 }),
    dark: new THREE.MeshStandardMaterial({ color: '#050811', roughness: 0.65, metalness: 0.15 }),
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
    materials.ceiling.color.set(isLight ? '#d0dce8' : '#0a0f1a');
    materials.floor.color.set(isLight ? '#b8c3cb' : '#303840');
    materials.wall.color.set(isLight ? '#c7d2dc' : '#2b3440');
    materials.sideWall.color.set(isLight ? '#dfe9f2' : '#4a5568');
    materials.floor.roughness = isLight ? 0.8 : 0.86;
    materials.wall.roughness = isLight ? 0.78 : 0.82;
    materials.lightModeCeiling.emissiveIntensity = isLight ? 2.8 : 0.08;
    materials.lightModeCeiling.color.set(isLight ? '#ffffff' : '#d6dde5');
    lightModeCeilingFixtures.forEach((fixture) => {
      fixture.visible = true;
    });
    lightModeCeilingLamps.forEach((lamp) => {
      lamp.intensity = isLight ? 8.5 : 0;
      lamp.distance = isLight ? 7.4 : 3.5;
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
  const leftWall = makeBox('left-wall', [0.16, 4.65, 10.8], [-4, 2.24, 1.9], materials.sideWall);
  const rightWall = makeBox('right-wall', [0.16, 4.65, 10.8], [4, 2.24, 1.9], materials.wall);
  const frontLeftWall = makeBox('front-left-wall', [2.1, 4.65, 0.16], [-2.95, 2.24, 6.85], materials.sideWall);
  const frontRightWall = makeBox('front-right-wall', [2.1, 4.65, 0.16], [2.95, 2.24, 6.85], materials.sideWall);
  const frontCenterWall = makeBox('front-center-wall', [3.9, 3.6, 0.16], [0, 1.75, 6.85], materials.sideWall);
  const frontTopWall = makeBox('front-top-wall', [3.9, 1.05, 0.16], [0, 4.05, 6.85], materials.sideWall);
  
  // Anadir moldura en el techo para mas realismo
  makeBox('ceiling-molding-back', [8, 0.04, 0.08], [0, 4.38, -2.96], materials.metal);
  makeBox('ceiling-molding-left', [0.08, 0.04, 10.8], [-3.96, 4.38, 1.9], materials.metal);
  makeBox('ceiling-molding-right', [0.08, 0.04, 10.8], [3.96, 4.38, 1.9], materials.metal);
  
  room.add(floor, ceiling, backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontCenterWall, frontTopWall);

  makeBox('warm-led-strip', [7.2, 0.06, 0.08], [0, 4.2, -2.88], materials.amber);
  makeBox('ceiling-light', [2.6, 0.06, 0.18], [-0.8, 4.42, -0.82], materials.cyanGlow);
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
  
  // Vigas mejoradas
  makeBox('ceiling-beam-left', [0.12, 0.18, 10.45], [-2.45, 4.34, 1.9], materials.metal);
  makeBox('ceiling-beam-right', [0.12, 0.18, 10.45], [2.45, 4.34, 1.9], materials.metal);
  makeBox('ceiling-beam-back', [7.65, 0.18, 0.12], [0, 4.34, -2.42], materials.metal);
  makeBox('ceiling-beam-front', [7.65, 0.18, 0.12], [0, 4.34, 5.7], materials.metal);
  
  // Vigas laterales para mayor estructuracion
  makeBox('ceiling-beam-left-end', [0.08, 0.12, 0.3], [-3.8, 4.36, 1.9], materials.metal);
  makeBox('ceiling-beam-right-end', [0.08, 0.12, 0.3], [3.8, 4.36, 1.9], materials.metal);

  [
    [-2.15, 4.42, 0.65],
    [0, 4.42, 0.95],
    [2.15, 4.42, 0.65],
  ].forEach((position, index) => {
    const fixture = makeBox(
      `light-mode-ceiling-panel-${index + 1}`,
      [1.16, 0.045, 0.46],
      position as THREE.Vector3Tuple,
      materials.lightModeCeiling,
    );
    lightModeCeilingFixtures.push(fixture);

    const lamp = new THREE.PointLight('#fff7d6', 0, 7.4);
    lamp.name = `light-mode-ceiling-lamp-${index + 1}`;
    lamp.position.set(position[0], 4.06, position[2]);
    scene.add(lamp);
    lightModeCeilingLamps.push(lamp);
  });

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
  makeBox('keyboard', [1.34, 0.08, 0.42], [-0.38, 1.08, 0.08], materials.dark);
  makeBox('mouse-pad', [0.95, 0.025, 0.62], [0.88, 1.045, 0.11], materials.deskMat);
  makeBox('mouse', [0.32, 0.08, 0.24], [1.1, 1.11, 0.09], materials.dark);
  makeBox('mouse-scroll-light', [0.055, 0.02, 0.045], [1.1, 1.165, -0.02], materials.cyanGlow);
  
  for (let i = 0; i < 30; i += 1) {
    makeBox(
      `key-${i}`,
      [0.058, 0.025, 0.052],
      [-0.94 + (i % 10) * 0.115, 1.14, -0.05 + Math.floor(i / 10) * 0.1],
      i % 7 === 0 ? materials.cyanGlow : materials.dark,
    );
  }
  
  // Lampara de escritorio
  makeBox('lamp-base', [0.12, 0.08, 0.12], [-1.65, 1.0, 0.38], materials.metal);
  makeBox('lamp-pole', [0.04, 0.6, 0.04], [-1.65, 1.3, 0.38], materials.metal);
  makeBox('lamp-head-left', [0.08, 0.12, 0.04], [-1.85, 1.74, 0.38], materials.metal);
  makeBox('lamp-head-right', [0.08, 0.12, 0.04], [-1.45, 1.74, 0.38], materials.metal);
  makeBox('lamp-head-top', [0.24, 0.04, 0.12], [-1.65, 1.82, 0.38], materials.metal);
  makeBox('lamp-light', [0.2, 0.08, 0.08], [-1.65, 1.84, 0.38], materials.cyanGlow);
  
  // Pequenos objetos en el escritorio
  makeBox('pencil-cup', [0.18, 0.22, 0.18], [1.72, 1.1, -0.42], materials.metal);
  makeBox('pencil-a', [0.035, 0.28, 0.035], [1.66, 1.24, -0.42], materials.greenGlow);
  makeBox('pencil-b', [0.035, 0.24, 0.035], [1.73, 1.22, -0.35], materials.amber);
  makeBox('desk-note', [0.34, 0.025, 0.22], [1.75, 1.055, 0.06], materials.amber);

  makeBox('pc-case', [0.58, 1.2, 0.72], [2.35, 0.52, -0.55], materials.dark);
  makeBox('pc-glass', [0.5, 0.92, 0.04], [2.35, 0.62, -0.16], materials.glass);
  makeBox('pc-fan-a', [0.28, 0.28, 0.04], [2.35, 0.84, -0.12], materials.cyanGlow);
  makeBox('pc-fan-b', [0.28, 0.28, 0.04], [2.35, 0.38, -0.12], materials.amber);
  // Detalles adicionales de la PC
  makeBox('pc-glow', [0.54, 0.16, 0.06], [2.35, 1.12, -0.12], materials.cyanGlow);
  makeBox('pc-vent', [0.18, 0.32, 0.04], [2.35, 0.2, -0.14], materials.metal);

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
    hit.userData.hover = glow;
    interactive.push(hit);
  };

  makeMonitor('about', '/sobre-mi', -0.98, materials.projectsScreen);
  makeMonitor('portfolio', '/portfolio', 0.88, materials.techScreen);
  makeBox('dual-monitor-arm-pole', [0.09, 0.94, 0.09], [-0.06, 1.48, -1.24], materials.metal);
  makeBox('dual-monitor-arm-clamp', [0.36, 0.12, 0.22], [-0.06, 1.02, -1.22], materials.metal);
  makeBox('dual-monitor-arm-left', [0.98, 0.06, 0.06], [-0.54, 1.82, -1.24], materials.metal);
  makeBox('dual-monitor-arm-right', [0.98, 0.06, 0.06], [0.43, 1.82, -1.24], materials.metal);
  makeBox('dual-monitor-vesa-left', [0.34, 0.26, 0.04], [-0.98, 1.82, -1.18], materials.metal);
  makeBox('dual-monitor-vesa-right', [0.34, 0.26, 0.04], [0.88, 1.82, -1.18], materials.metal);
  makeBox('monitor-cable-left', [0.045, 0.78, 0.045], [-0.7, 1.38, -1.23], materials.cable);
  makeBox('monitor-cable-right', [0.045, 0.78, 0.045], [0.58, 1.38, -1.23], materials.cable);

  
  // Detalles adicionales en las estanterias
  
  
  
  
  const galleryX = -1.22;
  const wallGallery = makeBackWallPlane('wall-photo-gallery', [2.92, 1.66], [galleryX, 2.82, -2.755], materials.galleryPhoto);
  makeBox('wall-gallery-shadow', [3.26, 2.0, 0.035], [galleryX + 0.05, 2.78, -2.92], materials.dark);
  makeBox('wall-gallery-frame-top', [3.18, 0.1, 0.12], [galleryX, 3.72, -2.82], materials.desk);
  makeBox('wall-gallery-frame-bottom', [3.18, 0.1, 0.12], [galleryX, 1.92, -2.82], materials.desk);
  makeBox('wall-gallery-frame-left', [0.1, 1.86, 0.12], [galleryX - 1.59, 2.82, -2.82], materials.desk);
  makeBox('wall-gallery-frame-right', [0.1, 1.86, 0.12], [galleryX + 1.59, 2.82, -2.82], materials.desk);
  makeBox('wall-gallery-inner-top', [2.92, 0.035, 0.06], [galleryX, 3.66, -2.72], materials.cyanGlow);
  makeBox('wall-gallery-inner-bottom', [2.92, 0.035, 0.06], [galleryX, 1.98, -2.72], materials.cyanGlow);
  makeBox('wall-gallery-inner-left', [0.035, 1.66, 0.06], [galleryX - 1.48, 2.82, -2.72], materials.cyanGlow);
  makeBox('wall-gallery-inner-right', [0.035, 1.66, 0.06], [galleryX + 1.48, 2.82, -2.72], materials.cyanGlow);
  makeBox('wall-gallery-caption-light', [1.05, 0.045, 0.05], [galleryX, 1.82, -2.76], materials.cyanGlow);
  wallGallery.userData.isPhotoFrame = true;

  makeBox('books-shelf', [2.3, 0.16, 0.52], [2.05, 3.32, -2.88], materials.desk);
  makeBox('books-shelf-left-bracket', [0.08, 0.42, 0.08], [1.02, 3.08, -2.74], materials.metal);
  makeBox('books-shelf-right-bracket', [0.08, 0.42, 0.08], [3.08, 3.08, -2.74], materials.metal);
  makeBox('book-a', [0.16, 0.58, 0.34], [1.26, 3.72, -2.72], materials.amber);
  makeBox('book-b', [0.16, 0.5, 0.34], [1.48, 3.68, -2.72], materials.greenGlow);
  makeBox('book-c', [0.16, 0.62, 0.34], [1.7, 3.74, -2.72], materials.cyanGlow);
  makeBox('book-d', [0.16, 0.54, 0.34], [1.92, 3.7, -2.72], materials.paper);
  const magazine = makeBackWallPlane('blog-magazine', [0.66, 0.86], [2.58, 3.76, -2.76], materials.magazine);
  const magazineGlow = makeBackWallPlane('blog-magazine-hover', [0.69, 0.89], [2.58, 3.76, -2.72], materials.hover);
  magazineGlow.visible = false;
  const magazineHit = makeBox('blog-magazine-hitbox', [0.84, 1.04, 0.18], [2.58, 3.76, -2.58], materials.hitbox);
  magazineHit.userData.href = '/blog';
  magazineHit.userData.hover = magazineGlow;
  interactive.push(magazineHit);

  makeBox('toys-shelf', [1.9, 0.16, 0.52], [2.35, 2.18, -2.88], materials.desk);
  makeBox('toys-shelf-left-bracket', [0.08, 0.38, 0.08], [1.52, 1.94, -2.74], materials.metal);
  makeBox('toys-shelf-right-bracket', [0.08, 0.38, 0.08], [3.18, 1.94, -2.74], materials.metal);
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

  registerShelfControl('shelf-theme-dark', [2.78, 2.68, -2.62], materials.settingsDark, 'settings:theme:dark');
  registerShelfControl('shelf-theme-light', [3.1, 2.68, -2.62], materials.settingsLight, 'settings:theme:light');
  registerShelfControl('shelf-language-es', [2.78, 2.4, -2.62], materials.settingsEs, 'settings:language:es');
  registerShelfControl('shelf-language-en', [3.1, 2.4, -2.62], materials.settingsEn, 'settings:language:en');

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
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.scale.set(...scale);
    part.castShadow = true;
    part.receiveShadow = true;
    monkey.add(part);
    return part;
  };
  makeMonkeyPart(new THREE.SphereGeometry(0.32, 24, 16), plush, [0, 0.48, 0], [1, 1.08, 0.92]);
  makeMonkeyPart(new THREE.SphereGeometry(0.26, 24, 16), plush, [0, 0.9, 0], [1, 1, 0.9]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 18, 12), plush, [-0.26, 0.92, 0], [1, 1, 0.75]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 18, 12), plush, [0.26, 0.92, 0], [1, 1, 0.75]);
  makeMonkeyPart(new THREE.SphereGeometry(0.17, 18, 12), plushFace, [0, 0.84, 0.2], [1.1, 0.72, 0.42]);
  makeMonkeyPart(new THREE.SphereGeometry(0.034, 12, 8), plushDark, [-0.09, 0.93, 0.26], [1, 1, 1]);
  makeMonkeyPart(new THREE.SphereGeometry(0.034, 12, 8), plushDark, [0.09, 0.93, 0.26], [1, 1, 1]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 16, 10), plush, [-0.34, 0.4, 0.02], [0.55, 1.8, 0.5]);
  makeMonkeyPart(new THREE.SphereGeometry(0.12, 16, 10), plush, [0.34, 0.4, 0.02], [0.55, 1.8, 0.5]);
  monkey.position.set(2.22, 2.15, -2.63);
  monkey.rotation.y = -0.18;
  monkey.scale.set(0.5, 0.5, 0.5);
  scene.add(monkey);
  const monkeyHit = makeBox('monkey-hitbox', [0.72, 0.86, 0.32], [2.22, 2.58, -2.28], materials.hitbox);
  monkeyHit.userData.href = '/easter-egg';
  monkeyHit.userData.isMonkey = true;
  interactive.push(monkeyHit);

  scene.add(new THREE.HemisphereLight('#e8f4f8', '#0a0e16', 1.35));

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
    isEnteringScreen = false;
    transitionStart = performance.now();
    transitionDuration = 520;
    transitionFromCamera.copy(camera.position);
    transitionFromTarget.copy(controls.target);
    cameraGoal.copy(defaultCamera);
    targetGoal.copy(defaultTarget);
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  canvas.addEventListener('pointermove', (event) => {
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
        terminalFocused = true;
        renderTerminalTexture();
        return;
      }

      terminalFocused = false;
      renderTerminalTexture();

      if (action === 'settings:toggle') {
        setSettingsPanelOpen(!settingsPanelOpen);
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
      terminalFocused = false;
      renderTerminalTexture();
      window.location.href = href;
      return;
    }

    const target = hit?.object.userData.target;

    if (typeof target === 'string') {
      terminalFocused = false;
      renderTerminalTexture();
      setCameraTarget(target);
      return;
    }
  };

  canvas.addEventListener('pointerup', activateScreenFromPointer);

  window.addEventListener('keydown', (event) => {
    if (!terminalFocused) {
      return;
    }

    if (event.key === 'Escape') {
      terminalFocused = false;
      renderTerminalTexture();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Enter') {
      const command = terminalInput;
      terminalInput = '';
      runTerminalCommand(command);
      event.preventDefault();
      return;
    }

    if (event.key === 'Backspace') {
      terminalInput = terminalInput.slice(0, -1);
      renderTerminalTexture();
      event.preventDefault();
      return;
    }

    if (event.key.length === 1 && terminalInput.length < 44) {
      terminalInput += event.key;
      renderTerminalTexture();
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
    const distanceScale = 1 + compactAmount * 0.62;
    const targetLift = compactAmount * 0.06;
    const cameraOffset = baseCameraPosition.clone().sub(baseCameraTarget).multiplyScalar(distanceScale);

    isCompactViewport = compactAmount > 0.08;
    defaultTarget.copy(baseCameraTarget).add(new THREE.Vector3(0, targetLift, 0));
    defaultCamera.copy(defaultTarget).add(cameraOffset);

    if (!isEnteringScreen && !pendingPanel) {
      cameraGoal.copy(defaultCamera);
      targetGoal.copy(defaultTarget);
    }

    camera.aspect = aspect;
    camera.fov = baseCameraFov + compactAmount * 20;
    camera.updateProjectionMatrix();
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minDistance = isCompactViewport ? 2.65 : 1.7;
    controls.maxDistance = isCompactViewport ? 6.65 : 7.2;
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
    const monkeyHoverAmount = hoveredObject?.userData.isMonkey ? (0.42 + Math.sin(elapsed * 5.2) * 0.18) : 0;
    plush.color.copy(monkeyBaseColor).lerp(monkeyHoverColor, monkeyHoverAmount);
    plush.emissive.copy(monkeyHoverColor).multiplyScalar(monkeyHoverAmount * 0.45);
    plush.emissiveIntensity = monkeyHoverAmount;
    plushFace.color.copy(monkeyFaceBaseColor).lerp(monkeyFaceHoverColor, monkeyHoverAmount * 0.75);
    
    // Luces dinamicas mas realistas
    cyanLight.intensity = 16 + Math.sin(elapsed * 1.5) * 2.5;
    amberLight.intensity = 10 + Math.sin(elapsed * 1.2) * 1.8;
    deskKeyLight.intensity = 4.5 + Math.sin(elapsed * 0.8) * 1.2;

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

    if (pendingPanel && performance.now() >= pendingPanelAt) {
      window.dispatchEvent(new CustomEvent('studio:open-panel', { detail: pendingPanel }));
      pendingPanel = null;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resize);
  window.addEventListener('studio:exit-screen', resetCamera);
  resize();
  loader?.classList.add('is-hidden');
  animate();
}

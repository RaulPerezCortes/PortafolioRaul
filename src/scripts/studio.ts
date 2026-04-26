import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector<HTMLCanvasElement>('#studio-canvas');
const loader = document.querySelector<HTMLElement>('[data-studio-loader]');

if (canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080a0f');
  scene.fog = new THREE.Fog('#080a0f', 8, 18);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0.05, 1.78, 5.45);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-0.15, 1.45, -1.05);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 1.7;
  controls.maxDistance = 7.2;
  controls.maxPolarAngle = Math.PI * 0.54;
  controls.minPolarAngle = Math.PI * 0.36;
  controls.minAzimuthAngle = -Math.PI * 0.20;
  controls.maxAzimuthAngle = Math.PI * 0.20;

  const interactive: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  const textureLoader = new THREE.TextureLoader();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const cameraGoal = new THREE.Vector3(0.05, 1.78, 5.45);
  const targetGoal = new THREE.Vector3(-0.15, 1.45, -1.05);
  const defaultCamera = new THREE.Vector3(0.05, 1.78, 5.45);
  const defaultTarget = new THREE.Vector3(-0.15, 1.45, -1.05);
  let hoveredObject: THREE.Object3D | null = null;
  let pendingPanel: string | null = null;
  let pendingPanelAt = 0;
  let isEnteringScreen = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let transitionStart = 0;
  let transitionDuration = 380;
  const transitionFromCamera = new THREE.Vector3();
  const transitionFromTarget = new THREE.Vector3();

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

  const makeBrickTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.fillStyle = '#7a3329';
      context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      for (let y = 0; y < 512; y += 64) {
        const offset = (y / 64) % 2 === 0 ? 0 : 96;
        for (let x = -offset; x < 1024; x += 192) {
          const brickGradient = context.createLinearGradient(x, y, x + 192, y + 64);
          brickGradient.addColorStop(0, '#9f4b39');
          brickGradient.addColorStop(0.58, '#743327');
          brickGradient.addColorStop(1, '#b25c45');
          context.fillStyle = brickGradient;
          context.fillRect(x + 4, y + 4, 184, 56);
          context.strokeStyle = '#3f1f1a';
          context.lineWidth = 5;
          context.strokeRect(x + 4, y + 4, 184, 56);
        }
      }
      context.fillStyle = 'rgb(0 0 0 / 0.18)';
      context.fillRect(0, 0, 1024, 512);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 2);
    return texture;
  };

  const makeWoodTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');

    if (context) {
      context.fillStyle = '#6b3f2a';
      context.fillRect(0, 0, 1024, 512);
      for (let x = 0; x < 1024; x += 128) {
        const plank = context.createLinearGradient(x, 0, x + 128, 0);
        plank.addColorStop(0, '#4d2c1d');
        plank.addColorStop(0.5, '#8a5435');
        plank.addColorStop(1, '#5b3422');
        context.fillStyle = plank;
        context.fillRect(x, 0, 122, 512);
        context.strokeStyle = '#2f1b12';
        context.lineWidth = 5;
        context.strokeRect(x, 0, 122, 512);
        for (let y = 16; y < 512; y += 28) {
          context.strokeStyle = 'rgb(255 255 255 / 0.05)';
          context.beginPath();
          context.moveTo(x + 12, y + Math.sin(y) * 4);
          context.bezierCurveTo(x + 42, y + 10, x + 82, y - 12, x + 116, y + 2);
          context.stroke();
        }
      }
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
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
    textureCanvas.width = 768;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');
    const palettes = [
      ['#0f172a', '#22d3ee', '#f8fafc'],
      ['#1f2937', '#f59e0b', '#fef3c7'],
      ['#064e3b', '#34d399', '#ecfdf5'],
      ['#3b0764', '#c084fc', '#faf5ff'],
    ];
    const palette = palettes[index % palettes.length];

    if (context) {
      const gradient = context.createLinearGradient(0, 0, 768, 512);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(1, palette[1]);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 768, 512);
      context.fillStyle = 'rgb(255 255 255 / 0.92)';
      context.fillRect(42, 42, 684, 428);
      context.fillStyle = palette[0];
      context.fillRect(66, 66, 636, 338);
      context.fillStyle = palette[1];
      context.beginPath();
      context.arc(384, 204, 88, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette[2];
      context.font = '900 46px Arial';
      context.textAlign = 'center';
      context.fillText(`FOTO ${index + 1}`, 384, 442);
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
    floor: new THREE.MeshStandardMaterial({ color: '#7c4a2d', roughness: 0.68, metalness: 0.04, map: makeWoodTexture() }),
    wall: new THREE.MeshStandardMaterial({ color: '#9f4b39', roughness: 0.84, map: makeBrickTexture() }),
    sideWall: new THREE.MeshStandardMaterial({ color: '#a06b67', roughness: 0.84 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#101827', roughness: 0.86 }),
    desk: new THREE.MeshStandardMaterial({ color: '#7c4a2d', roughness: 0.62 }),
    metal: new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.42, metalness: 0.36 }),
    dark: new THREE.MeshStandardMaterial({ color: '#070b12', roughness: 0.58 }),
    projectsScreen: makeScreenMaterial('PROYECTOS', 'ABRIR PANTALLA', '#22d3ee'),
    techScreen: makeScreenMaterial('TECNOLOGIAS', 'ABRIR STACK', '#34d399'),
    contactScreen: makeScreenMaterial('CONTACTO', 'ENVIAR EMAIL', '#f59e0b'),
    amber: new THREE.MeshStandardMaterial({
      color: '#b45309',
      emissive: '#f59e0b',
      emissiveIntensity: 1.7,
      roughness: 0.35,
    }),
    paper: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 }),
    plant: new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.7 }),
    bedding: new THREE.MeshStandardMaterial({ color: '#c7b6a5', roughness: 0.88 }),
    blanket: new THREE.MeshStandardMaterial({ color: '#3f3a36', roughness: 0.82 }),
    pillow: new THREE.MeshStandardMaterial({ color: '#f2eee8', roughness: 0.78 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#9bdcff',
      emissive: '#38bdf8',
      emissiveIntensity: 0.28,
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.68,
    }),
    cork: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, map: makeCorkTexture() }),
    photoFrame: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.36, map: makePhotoTexture(0), roughness: 0.32 }),
    hitbox: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    hover: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };

  const screenCopy = {
    es: {
      projects: ['PROYECTOS', 'ABRIR PANTALLA'],
      tech: ['TECNOLOGIAS', 'ABRIR STACK'],
      contact: ['CONTACTO', 'ENVIAR EMAIL'],
    },
    en: {
      projects: ['PROJECTS', 'OPEN SCREEN'],
      tech: ['TECH STACK', 'OPEN STACK'],
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

  const applyStudioLanguage = (language: string) => {
    const copy = language === 'en' ? screenCopy.en : screenCopy.es;
    setScreenTexture(materials.projectsScreen, copy.projects[0], copy.projects[1], '#22d3ee');
    setScreenTexture(materials.techScreen, copy.tech[0], copy.tech[1], '#34d399');
    setScreenTexture(materials.contactScreen, copy.contact[0], copy.contact[1], '#f59e0b');
  };

  const applyStudioTheme = (theme: string) => {
    const isLight = theme === 'light';
    const background = isLight ? '#e8edf2' : '#080a0f';
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(background, isLight ? 9 : 8, isLight ? 20 : 18);
    materials.ceiling.color.set(isLight ? '#d7dde5' : '#101827');
    materials.sideWall.color.set(isLight ? '#d9a7a1' : '#a06b67');
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

  const room = new THREE.Group();
  scene.add(room);

  const floor = makeBox('floor', [8, 0.16, 10.8], [0, -0.08, 1.9], materials.floor);
  const ceiling = makeBox('ceiling', [8, 0.16, 10.8], [0, 4.55, 1.9], materials.ceiling);
  const backWall = makeBox('back-wall', [8, 4.65, 0.16], [0, 2.24, -3.05], materials.wall);
  const leftWall = makeBox('left-wall', [0.16, 4.65, 10.8], [-4, 2.24, 1.9], materials.sideWall);
  const rightWall = makeBox('right-wall', [0.16, 4.65, 10.8], [4, 2.24, 1.9], materials.wall);
  const frontLeftWall = makeBox('front-left-wall', [2.1, 4.65, 0.16], [-2.95, 2.24, 6.85], materials.sideWall);
  const frontRightWall = makeBox('front-right-wall', [2.1, 4.65, 0.16], [2.95, 2.24, 6.85], materials.sideWall);
  const frontTopWall = makeBox('front-top-wall', [3.9, 1.05, 0.16], [0, 4.05, 6.85], materials.sideWall);
  room.add(floor, ceiling, backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontTopWall);

  makeBox('warm-led-strip', [7.2, 0.06, 0.08], [0, 4.2, -2.88], materials.amber);
  makeBox('ceiling-light', [2.6, 0.06, 0.18], [-0.8, 4.42, -0.82], materials.projectsScreen);
  makeBox('ceiling-beam-left', [0.12, 0.18, 10.45], [-2.45, 4.34, 1.9], materials.metal);
  makeBox('ceiling-beam-right', [0.12, 0.18, 10.45], [2.45, 4.34, 1.9], materials.metal);
  makeBox('ceiling-beam-back', [7.65, 0.18, 0.12], [0, 4.34, -2.42], materials.metal);
  makeBox('ceiling-beam-front', [7.65, 0.18, 0.12], [0, 4.34, 5.7], materials.metal);

  makeBox('desk-top', [4.3, 0.22, 1.6], [0, 0.92, -0.55], materials.desk);
  makeBox('desk-left-leg', [0.18, 0.92, 0.18], [-1.85, 0.43, 0.06], materials.metal);
  makeBox('desk-right-leg', [0.18, 0.92, 0.18], [1.85, 0.43, 0.06], materials.metal);
  makeBox('keyboard', [1.25, 0.08, 0.36], [-0.35, 1.08, 0.12], materials.dark);
  makeBox('mouse', [0.34, 0.08, 0.24], [1.1, 1.08, 0.12], materials.dark);
  for (let i = 0; i < 15; i += 1) {
    makeBox(`key-${i}`, [0.055, 0.025, 0.055], [-0.86 + (i % 5) * 0.12, 1.14, 0.02 + Math.floor(i / 5) * 0.1], i % 3 === 0 ? materials.projectsScreen : materials.dark);
  }

  makeBox('pc-case', [0.58, 1.2, 0.72], [2.35, 0.52, -0.55], materials.dark);
  makeBox('pc-glass', [0.5, 0.92, 0.04], [2.35, 0.62, -0.16], materials.glass);
  makeBox('pc-fan-a', [0.28, 0.28, 0.04], [2.35, 0.84, -0.12], materials.projectsScreen);
  makeBox('pc-fan-b', [0.28, 0.28, 0.04], [2.35, 0.38, -0.12], materials.contactScreen);

  makeBox('bed-base', [2.2, 0.36, 2.45], [-2.85, 0.28, 1.35], materials.dark);
  makeBox('mattress', [2.08, 0.28, 2.3], [-2.85, 0.62, 1.35], materials.bedding);
  makeBox('blanket', [2.12, 0.12, 1.4], [-2.85, 0.84, 1.78], materials.blanket);
  makeBox('pillow-left', [0.74, 0.18, 0.5], [-3.28, 0.86, 0.34], materials.pillow);
  makeBox('pillow-right', [0.74, 0.18, 0.5], [-2.46, 0.86, 0.34], materials.pillow);
  makeBox('rug', [2.6, 0.035, 1.45], [-0.7, 0.01, 1.48], materials.bedding);

  makeBox('window-frame', [1.82, 1.72, 0.1], [-3.92, 2.28, 2.08], materials.dark);
  makeBox('window-glass', [1.54, 1.44, 0.05], [-3.86, 2.28, 2.08], materials.glass);
  makeBox('window-cross-v', [0.06, 1.5, 0.08], [-3.78, 2.28, 2.08], materials.dark);
  makeBox('window-cross-h', [1.58, 0.06, 0.08], [-3.78, 2.28, 2.08], materials.dark);

  const monitor = new THREE.Group();
  monitor.name = 'projects';
  const monitorFrame = makeBox('monitor-frame', [1.9, 1.18, 0.12], [-0.38, 1.8, -1.08], materials.dark);
  const monitorScreen = makeBox('monitor-screen', [1.68, 0.92, 0.04], [-0.38, 1.82, -1.0], materials.projectsScreen);
  const monitorGlow = makeBox('monitor-hover', [1.76, 1, 0.035], [-0.38, 1.82, -0.965], materials.hover);
  const monitorStand = makeBox('monitor-stand', [0.18, 0.62, 0.16], [-0.38, 1.27, -1.08], materials.metal);
  monitorGlow.visible = false;
  monitor.add(monitorFrame, monitorScreen, monitorStand, monitorGlow);
  scene.add(monitor);
  const monitorHit = makeBox('monitor-hitbox', [2.18, 1.44, 0.18], [-0.38, 1.82, -0.82], materials.hitbox);
  monitorHit.userData.target = 'projects';
  monitorHit.userData.hover = monitorGlow;
  interactive.push(monitorHit);

  const leftDeskScreen = makeBox('left-desk-screen', [1.22, 0.76, 0.05], [-1.64, 1.72, -1.02], materials.techScreen);
  const leftDeskGlow = makeBox('left-desk-hover', [1.3, 0.84, 0.035], [-1.64, 1.72, -0.97], materials.hover);
  leftDeskGlow.visible = false;
  const leftDeskHit = makeBox('left-desk-hitbox', [1.42, 0.96, 0.18], [-1.64, 1.72, -0.8], materials.hitbox);
  leftDeskHit.userData.target = 'tech';
  leftDeskHit.userData.hover = leftDeskGlow;
  interactive.push(leftDeskHit, leftDeskScreen);
  leftDeskScreen.userData.target = 'tech';
  leftDeskScreen.userData.hover = leftDeskGlow;

  const rightDeskScreen = makeBox('right-desk-screen', [1.22, 0.76, 0.05], [0.92, 1.72, -1.02], materials.contactScreen);
  const rightDeskGlow = makeBox('right-desk-hover', [1.3, 0.84, 0.035], [0.92, 1.72, -0.97], materials.hover);
  rightDeskGlow.visible = false;
  const rightDeskHit = makeBox('right-desk-hitbox', [1.42, 0.96, 0.18], [0.92, 1.72, -0.8], materials.hitbox);
  rightDeskHit.userData.target = 'contact';
  rightDeskHit.userData.hover = rightDeskGlow;
  interactive.push(rightDeskHit, rightDeskScreen);
  rightDeskScreen.userData.target = 'contact';
  rightDeskScreen.userData.hover = rightDeskGlow;

  const laptop = new THREE.Group();
  laptop.name = 'contact';
  const laptopBase = makeBox('laptop-base', [1.42, 0.08, 0.9], [1.12, 1.11, -0.25], materials.metal);
  const laptopScreen = makeBox('laptop-screen', [1.36, 0.78, 0.06], [1.12, 1.5, -0.62], materials.contactScreen);
  const laptopGlow = makeBox('laptop-hover', [1.44, 0.86, 0.035], [1.12, 1.5, -0.57], materials.hover);
  laptopScreen.rotation.x = -0.22;
  laptopGlow.rotation.x = -0.22;
  laptopGlow.visible = false;
  laptop.add(laptopBase, laptopScreen, laptopGlow);
  scene.add(laptop);
  const laptopHit = makeBox('laptop-hitbox', [1.72, 1.08, 0.18], [1.12, 1.48, -0.34], materials.hitbox);
  laptopHit.userData.target = 'contact';
  laptopHit.userData.hover = laptopGlow;
  interactive.push(laptopHit);

  makeBox('shelf-long', [2.7, 0.16, 0.55], [-1.0, 2.96, -2.88], materials.desk);
  makeBox('shelf', [2.25, 0.16, 0.55], [1.9, 2.82, -2.88], materials.metal);
  makeBox('speaker-left', [0.28, 0.48, 0.28], [-2.0, 1.34, -1.02], materials.dark);
  makeBox('speaker-right', [0.28, 0.48, 0.28], [1.72, 1.34, -1.02], materials.dark);
  makeBox('camera-box', [0.42, 0.26, 0.28], [-1.66, 3.2, -2.72], materials.dark);
  makeBox('lens', [0.16, 0.16, 0.05], [-1.66, 3.2, -2.52], materials.glass);
  makeBox('storage-box-a', [0.54, 0.34, 0.42], [-0.98, 3.22, -2.72], materials.paper);
  makeBox('storage-box-b', [0.48, 0.28, 0.38], [-0.38, 3.18, -2.72], materials.dark);
  makeBox('book-a', [0.16, 0.58, 0.34], [1.1, 3.2, -2.72], materials.amber);
  makeBox('book-b', [0.16, 0.48, 0.34], [1.32, 3.15, -2.72], materials.projectsScreen);
  makeBox('book-c', [0.16, 0.54, 0.34], [1.55, 3.18, -2.72], materials.contactScreen);
  const techScreen = makeBox('tech-screen', [1.85, 0.72, 0.05], [1.75, 3.5, -2.76], materials.techScreen);
  const techGlow = makeBox('tech-hover', [1.95, 0.82, 0.035], [1.75, 3.5, -2.72], materials.hover);
  techGlow.visible = false;
  const shelfHit = makeBox('tech-hitbox', [2.05, 1.08, 0.2], [1.75, 3.42, -2.55], materials.hitbox);
  shelfHit.userData.target = 'tech';
  shelfHit.userData.hover = techGlow;
  interactive.push(shelfHit, techScreen);
  techScreen.userData.target = 'tech';
  techScreen.userData.hover = techGlow;

  makeBox('cork-board', [1.78, 1.2, 0.05], [2.72, 3.05, -2.86], materials.cork);
  makeBox('cork-frame-top', [1.9, 0.08, 0.1], [2.72, 3.68, -2.82], materials.desk);
  makeBox('cork-frame-bottom', [1.9, 0.08, 0.1], [2.72, 2.42, -2.82], materials.desk);
  makeBox('cork-frame-left', [0.08, 1.26, 0.1], [1.77, 3.05, -2.82], materials.desk);
  makeBox('cork-frame-right', [0.08, 1.26, 0.1], [3.67, 3.05, -2.82], materials.desk);

  const photoFrame = makeBox('personal-photo-frame', [1.12, 0.78, 0.08], [2.74, 1.92, -2.84], materials.photoFrame);
  makeBox('personal-photo-outer-frame', [1.28, 0.94, 0.06], [2.74, 1.92, -2.88], materials.dark);
  makeBox('photo-caption-light', [0.52, 0.05, 0.05], [2.74, 1.42, -2.78], materials.projectsScreen);
  photoFrame.userData.isPhotoFrame = true;

  const plantPot = makeBox('plant-pot', [0.42, 0.34, 0.42], [-2.8, 0.28, -1.85], materials.amber);
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), materials.plant);
    leaf.position.set(-2.8 + Math.cos(i) * 0.34, 0.68 + (i % 3) * 0.12, -1.85 + Math.sin(i * 1.7) * 0.26);
    leaf.scale.set(1, 0.34, 0.72);
    leaf.castShadow = true;
    scene.add(leaf);
  }
  plantPot.castShadow = true;

  makeBox('neon-top', [2.25, 0.08, 0.08], [-1.72, 3.22, -2.88], materials.projectsScreen);
  makeBox('neon-side', [0.08, 1.15, 0.08], [-3.26, 1.88, -2.86], materials.amber);
  makeBox('poster', [1.08, 0.76, 0.04], [-2.2, 2.42, -2.92], materials.dark);
  makeBox('poster-glow', [0.86, 0.1, 0.05], [-2.2, 2.52, -2.86], materials.amber);

  scene.add(new THREE.HemisphereLight('#e0f2fe', '#0f172a', 1.25));

  const keyLight = new THREE.DirectionalLight('#ffffff', 2.6);
  keyLight.position.set(2.8, 5.4, 3.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const cyanLight = new THREE.PointLight('#22d3ee', 16, 7);
  cyanLight.position.set(-1.3, 2.6, -1.2);
  scene.add(cyanLight);

  const amberLight = new THREE.PointLight('#f59e0b', 8, 5);
  amberLight.position.set(-3.2, 1.8, -1.7);
  scene.add(amberLight);

  const windowLight = new THREE.PointLight('#bae6fd', 5, 5);
  windowLight.position.set(-3.2, 2.45, 2.4);
  scene.add(windowLight);

  let photoIndex = 0;
  let lastPhotoChange = 0;
  const photoTextures = [0, 1, 2, 3].map((index) => makePhotoTexture(index));

  photoTextures.forEach((_, index) => {
    textureLoader.load(
      `/photos/photo-${index + 1}.jpg`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        photoTextures[index].dispose();
        photoTextures[index] = texture;
        if (index === photoIndex) {
          materials.photoFrame.map = texture;
          materials.photoFrame.needsUpdate = true;
        }
      },
      undefined,
      () => undefined,
    );
  });

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
      cameraGoal.set(1.78, 3.5, -1.92);
      targetGoal.set(1.75, 3.5, -2.78);
      pendingPanel = 'tech';
      pendingPanelAt = transitionStart + transitionDuration + 90;
      return;
    }

    cameraGoal.set(1.12, 1.5, 0.08);
    targetGoal.set(1.12, 1.5, -0.64);
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
    const hit = raycaster.intersectObjects(interactive, false)[0];
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
    const hit = raycaster.intersectObjects(interactive, false)[0];
    const target = hit?.object.userData.target;

    if (typeof target === 'string') {
      setCameraTarget(target);
      return;
    }
  };

  canvas.addEventListener('pointerup', activateScreenFromPointer);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) {
      return;
    }

    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const animate = () => {
    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();
    materials.projectsScreen.emissiveIntensity = 0.8 + Math.sin(elapsed * 2.1) * 0.12;
    materials.contactScreen.emissiveIntensity = 0.78 + Math.sin(elapsed * 2.6 + 1.2) * 0.12;
    materials.techScreen.emissiveIntensity = 0.78 + Math.sin(elapsed * 2.3 + 0.5) * 0.12;
    cyanLight.intensity = 14 + Math.sin(elapsed * 1.5) * 2;
    amberLight.intensity = 8 + Math.sin(elapsed * 1.2) * 1.5;

    if (elapsed - lastPhotoChange > 3.2) {
      photoIndex = (photoIndex + 1) % 4;
      materials.photoFrame.map = photoTextures[photoIndex];
      materials.photoFrame.needsUpdate = true;
      lastPhotoChange = elapsed;
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

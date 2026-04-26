import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector<HTMLCanvasElement>('#studio-canvas');
const loader = document.querySelector<HTMLElement>('[data-studio-loader]');

if (canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080a0f');
  scene.fog = new THREE.Fog('#080a0f', 8, 18);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0.2, 1.62, 4.5);

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
  controls.target.set(0.1, 1.32, -0.92);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 1.35;
  controls.maxDistance = 6.5;
  controls.maxPolarAngle = Math.PI * 0.54;
  controls.minPolarAngle = Math.PI * 0.36;
  controls.minAzimuthAngle = -Math.PI * 0.20;
  controls.maxAzimuthAngle = Math.PI * 0.20;

  const interactive: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const cameraGoal = new THREE.Vector3(0.2, 1.62, 2.94);
  const targetGoal = new THREE.Vector3(0.1, 1.32, -0.92);
  const defaultCamera = new THREE.Vector3(0.2, 1.62, 2.94);
  const defaultTarget = new THREE.Vector3(0.1, 1.32, -0.92);
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

  const makeScreenMaterial = (title: string, subtitle: string, accent = '#22d3ee') => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: accent,
    emissiveIntensity: 0.82,
    map: makeScreenTexture(title, subtitle, accent),
    roughness: 0.2,
  });

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.72, metalness: 0.05 }),
    wall: new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.84 }),
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
  const leftWall = makeBox('left-wall', [0.16, 4.65, 10.8], [-4, 2.24, 1.9], materials.wall);
  const rightWall = makeBox('right-wall', [0.16, 4.65, 10.8], [4, 2.24, 1.9], materials.wall);
  const frontLeftWall = makeBox('front-left-wall', [2.1, 4.65, 0.16], [-2.95, 2.24, 6.85], materials.wall);
  const frontRightWall = makeBox('front-right-wall', [2.1, 4.65, 0.16], [2.95, 2.24, 6.85], materials.wall);
  const frontTopWall = makeBox('front-top-wall', [3.9, 1.05, 0.16], [0, 4.05, 6.85], materials.wall);
  room.add(floor, ceiling, backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontTopWall);

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

  makeBox('shelf', [2.25, 0.16, 0.55], [1.9, 2.82, -2.88], materials.metal);
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

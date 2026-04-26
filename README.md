# Portafolio 3D

Portfolio en Astro con una habitacion 3D interactiva construida con Three.js.

## Scripts

```sh
npm install
npm run dev
npm run build
```

## Estructura

```text
src/
  components/ScreenPanels.astro
  data/portfolio.ts
  pages/index.astro
  scripts/panels.ts
  scripts/studio.ts
  styles/global.css
```

## Notas

- `studio.ts` construye la habitacion 3D y gestiona camara, hover y clicks.
- `panels.ts` abre y cierra las pantallas de contenido.
- `portfolio.ts` contiene proyectos y tecnologias.

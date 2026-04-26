export interface Project {
  title: string;
  description: string;
  image: string;
}

export const technologies = [
  'Astro',
  'TypeScript',
  'Tailwind CSS',
  'React',
  'Node.js',
  'Next.js',
  'PostgreSQL',
  'Git',
  'API REST',
];

export const secondaryTechnologies = [
  'HTML',
  'CSS',
  'JavaScript',
  'Vite',
  'Figma',
  'Supabase',
  'Prisma',
  'Docker',
  'Testing',
];

export const projects = [
  {
    title: 'Dashboard SaaS',
    description: 'Panel operativo con metricas, filtros y gestion de usuarios.',
    image: '/photos/photo-1.jpeg',
  },
  {
    title: 'Ecommerce',
    description: 'Catalogo rapido con checkout y administracion de productos.',
    image: '/photos/photo-2.jpeg',
  },
  {
    title: 'App de tareas',
    description: 'Flujos simples, estados claros y persistencia local.',
    image: '/photos/photo-3.jpeg',
  },
  {
    title: 'Landing tecnica',
    description: 'Pagina enfocada en conversion con rendimiento alto.',
    image: '/photos/photo-1.jpeg',
  },
];

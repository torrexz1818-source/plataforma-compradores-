import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  company: string;
  position: string;
  sector?: string;
  location?: string;
  description?: string;
  role: UserRole;
  status: UserStatus;
  points: number;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type SeedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SeedPost = {
  id: string;
  authorId: string;
  categoryId: string;
  title: string;
  description: string;
  type: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
  shares: number;
  likedBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type SeedComment = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  likedBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type SeedLessonProgress = {
  id: string;
  postId: string;
  userId: string;
  progress: number;
  duration: string;
};

export const seedUsers: SeedUser[] = [
  {
    id: 'user-buyer-1',
    email: 'maria@empresa.com',
    password: 'Comprador123!',
    fullName: 'Maria Garcia',
    company: 'TechCorp',
    position: 'Procurement Manager',
    sector: 'Tecnologia',
    location: 'Lima, Peru',
    description: 'Buscamos proveedores de software B2B y servicios cloud.',
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 1250,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'user-admin-1',
    email: 'admin@supplyconnect.com',
    password: 'Admin12345!',
    fullName: 'Administrador General',
    company: 'SupplyConnect',
    position: 'Administrador de plataforma',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    points: 5400,
    createdAt: '2023-06-01T00:00:00.000Z',
    updatedAt: '2023-06-01T00:00:00.000Z',
  },
  {
    id: 'user-buyer-2',
    email: 'ana@globalinc.com',
    password: 'Comprador123!',
    fullName: 'Ana Rodriguez',
    company: 'Global Inc.',
    position: 'Senior Buyer',
    sector: 'Manufactura',
    location: 'Monterrey, Mexico',
    description: 'Compras recurrentes de insumos industriales y logistica.',
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 890,
    createdAt: '2024-03-10T00:00:00.000Z',
    updatedAt: '2024-03-10T00:00:00.000Z',
  },
  {
    id: 'user-buyer-3',
    email: 'roberto@indmex.com',
    password: 'Comprador123!',
    fullName: 'Roberto Silva',
    company: 'Industrial MX',
    position: 'Procurement Director',
    sector: 'Construccion',
    location: 'Arequipa, Peru',
    description: 'Interesados en proveedores de maquinaria y seguridad industrial.',
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 2100,
    createdAt: '2023-11-20T00:00:00.000Z',
    updatedAt: '2023-11-20T00:00:00.000Z',
  },
];

export const seedCategories: SeedCategory[] = [
  { id: 'cat-1', name: 'Tips', slug: 'tips' },
  { id: 'cat-2', name: 'Recomendacion', slug: 'recomendacion' },
  { id: 'cat-3', name: 'Experiencia', slug: 'experiencia' },
  { id: 'cat-4', name: 'Pregunta', slug: 'pregunta' },
];

export const seedPosts: SeedPost[] = [
  {
    id: 'e1',
    authorId: 'user-admin-1',
    categoryId: 'cat-1',
    title: 'Negociacion Estrategica con Proveedores',
    description:
      'Aprende las tecnicas mas efectivas para negociar contratos con proveedores, desde la preparacion hasta el cierre del acuerdo.',
    type: 'educational',
    videoUrl: 'https://example.com/video1',
    thumbnailUrl: '',
    shares: 18,
    likedBy: ['user-buyer-2', 'user-buyer-3'],
    createdAt: '2025-03-14T00:00:00.000Z',
    updatedAt: '2025-03-14T00:00:00.000Z',
  },
  {
    id: 'e2',
    authorId: 'user-admin-1',
    categoryId: 'cat-1',
    title: 'Gestion de Riesgos en la Cadena de Suministro',
    description:
      'Descubre como identificar, evaluar y mitigar riesgos en tu cadena de suministro para garantizar la continuidad del negocio.',
    type: 'educational',
    videoUrl: 'https://example.com/video2',
    thumbnailUrl: '',
    shares: 12,
    likedBy: ['user-buyer-1'],
    createdAt: '2025-03-12T00:00:00.000Z',
    updatedAt: '2025-03-12T00:00:00.000Z',
  },
  {
    id: 'e3',
    authorId: 'user-admin-1',
    categoryId: 'cat-1',
    title: 'KPIs Esenciales para Compradores B2B',
    description:
      'Los indicadores clave que todo profesional de compras debe monitorear para optimizar su rendimiento y demostrar valor al negocio.',
    type: 'educational',
    videoUrl: 'https://example.com/video3',
    thumbnailUrl: '',
    shares: 9,
    likedBy: [],
    createdAt: '2025-03-10T00:00:00.000Z',
    updatedAt: '2025-03-10T00:00:00.000Z',
  },
  {
    id: 'c1',
    authorId: 'user-buyer-2',
    categoryId: 'cat-3',
    title: 'Mi experiencia migrando de proveedores locales a internacionales',
    description:
      'Despues de 6 meses de transicion, quiero compartir los retos y aprendizajes de migrar nuestra base de proveedores.',
    type: 'community',
    shares: 5,
    likedBy: ['user-buyer-1'],
    createdAt: '2025-03-15T00:00:00.000Z',
    updatedAt: '2025-03-15T00:00:00.000Z',
  },
  {
    id: 'c2',
    authorId: 'user-buyer-3',
    categoryId: 'cat-4',
    title: 'Que ERP recomiendan para gestion de compras?',
    description:
      'Estamos evaluando migrar nuestro sistema de gestion de compras. Actualmente usamos hojas de calculo y necesitamos algo mas robusto.',
    type: 'community',
    shares: 2,
    likedBy: [],
    createdAt: '2025-03-14T00:00:00.000Z',
    updatedAt: '2025-03-14T00:00:00.000Z',
  },
  {
    id: 'c3',
    authorId: 'user-buyer-1',
    categoryId: 'cat-2',
    title: 'Recomiendo esta metodologia para evaluar proveedores',
    description:
      'He estado usando una matriz de evaluacion ponderada que considera calidad, precio, tiempo de entrega, servicio y sustentabilidad.',
    type: 'community',
    shares: 22,
    likedBy: [],
    createdAt: '2025-03-13T00:00:00.000Z',
    updatedAt: '2025-03-13T00:00:00.000Z',
  },
];

export const seedComments: SeedComment[] = [
  {
    id: 'cm1',
    postId: 'e1',
    userId: 'user-buyer-2',
    content:
      'Excelente contenido, me ayudo mucho en mi ultima negociacion con un proveedor de materias primas.',
    likedBy: [],
    createdAt: '2025-03-14T10:30:00.000Z',
    updatedAt: '2025-03-14T10:30:00.000Z',
  },
  {
    id: 'cm1r1',
    postId: 'e1',
    userId: 'user-admin-1',
    content: 'Que bueno escuchar eso, Ana. Aplicaste la tecnica BATNA?',
    parentId: 'cm1',
    likedBy: [],
    createdAt: '2025-03-14T12:00:00.000Z',
    updatedAt: '2025-03-14T12:00:00.000Z',
  },
  {
    id: 'cm2',
    postId: 'e1',
    userId: 'user-buyer-3',
    content:
      'Me gustaria ver un modulo mas avanzado sobre negociacion con proveedores internacionales.',
    likedBy: ['user-buyer-1'],
    createdAt: '2025-03-14T14:15:00.000Z',
    updatedAt: '2025-03-14T14:15:00.000Z',
  },
];

export const seedLessonProgress: SeedLessonProgress[] = [
  { id: 'l1', postId: 'e1', userId: 'user-buyer-1', progress: 65, duration: '45 min' },
  { id: 'l2', postId: 'e2', userId: 'user-buyer-1', progress: 30, duration: '38 min' },
  { id: 'l3', postId: 'e3', userId: 'user-buyer-1', progress: 0, duration: '32 min' },
];

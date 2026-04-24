import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  company: string;
  commercialName?: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  employeeCount?: string;
  digitalPresence?: {
    linkedin?: string;
    website?: string;
    whatsapp?: string;
    instagram?: string;
  };
  buyerProfile?: {
    interestCategories?: string[];
    purchaseVolume?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
  };
  supplierProfile?: {
    supplierType?: string;
    productsOrServices?: string[];
    hasDigitalCatalog?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
    coverage?: string;
    province?: string;
    district?: string;
    yearsInMarket?: string;
    onboarding?: {
      sessionId?: string;
      shareCount?: number;
      requiredShares?: number;
      completedAt?: Date;
    };
  };
  expertProfile?: {
    currentProfessionalProfile?: string;
    industry?: string;
    specialty?: string;
    experience?: string;
    skills?: string[];
    biography?: string;
    companies?: string;
    education?: string;
    achievements?: string;
    photo?: string;
    service?: string;
    availabilityDays?: string[];
    googleCalendarConnected?: boolean;
  };
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
  type: 'educational' | 'community' | 'liquidation';
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

export type SeedAgent = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  automationType: string;
  useCase: string;
  functionalities: string[];
  benefits: string[];
  inputs: string[];
  outputs: string[];
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
};

export type SeedEmployabilityJob = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  skillsRequired: string[];
  experienceRequired: string;
  location: string;
  createdAt: string;
  updatedAt: string;
};

export type SeedEmployabilityTalentProfile = {
  id: string;
  userId: string;
  description: string;
  skills: string[];
  experience: string;
  certifications: string[];
  availability: string;
  createdAt: string;
  updatedAt: string;
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
    id: 'user-expert-1',
    email: 'carolina.mejia@nexu-experts.com',
    password: 'Experto123!',
    fullName: 'Carolina Mejia',
    company: 'Nexu Experts',
    position: 'Directora de Procurement Strategico',
    sector: 'Retail',
    location: 'Lima, Peru',
    description:
      'Especialista en estrategia de abastecimiento, SRM y negociacion avanzada para categorias de alto impacto.',
    expertProfile: {
      currentProfessionalProfile: 'Directora de Procurement Strategico',
      industry: 'Retail y consumo masivo',
      specialty: 'Negociacion estrategica y desarrollo de proveedores',
      experience:
        '12 anos liderando compras regionales y transformacion de procurement.',
      skills: ['SRM', 'negociacion', 'sourcing', 'category management'],
      biography:
        'He liderado equipos regionales de compras, planes de ahorro y homologacion de proveedores para empresas de retail y consumo masivo en Latam.',
      companies: 'Falabella, Cencosud, consultoria independiente',
      education: 'MBA, especializacion en supply chain y strategic sourcing',
      achievements:
        'Ahorros recurrentes de doble digito y redisenio de procesos de abastecimiento.',
      photo:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
      service:
        'Mentoria 1:1 para equipos de compras, diagnostico de categoria y acompanamiento en negociaciones criticas.',
      availabilityDays: ['Lunes', 'Martes', 'Jueves'],
      googleCalendarConnected: true,
    },
    role: UserRole.EXPERT,
    status: UserStatus.ACTIVE,
    points: 2310,
    createdAt: '2025-10-10T00:00:00.000Z',
    updatedAt: '2025-10-10T00:00:00.000Z',
  },
  {
    id: 'user-expert-2',
    email: 'miguel.soto@nexu-experts.com',
    password: 'Experto123!',
    fullName: 'Miguel Soto',
    company: 'Nexu Experts',
    position: 'Consultor Senior de Supply Chain',
    sector: 'Manufactura',
    location: 'Bogota, Colombia',
    description:
      'Experto en planeamiento de demanda, S&OP y mitigacion de riesgo operativo para cadenas regionales.',
    expertProfile: {
      currentProfessionalProfile: 'Consultor Senior de Supply Chain',
      industry: 'Manufactura y agroindustria',
      specialty: 'S&OP, planeamiento y riesgo de suministro',
      experience:
        '10 anos implementando tableros, procesos S&OP y modelos de abastecimiento resiliente.',
      skills: ['S&OP', 'planeamiento', 'forecasting', 'riesgo'],
      biography:
        'Acompano a companias que necesitan ordenar su planeamiento, reducir quiebres y tomar decisiones de abastecimiento con mejor visibilidad.',
      companies: 'Grupo Nutresa, Quala, advisory independiente',
      education: 'Ingenieria industrial, APICS CSCP',
      achievements:
        'Implementacion de procesos S&OP con reduccion de quiebres y sobrestock.',
      photo:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
      service:
        'Sesiones de diagnostico y hoja de ruta para supply planning, KPIs y gestion de riesgo.',
      availabilityDays: ['Miercoles', 'Viernes'],
      googleCalendarConnected: true,
    },
    role: UserRole.EXPERT,
    status: UserStatus.ACTIVE,
    points: 1980,
    createdAt: '2025-11-01T00:00:00.000Z',
    updatedAt: '2025-11-01T00:00:00.000Z',
  },
  {
    id: 'user-admin-1',
    email: 'admin@supplynexu.com',
    password: 'Admin12345!',
    fullName: 'Administrador General',
    company: 'Supply Nexu',
    position: 'Administrador de plataforma',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    points: 5400,
    createdAt: '2023-06-01T00:00:00.000Z',
    updatedAt: '2023-06-01T00:00:00.000Z',
  },
  {
    id: 'user-admin-2',
    email: 'adolfo.mesa@supplynexu.com',
    password: 'AdolfoMesa#2026Nexu',
    fullName: 'Adolfo Mesa',
    company: 'Supply Nexu',
    position: 'Administrador de plataforma',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    points: 5400,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'user-admin-3',
    email: 'anna.torres@supplynexu.com',
    password: 'AnnaTorres#2026Nexu',
    fullName: 'Anna Torres',
    company: 'Supply Nexu',
    position: 'Administrador de plataforma',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    points: 5400,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
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
    description:
      'Interesados en proveedores de maquinaria y seguridad industrial.',
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 2100,
    createdAt: '2023-11-20T00:00:00.000Z',
    updatedAt: '2023-11-20T00:00:00.000Z',
  },
  {
    id: 'user-buyer-4',
    email: 'valeria@retailandino.com',
    password: 'Comprador123!',
    fullName: 'Valeria Paredes',
    company: 'Retail Andino',
    position: 'Category Manager',
    sector: 'Retail',
    location: 'Lima, Peru',
    description:
      'Comparo proveedores por rotacion, margen y capacidad de reposicion rapida.',
    buyerProfile: {
      interestCategories: ['packaging', 'consumo masivo', 'liquidaciones'],
      purchaseVolume: '$20,000 - $100,000',
      isCompanyDigitalized: 'Si',
      usesGenerativeAI: 'Si',
    },
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 1460,
    createdAt: '2025-07-05T00:00:00.000Z',
    updatedAt: '2025-07-05T00:00:00.000Z',
  },
  {
    id: 'user-buyer-5',
    email: 'jorge@agrovision.com',
    password: 'Comprador123!',
    fullName: 'Jorge Medina',
    company: 'AgroVision Foods',
    position: 'Jefe de Abastecimiento',
    sector: 'Agroindustria',
    location: 'Piura, Peru',
    description:
      'Interesado en cadena de frio, empaques sostenibles y proveedores con respuesta rapida.',
    buyerProfile: {
      interestCategories: ['cadena de frio', 'empaques', 'empleos'],
      purchaseVolume: '+$100,000',
      isCompanyDigitalized: 'Parcialmente',
      usesGenerativeAI: 'No',
    },
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    points: 980,
    createdAt: '2025-08-12T00:00:00.000Z',
    updatedAt: '2025-08-12T00:00:00.000Z',
  },
  {
    id: 'user-supplier-1',
    email: 'laura@empaques360.com',
    password: 'Proveedor123!',
    fullName: 'Laura Quispe',
    company: 'Empaques 360',
    commercialName: 'Empaques 360',
    position: 'Gerente Comercial',
    phone: '+51 987654321',
    ruc: '20604567891',
    sector: 'Manufactura',
    location: 'Lima, Peru',
    description:
      'Fabricamos empaques flexibles, stock de alta rotacion y series cortas para retail y alimentos.',
    employeeCount: '25-50',
    digitalPresence: {
      linkedin: 'https://linkedin.com/company/empaques360',
      website: 'https://empaques360.pe',
      whatsapp: '+51987654321',
    },
    supplierProfile: {
      supplierType: 'Fabricante',
      productsOrServices: [
        'empaques flexibles',
        'etiquetas',
        'liquidaciones de stock',
      ],
      hasDigitalCatalog: 'Si',
      isCompanyDigitalized: 'Si',
      usesGenerativeAI: 'Si',
    },
    role: UserRole.SUPPLIER,
    status: UserStatus.ACTIVE,
    points: 1640,
    createdAt: '2025-06-03T00:00:00.000Z',
    updatedAt: '2025-06-03T00:00:00.000Z',
  },
  {
    id: 'user-supplier-2',
    email: 'diego@friocadena.pe',
    password: 'Proveedor123!',
    fullName: 'Diego Salazar',
    company: 'FrioCadena Peru',
    commercialName: 'FrioCadena',
    position: 'Director de Operaciones',
    phone: '+51 976123456',
    ruc: '20607890124',
    sector: 'Logistica',
    location: 'Arequipa, Peru',
    description:
      'Operamos transporte refrigerado y almacenaje temporal para agroindustria, pharma y retail.',
    employeeCount: '51-100',
    digitalPresence: {
      website: 'https://friocadena.pe',
      whatsapp: '+51976123456',
      instagram: 'https://instagram.com/friocadena.pe',
    },
    supplierProfile: {
      supplierType: 'Servicio logistico',
      productsOrServices: [
        'transporte refrigerado',
        'cross docking',
        'tracking 24/7',
      ],
      hasDigitalCatalog: 'Si',
      isCompanyDigitalized: 'Si',
      usesGenerativeAI: 'No',
    },
    role: UserRole.SUPPLIER,
    status: UserStatus.ACTIVE,
    points: 1190,
    createdAt: '2025-05-18T00:00:00.000Z',
    updatedAt: '2025-05-18T00:00:00.000Z',
  },
  {
    id: 'user-supplier-3',
    email: 'paola@talentabasto.com',
    password: 'Proveedor123!',
    fullName: 'Paola Nunez',
    company: 'Talent Abasto',
    commercialName: 'Talent Abasto',
    position: 'Consultora Senior',
    phone: '+51 955321789',
    ruc: '20605433210',
    sector: 'Servicios',
    location: 'Bogota, Colombia',
    description:
      'Conectamos talento especializado en compras, planeamiento y desarrollo de proveedores.',
    employeeCount: '10-25',
    digitalPresence: {
      linkedin: 'https://linkedin.com/company/talent-abasto',
      website: 'https://talentabasto.com',
    },
    supplierProfile: {
      supplierType: 'Servicios profesionales',
      productsOrServices: [
        'reclutamiento',
        'capacitacion',
        'contenido educativo',
      ],
      hasDigitalCatalog: 'No',
      isCompanyDigitalized: 'Si',
      usesGenerativeAI: 'Si',
    },
    role: UserRole.SUPPLIER,
    status: UserStatus.ACTIVE,
    points: 870,
    createdAt: '2025-09-01T00:00:00.000Z',
    updatedAt: '2025-09-01T00:00:00.000Z',
  },
];

export const seedAgents: SeedAgent[] = [
  {
    id: 'agent-quote-comparator',
    slug: 'comparador-cotizaciones',
    name: 'Comparador de Cotizaciones',
    description:
      'Analiza multiples propuestas y destaca la mejor opcion por costo, plazo y condiciones.',
    longDescription:
      'Centraliza cotizaciones de distintos proveedores, compara variables criticas y entrega un resumen listo para decision con recomendaciones claras para el comprador.',
    category: 'Analisis',
    automationType: 'Evaluacion',
    useCase:
      'Comparar cotizaciones de proveedores en procesos RFQ o compras recurrentes.',
    functionalities: [
      'Consolida ofertas en un solo tablero',
      'Ordena proveedores por precio, lead time y cumplimiento',
      'Resume diferencias clave y alertas comerciales',
    ],
    benefits: [
      'Acelera decisiones de compra',
      'Reduce sesgos al evaluar propuestas',
      'Mejora trazabilidad para auditoria interna',
    ],
    inputs: [
      'Cotizaciones de proveedores',
      'Criterios de evaluacion',
      'Pesos de decision',
    ],
    outputs: [
      'Ranking recomendado',
      'Resumen comparativo',
      'Alertas por desviaciones',
    ],
    isActive: true,
    accentColor: '#0f766e',
    icon: 'Scale',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'agent-order-generator',
    slug: 'generador-ordenes-compra',
    name: 'Generador de Ordenes de Compra',
    description:
      'Crea ordenes automaticamente a partir de requerimientos internos y reglas del area.',
    longDescription:
      'Transforma requisiciones, niveles minimos y acuerdos vigentes en borradores de orden de compra listos para revisar, reduciendo tiempo operativo y errores manuales.',
    category: 'Automatizacion',
    automationType: 'Ejecucion',
    useCase:
      'Generar ordenes de compra estandarizadas para reposicion o compras programadas.',
    functionalities: [
      'Construye borradores de orden con datos estructurados',
      'Sugiere proveedor y cantidades segun reglas base',
      'Detecta datos faltantes antes de emitir la orden',
    ],
    benefits: [
      'Disminuye trabajo repetitivo del equipo',
      'Reduce errores de digitacion',
      'Estandariza el proceso de emision',
    ],
    inputs: ['Solicitud interna', 'Proveedor sugerido', 'Items y cantidades'],
    outputs: [
      'Orden de compra sugerida',
      'Resumen de validaciones',
      'Campos pendientes',
    ],
    isActive: true,
    accentColor: '#1d4ed8',
    icon: 'FileCheck',
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
  },
  {
    id: 'agent-supplier-scout',
    slug: 'analista-proveedores',
    name: 'Analista de Proveedores',
    description:
      'Evalua desempeño, riesgo y capacidad para recomendar los mejores proveedores.',
    longDescription:
      'Cruza informacion comercial, operativa y de cumplimiento para identificar proveedores mas confiables, detectar gaps y priorizar alternativas segun la estrategia de abastecimiento.',
    category: 'Sourcing',
    automationType: 'Recomendacion',
    useCase:
      'Homologar proveedores, renovar contratos o buscar mejores alternativas.',
    functionalities: [
      'Calcula score de proveedores',
      'Identifica fortalezas, riesgos y brechas',
      'Recomienda finalistas con argumentos concretos',
    ],
    benefits: [
      'Mejora calidad de sourcing',
      'Reduce riesgo de seleccion',
      'Facilita sustentacion ante stakeholders',
    ],
    inputs: [
      'Base de proveedores',
      'KPIs de desempeño',
      'Criterios de negocio',
    ],
    outputs: [
      'Ranking de proveedores',
      'Matriz de riesgo',
      'Recomendacion final',
    ],
    isActive: true,
    accentColor: '#7c3aed',
    icon: 'ShieldCheck',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
  {
    id: 'agent-demand-forecast',
    slug: 'predictor-demanda',
    name: 'Predictor de Demanda',
    description:
      'Proyecta demanda futura para anticipar compras y evitar quiebres o sobrestock.',
    longDescription:
      'Usa historicos, estacionalidad y supuestos comerciales para generar una proyeccion accionable que ayude a planificar abastecimiento y compras con mayor anticipacion.',
    category: 'Logistica',
    automationType: 'Prediccion',
    useCase:
      'Planificar compras por temporada, promociones o ciclos de reposicion.',
    functionalities: [
      'Proyecta consumo esperado por periodo',
      'Resalta picos, caidas y variaciones',
      'Sugiere volumen de compra objetivo',
    ],
    benefits: [
      'Reduce quiebres de stock',
      'Evita compras sobredimensionadas',
      'Mejora coordinacion con supply planning',
    ],
    inputs: [
      'Historico de demanda',
      'Calendario comercial',
      'Supuestos de crecimiento',
    ],
    outputs: [
      'Pronostico por periodo',
      'Escenarios de demanda',
      'Recomendacion de abastecimiento',
    ],
    isActive: true,
    accentColor: '#ea580c',
    icon: 'TrendingUp',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  },
  {
    id: 'agent-risk-watch',
    slug: 'detector-riesgos-compras',
    name: 'Detector de Riesgos en Compras',
    description:
      'Identifica alertas de abastecimiento, dependencia y cumplimiento antes de que escalen.',
    longDescription:
      'Monitorea variables criticas del proceso de compras para levantar alertas tempranas relacionadas con dependencia de proveedor, incumplimiento, precios y continuidad operativa.',
    category: 'Riesgo',
    automationType: 'Monitoreo',
    useCase:
      'Gestion preventiva del riesgo en categorias sensibles o proveedores criticos.',
    functionalities: [
      'Detecta alertas tempranas por proveedor o categoria',
      'Clasifica riesgos por impacto y urgencia',
      'Sugiere acciones inmediatas de mitigacion',
    ],
    benefits: [
      'Da visibilidad temprana a posibles incidentes',
      'Ayuda a priorizar mitigaciones',
      'Fortalece continuidad operativa',
    ],
    inputs: [
      'Indicadores de cumplimiento',
      'Dependencia de proveedor',
      'Alertas operativas',
    ],
    outputs: [
      'Mapa de riesgos',
      'Alertas priorizadas',
      'Plan de accion sugerido',
    ],
    isActive: true,
    accentColor: '#dc2626',
    icon: 'TriangleAlert',
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
  {
    id: 'agent-negotiation-brief',
    slug: 'copiloto-negociacion',
    name: 'Copiloto de Negociacion',
    description:
      'Prepara argumentos, objeciones y estrategia para negociaciones con proveedores.',
    longDescription:
      'Resume contexto del proveedor, identifica palancas de negociacion y propone una hoja de ruta para reuniones comerciales o renovaciones contractuales.',
    category: 'Negociacion',
    automationType: 'Asistencia',
    useCase:
      'Preparar negociaciones de precio, servicio, SLA o renovacion contractual.',
    functionalities: [
      'Resume historial y contexto del proveedor',
      'Propone argumentos y concesiones posibles',
      'Genera brief ejecutivo para la reunion',
    ],
    benefits: [
      'Llega mejor preparado a negociar',
      'Aumenta claridad en concesiones y objetivos',
      'Mejora consistencia del equipo comprador',
    ],
    inputs: [
      'Historial del proveedor',
      'Objetivos de la negociacion',
      'Condiciones actuales',
    ],
    outputs: [
      'Brief de negociacion',
      'Guion sugerido',
      'Palancas recomendadas',
    ],
    isActive: true,
    accentColor: '#be185d',
    icon: 'MessagesSquare',
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
  },
];

export const seedCategories: SeedCategory[] = [
  { id: 'cat-1', name: 'Tips', slug: 'tips' },
  { id: 'cat-5', name: 'Empleo', slug: 'empleo' },
  { id: 'cat-2', name: 'Recomendacion', slug: 'recomendacion' },
  { id: 'cat-3', name: 'Experiencia', slug: 'experiencia' },
  { id: 'cat-4', name: 'Pregunta', slug: 'pregunta' },
  { id: 'cat-6', name: 'Liquidaciones', slug: 'liquidaciones' },
  { id: 'cat-7', name: 'Contenido educativo', slug: 'contenido-educativo' },
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
    id: 'e4',
    authorId: 'user-admin-2',
    categoryId: 'cat-7',
    title: 'Como evaluar proveedores para liquidaciones sin sacrificar margen',
    description:
      'Una guia practica para revisar lote, rotacion, mermas, trazabilidad y terminos comerciales antes de comprar stock en liquidacion.',
    type: 'educational',
    videoUrl: 'https://example.com/video4',
    thumbnailUrl: '',
    shares: 16,
    likedBy: ['user-buyer-4', 'user-supplier-1'],
    createdAt: '2025-03-18T00:00:00.000Z',
    updatedAt: '2025-03-18T00:00:00.000Z',
  },
  {
    id: 'e5',
    authorId: 'user-admin-3',
    categoryId: 'cat-7',
    title: 'Checklist para publicar empleos en compras y supply chain',
    description:
      'Define perfil, seniority, indicadores del puesto y competencias digitales para atraer candidatos realmente alineados al negocio.',
    type: 'educational',
    videoUrl: 'https://example.com/video5',
    thumbnailUrl: '',
    shares: 11,
    likedBy: ['user-buyer-5', 'user-supplier-3'],
    createdAt: '2025-03-20T00:00:00.000Z',
    updatedAt: '2025-03-20T00:00:00.000Z',
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
  {
    id: 'c4',
    authorId: 'user-supplier-1',
    categoryId: 'cat-6',
    title: 'Liquidacion de empaques de alta barrera para alimentos y retail',
    description:
      'Tenemos stock disponible por cierre de temporada: bolsas doy pack, etiquetas termicas y sleeves con entrega inmediata. Si alguien ya compro por liquidacion, cuenten que filtros usan para validar calidad.',
    type: 'community',
    shares: 14,
    likedBy: ['user-buyer-4', 'user-buyer-1', 'user-supplier-2'],
    createdAt: '2025-03-21T00:00:00.000Z',
    updatedAt: '2025-03-21T00:00:00.000Z',
  },
  {
    id: 'c5',
    authorId: 'user-buyer-4',
    categoryId: 'cat-3',
    title:
      'Experiencia trabajando con proveedores que responden en menos de 2 horas',
    description:
      'En categorias de alta rotacion nos funciono exigir tiempo de respuesta comercial y evidencia de reposicion semanal. Comparto lo que medimos y que senales nos ayudaron a reducir quiebres.',
    type: 'community',
    shares: 7,
    likedBy: ['user-supplier-1', 'user-buyer-2'],
    createdAt: '2025-03-22T00:00:00.000Z',
    updatedAt: '2025-03-22T00:00:00.000Z',
  },
  {
    id: 'c6',
    authorId: 'user-supplier-2',
    categoryId: 'cat-1',
    title: 'Tip logistico para compradores que manejan cadena de frio',
    description:
      'Antes de cerrar una ruta, pidan evidencia de temperatura historica, tiempos de transferencia y protocolo de contingencia. Ese trio evita gran parte de las devoluciones.',
    type: 'community',
    shares: 10,
    likedBy: ['user-buyer-5', 'user-buyer-3', 'user-supplier-1'],
    createdAt: '2025-03-23T00:00:00.000Z',
    updatedAt: '2025-03-23T00:00:00.000Z',
  },
  {
    id: 'c7',
    authorId: 'user-supplier-3',
    categoryId: 'cat-5',
    title: 'Buscamos planner de compras con experiencia en analitica y SRM',
    description:
      'Estamos armando una bolsa de empleos para perfiles de procurement, supply planning y desarrollo de proveedores. Si tu empresa esta contratando o si buscas talento, deja aqui el tipo de perfil y ciudad.',
    type: 'community',
    shares: 19,
    likedBy: ['user-buyer-1', 'user-buyer-4', 'user-supplier-1'],
    createdAt: '2025-03-24T00:00:00.000Z',
    updatedAt: '2025-03-24T00:00:00.000Z',
  },
  {
    id: 'c8',
    authorId: 'user-buyer-5',
    categoryId: 'cat-7',
    title: 'Contenido educativo que si le sirvio a mi equipo de abastecimiento',
    description:
      'Hicimos una rutina mensual de aprendizaje corto: negociacion, riesgo, dashboards y homologacion. Comparto que formato nos funciono mejor para que el equipo si complete los modulos.',
    type: 'community',
    shares: 6,
    likedBy: ['user-admin-1', 'user-supplier-3'],
    createdAt: '2025-03-25T00:00:00.000Z',
    updatedAt: '2025-03-25T00:00:00.000Z',
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
  {
    id: 'cm3',
    postId: 'c4',
    userId: 'user-buyer-4',
    content:
      'Yo reviso tres cosas en liquidaciones: fecha de fabricacion, variacion entre lotes y evidencia de rotacion del inventario. Si eso cuadra, suele ser una buena compra.',
    likedBy: ['user-supplier-1'],
    createdAt: '2025-03-21T10:20:00.000Z',
    updatedAt: '2025-03-21T10:20:00.000Z',
  },
  {
    id: 'cm3r1',
    postId: 'c4',
    userId: 'user-supplier-1',
    content:
      'Buen punto. Estamos adjuntando ficha tecnica y fotos de lote para que el comprador valide antes de cerrar.',
    parentId: 'cm3',
    likedBy: ['user-buyer-4'],
    createdAt: '2025-03-21T11:05:00.000Z',
    updatedAt: '2025-03-21T11:05:00.000Z',
  },
  {
    id: 'cm4',
    postId: 'c5',
    userId: 'user-supplier-2',
    content:
      'Como proveedor, que nos pidan SLA claro nos ayuda bastante. Si el comprador define urgencia, ventana horaria y canal, la ejecucion mejora mucho.',
    likedBy: ['user-buyer-2'],
    createdAt: '2025-03-22T09:10:00.000Z',
    updatedAt: '2025-03-22T09:10:00.000Z',
  },
  {
    id: 'cm5',
    postId: 'c6',
    userId: 'user-buyer-5',
    content:
      'Sumaria pedir registro de incidentes de los ultimos 90 dias. Nos ayudo a detectar un operador con demasiadas aperturas no programadas.',
    likedBy: ['user-supplier-2', 'user-buyer-3'],
    createdAt: '2025-03-23T14:40:00.000Z',
    updatedAt: '2025-03-23T14:40:00.000Z',
  },
  {
    id: 'cm6',
    postId: 'c7',
    userId: 'user-buyer-1',
    content:
      'En mi equipo estamos buscando buyer semi senior con foco en software y negociacion. Si habilitan una plantilla de vacante, la publico por aqui.',
    likedBy: ['user-supplier-3'],
    createdAt: '2025-03-24T15:20:00.000Z',
    updatedAt: '2025-03-24T15:20:00.000Z',
  },
  {
    id: 'cm6r1',
    postId: 'c7',
    userId: 'user-supplier-3',
    content:
      'La subo manana. Voy a incluir seniority, rango salarial y stack digital para que las postulaciones lleguen mejor filtradas.',
    parentId: 'cm6',
    likedBy: ['user-buyer-1'],
    createdAt: '2025-03-24T16:00:00.000Z',
    updatedAt: '2025-03-24T16:00:00.000Z',
  },
  {
    id: 'cm7',
    postId: 'e4',
    userId: 'user-supplier-1',
    content:
      'Este contenido nos sirve tambien del lado proveedor porque ayuda a preparar mejor la documentacion del lote antes de ofrecer una liquidacion.',
    likedBy: ['user-admin-2'],
    createdAt: '2025-03-18T11:30:00.000Z',
    updatedAt: '2025-03-18T11:30:00.000Z',
  },
  {
    id: 'cm8',
    postId: 'e5',
    userId: 'user-buyer-4',
    content:
      'La parte de KPIs del puesto me gusto bastante. Muchas vacantes de compras piden de todo y luego no miden nada concreto.',
    likedBy: ['user-admin-3', 'user-supplier-3'],
    createdAt: '2025-03-20T13:00:00.000Z',
    updatedAt: '2025-03-20T13:00:00.000Z',
  },
];

export const seedLessonProgress: SeedLessonProgress[] = [
  {
    id: 'l1',
    postId: 'e1',
    userId: 'user-buyer-1',
    progress: 65,
    duration: '45 min',
  },
  {
    id: 'l2',
    postId: 'e2',
    userId: 'user-buyer-1',
    progress: 30,
    duration: '38 min',
  },
  {
    id: 'l3',
    postId: 'e3',
    userId: 'user-buyer-1',
    progress: 0,
    duration: '32 min',
  },
  {
    id: 'l4',
    postId: 'e4',
    userId: 'user-buyer-4',
    progress: 80,
    duration: '24 min',
  },
  {
    id: 'l5',
    postId: 'e5',
    userId: 'user-buyer-5',
    progress: 55,
    duration: '19 min',
  },
];

export const seedEmployabilityJobs: SeedEmployabilityJob[] = [
  {
    id: 'job-employability-1',
    authorId: 'user-buyer-1',
    title: 'Analista de Compras Senior',
    description:
      'Buscamos un perfil con foco en negociacion, control de proveedores y mejora de indicadores de abastecimiento.',
    skillsRequired: ['Negociacion', 'Strategic sourcing', 'ERP', 'KPIs'],
    experienceRequired: '3+ anos en compras o abastecimiento',
    location: 'Lima, modalidad hibrida',
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
  },
  {
    id: 'job-employability-2',
    authorId: 'user-supplier-1',
    title: 'Especialista en Logistica y Supply Chain',
    description:
      'Rol orientado a optimizar inventarios, coordinar operaciones y fortalecer el servicio con proveedores clave.',
    skillsRequired: [
      'Logistica',
      'Inventarios',
      'Planificacion',
      'Excel avanzado',
    ],
    experienceRequired: '2+ anos en operaciones o logistica',
    location: 'Arequipa, presencial',
    createdAt: '2026-04-11T14:30:00.000Z',
    updatedAt: '2026-04-11T14:30:00.000Z',
  },
  {
    id: 'job-employability-3',
    authorId: 'user-buyer-2',
    title: 'Comprador Tecnico de Categoria',
    description:
      'Se requiere experiencia liderando licitaciones, homologacion de proveedores y evaluacion de costo total.',
    skillsRequired: [
      'Compras estrategicas',
      'Licitaciones',
      'Analisis de costos',
      'Gestion de proveedores',
    ],
    experienceRequired: '4+ anos en compras tecnicas',
    location: 'Remoto LATAM',
    createdAt: '2026-04-15T09:00:00.000Z',
    updatedAt: '2026-04-15T09:00:00.000Z',
  },
];

export const seedEmployabilityTalentProfiles: SeedEmployabilityTalentProfile[] =
  [
    {
      id: 'talent-employability-1',
      userId: 'user-buyer-2',
      description:
        'Profesional con enfoque en abastecimiento estrategico, gestion contractual y relacion de largo plazo con proveedores.',
      skills: ['Negociacion', 'Compras estrategicas', 'Gestion contractual'],
      experience: '6 anos liderando categorias de alto impacto',
      certifications: ['Diplomado en Supply Chain', 'Scrum Fundamentals'],
      availability: 'Disponible de inmediato',
      createdAt: '2026-04-09T11:00:00.000Z',
      updatedAt: '2026-04-09T11:00:00.000Z',
    },
    {
      id: 'talent-employability-2',
      userId: 'user-supplier-1',
      description:
        'Perfil orientado a trazabilidad, indicadores operativos y mejora continua en centros de distribucion.',
      skills: ['Logistica', 'Inventarios', 'Power BI', 'Mejora continua'],
      experience: '4 anos en empresas de consumo masivo',
      certifications: ['Lean Logistics', 'Excel Expert'],
      availability: 'Disponible en 15 dias',
      createdAt: '2026-04-12T08:00:00.000Z',
      updatedAt: '2026-04-12T08:00:00.000Z',
    },
  ];

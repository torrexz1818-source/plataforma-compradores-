export type SupplierSummary = {
  id: string;
  name: string;
  sector: string;
  category: string;
  city: string;
  rating: number;
  reviews: number;
  description: string;
};

export type SupplierReview = {
  id: string;
  supplierId: string;
  author: string;
  role: string;
  rating: number;
  comment: string;
  time: string;
};

export const sectors = [
  'tecnologia',
  'logistica',
  'manufactura',
  'salud',
  'retail',
  'construccion',
  'agroindustria',
  'marketing',
];

export const suppliers: SupplierSummary[] = [
  {
    id: 'sup-1',
    name: 'TechParts Corp',
    sector: 'tecnologia',
    category: 'Insumos TI',
    city: 'Lima',
    rating: 4.8,
    reviews: 42,
    description: 'Proveedor especializado en hardware empresarial y repuestos.',
  },
  {
    id: 'sup-2',
    name: 'LogiExpress SA',
    sector: 'logistica',
    category: 'Transporte B2B',
    city: 'Arequipa',
    rating: 4.6,
    reviews: 31,
    description: 'Operador logistico nacional con cobertura multi-ciudad.',
  },
  {
    id: 'sup-3',
    name: 'MetalWorks Inc',
    sector: 'manufactura',
    category: 'Partes industriales',
    city: 'Trujillo',
    rating: 4.7,
    reviews: 27,
    description: 'Fabricante de componentes metalicos para industria pesada.',
  },
  {
    id: 'sup-4',
    name: 'BioHealth Supplies',
    sector: 'salud',
    category: 'Equipos medicos',
    city: 'Lima',
    rating: 4.5,
    reviews: 19,
    description: 'Distribucion de insumos medicos para clinicas y laboratorios.',
  },
  {
    id: 'sup-5',
    name: 'Retail Pulse',
    sector: 'retail',
    category: 'Merchandising',
    city: 'Cusco',
    rating: 4.4,
    reviews: 15,
    description: 'Soluciones para puntos de venta y activaciones comerciales.',
  },
];

export const reviews: SupplierReview[] = [
  {
    id: 'rev-1',
    supplierId: 'sup-1',
    author: 'Ana Torres',
    role: 'Buyer',
    rating: 5,
    comment: 'Buen tiempo de entrega y soporte tecnico rapido.',
    time: 'Hace 3 dias',
  },
  {
    id: 'rev-2',
    supplierId: 'sup-1',
    author: 'Carlos Vega',
    role: 'Buyer',
    rating: 4,
    comment: 'Precios competitivos, mejoraria comunicacion postventa.',
    time: 'Hace 1 semana',
  },
  {
    id: 'rev-3',
    supplierId: 'sup-2',
    author: 'Maria Rojas',
    role: 'Buyer',
    rating: 5,
    comment: 'Excelente seguimiento de despachos.',
    time: 'Hace 5 dias',
  },
];

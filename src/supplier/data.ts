export type BuyerSummary = {
  id: string;
  company: string;
  sector: string;
  city: string;
  volume: string;
  description: string;
};

export type SupplierPost = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export const buyers: BuyerSummary[] = [
  {
    id: 'buy-1',
    company: 'Andes Retail SAC',
    sector: 'Retail',
    city: 'Lima',
    volume: '$20,000 - $100,000',
    description: 'Busca proveedores de tecnologia y logistica para expansion regional.',
  },
  {
    id: 'buy-2',
    company: 'Constructora Nova',
    sector: 'Construccion',
    city: 'Trujillo',
    volume: '+$100,000',
    description: 'Requiere suministros industriales y operadores logistico.',
  },
  {
    id: 'buy-3',
    company: 'Clinica Horizonte',
    sector: 'Salud',
    city: 'Arequipa',
    volume: '$5,000 - $20,000',
    description: 'Interesada en proveedores de equipamiento medico.',
  },
];

export const supplierPostsSeed: SupplierPost[] = [
  {
    id: 'sp-1',
    title: 'Nueva linea de empaque industrial',
    description:
      'Presentamos soluciones de empaque con entregas en 48h para compras recurrentes.',
    createdAt: 'Hace 2 dias',
  },
  {
    id: 'sp-2',
    title: 'Servicio express para Lima y Callao',
    description:
      'Activamos una modalidad express para pedidos urgentes con tracking en tiempo real.',
    createdAt: 'Hace 5 dias',
  },
];

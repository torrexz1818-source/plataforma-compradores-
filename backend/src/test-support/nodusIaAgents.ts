export type NodusIaAgentStatus = 'active' | 'coming_soon' | 'disabled' | 'hidden';

export type NodusIaAgentCatalogItem = {
  id: string;
  agentKey: string;
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
  status: NodusIaAgentStatus;
  visibleToBuyer: boolean;
  sortOrder: number;
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
};

const baseAgent = {
  description: 'Agente de prueba.',
  longDescription: 'Agente de prueba.',
  category: 'Compras',
  automationType: 'Documento',
  useCase: 'Analisis',
  functionalities: [],
  benefits: [],
  inputs: [],
  outputs: [],
  status: 'active' as NodusIaAgentStatus,
  visibleToBuyer: true,
  isActive: true,
  accentColor: '#000000',
  icon: 'file-text',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const nodusIaAgents: NodusIaAgentCatalogItem[] = [
  {
    ...baseAgent,
    id: 'agent-terms-reference',
    agentKey: 'terms_of_reference',
    slug: 'elaboracion-terminos-referencia',
    name: 'Elaboracion de terminos de referencia',
    sortOrder: 1,
  },
  {
    ...baseAgent,
    id: 'agent-dashboard-creator',
    agentKey: 'dashboard_creator',
    slug: 'creador-dashboard',
    name: 'Creador de Dashboard',
    automationType: 'Dashboard',
    useCase: 'Dashboard',
    icon: 'bar-chart',
    sortOrder: 2,
  },
];

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

export const nodusIaAgents: NodusIaAgentCatalogItem[] = [];

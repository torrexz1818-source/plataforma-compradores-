export type LearningRouteId = 'ruta-1' | 'ruta-2' | 'ruta-3' | 'ruta-4';
export type LearningRouteAlias = 'ruta_1' | 'ruta_2' | 'ruta_3' | 'ruta_4';

export type LearningRoute = {
  id: LearningRouteId;
  label: string;
  title: string;
  description: string;
  color: string;
};

export const LEARNING_ROUTES: LearningRoute[] = [
  {
    id: 'ruta-1',
    label: 'Ruta 1',
    title: 'Gestion de proveedores',
    description: 'Esta ruta agrupa todo lo relacionado con encontrar, evaluar, homologar y gestionar proveedores.',
    color: '#0E109E',
  },
  {
    id: 'ruta-2',
    label: 'Ruta 2',
    title: 'Negociacion, contratos y licitaciones',
    description: 'Esta ruta ordena los contenidos relacionados con negociacion, contratos, RFQ, RFP y terminos de referencia.',
    color: '#5A31D5',
  },
  {
    id: 'ruta-3',
    label: 'Ruta 3',
    title: 'Datos, tecnologia e IA aplicada',
    description: 'Esta ruta agrupa los contenidos mas tecnologicos y diferenciales de Buyer Nodus.',
    color: '#F3313F',
  },
  {
    id: 'ruta-4',
    label: 'Ruta 4',
    title: 'Compras estrategicas y generacion de valor',
    description: 'Esta ruta eleva el rol del comprador desde lo operativo hacia lo estrategico.',
    color: '#B2EB4A',
  },
];

export const DEFAULT_LEARNING_ROUTE_ID: LearningRouteId = 'ruta-1';

export function isLearningRouteId(value: string | undefined): value is LearningRouteId {
  return LEARNING_ROUTES.some((route) => route.id === value);
}

export function normalizeLearningRouteId(value: string | undefined): LearningRouteId | undefined {
  if (isLearningRouteId(value)) return value;

  const aliasMap: Record<LearningRouteAlias, LearningRouteId> = {
    ruta_1: 'ruta-1',
    ruta_2: 'ruta-2',
    ruta_3: 'ruta-3',
    ruta_4: 'ruta-4',
  };

  return value ? aliasMap[value as LearningRouteAlias] : undefined;
}

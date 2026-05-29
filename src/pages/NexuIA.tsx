import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DragEvent } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FileCheck2,
  Layers3,
  MessagesSquare,
  PlayCircle,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Upload,
  Zap,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getAgentDetail,
  getAgents,
  getMyAgentExecutions,
  getMyAgentPdfOptions,
  getMyMonetization,
  recordAgentUsage,
  runAgent,
  submitAgentFeedback,
  validateAgentPdfMode,
} from '@/lib/api';
import { nodusIaAgents } from '../../shared/nodusIaAgents';
import { useAuth } from '@/lib/auth';
import type { Agent, AgentPdfMode } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useProposalComparison } from '@/features/proposal-comparison/useProposalComparison';
import {
  useGenerateTermsOfReference,
  useTermsFormSchema,
} from '@/features/terms-of-reference/useTermsOfReference';
import {
  validateTermsFiles,
  type TermsFormField,
  type TermsFormSection,
} from '@/features/terms-of-reference/termsOfReferenceApi';
import { useDashboardCreator } from '@/features/dashboard-creator/useDashboardCreator';
import { DashboardReportView } from '@/features/dashboard-creator/components/DashboardReportView';
import { useTcoAnalysis } from '@/features/tco-analysis/useTcoAnalysis';
import { normalizeTcoForPresentation } from '@/features/tco-analysis/tcoPresentation';
import { downloadAgentResult, type AgentExportFormat, type TermsExportScope } from '@/lib/agentPdf';
import {
  auditDeliverableBeforeDownload,
  type DeliverableQualityReport,
} from '@/lib/deliverableQuality';
import MonetizationPanel from '@/components/MonetizationPanel';

const iconMap = {
  Bot,
  BrainCircuit,
  FileCheck: FileCheck2,
  MessagesSquare,
  Scale,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
};

const tcoAnalysisTypes = [
  'Compra local',
  'Importación vs compra local',
  'Maquinaria / activo',
  'Software / SaaS',
  'Servicio recurrente',
  'Servicio puntual',
  'Repuestos / insumos',
  'Otro',
];

const tcoEvaluationHorizons = ['Por compra', '1 año', '3 años', '5 años', 'Vida útil', 'Personalizado'];
const tcoComparisonUnits = ['Por unidad', 'Por lote', 'Por usuario', 'Por km', 'Por hora', 'Por contrato', 'Por proyecto', 'Por año', 'Por mes'];

type TermsPendingField = {
  id: string;
  label: string;
  originalToken: string;
  token: string;
  type: 'COMPLETAR' | 'SUGERIDO';
  documentCode: 'TDR-01' | 'BC-01' | 'INV-03' | 'CRO-04' | 'PEN-05' | 'PACKAGE';
  document: string;
  documentSection: string;
  priority: 'alta' | 'media' | 'baja';
  inputType: 'text' | 'date' | 'number' | 'textarea' | 'email' | 'select';
  value: string;
  replacement: string;
  group: string;
  help: string;
  options?: string[];
};

const optionalTermsField = (name: string, label: string, placeholder: string, type: TermsFormField['type'] = 'text', options: string[] = []): TermsFormField => ({
  name,
  label,
  type,
  required: false,
  placeholder,
  options,
});

const termsContractingExtraSections: TermsFormSection[] = [
  {
    section_title: 'BC-01 Bases del Concurso',
    fields: [
      optionalTermsField('process_code', 'Código del proceso', 'Ejemplo: CP-2026-001'),
      optionalTermsField('contracting_entity', 'Entidad convocante', 'Razón social o área convocante'),
      optionalTermsField('tender_modality', 'Modalidad del concurso', 'Ejemplo: Concurso privado'),
      optionalTermsField('reference_budget', 'Presupuesto referencial', 'Monto referencial si aplica'),
      optionalTermsField('currency', 'Moneda', 'Ejemplo: PEN, USD'),
      optionalTermsField('proposal_submission_format', 'Forma de presentación de propuestas', 'Ejemplo: propuesta técnica y económica separadas'),
      optionalTermsField('submission_channel', 'Medio de envío', 'Presencial, correo, plataforma u otro'),
      optionalTermsField('allow_consortium', '¿Se permitirá consorcio?', 'Sí / No / Por definir'),
      optionalTermsField('technical_visit', '¿Habrá visita técnica?', 'Sí / No / Por definir'),
      optionalTermsField('minimum_supplier_requirements', 'Requisitos mínimos del proveedor', 'Experiencia, equipo, certificaciones o recursos mínimos', 'textarea'),
      optionalTermsField('mandatory_documents', 'Documentos obligatorios', 'Lista de documentos obligatorios', 'textarea'),
      optionalTermsField('subsanable_documents', 'Documentos subsanables', 'Lista de documentos subsanables', 'textarea'),
      optionalTermsField('technical_economic_criteria', 'Criterio técnico/económico', 'Ejemplo: 70/30'),
      optionalTermsField('minimum_technical_score', 'Puntaje mínimo técnico', 'Ejemplo: 60 puntos'),
      optionalTermsField('tie_breaker_criteria', 'Criterios de desempate', 'Reglas de desempate', 'textarea'),
      optionalTermsField('disqualification_rules', 'Causales de descalificación', 'Causales o reglas críticas', 'textarea'),
      optionalTermsField('legal_review_owner', 'Área legal o responsable de revisión', 'Nombre, cargo o área responsable'),
    ],
  },
  {
    section_title: 'INV-03 Invitación a postores',
    fields: [
      optionalTermsField('invited_company_name', 'Nombre de empresa invitada', 'Empresa invitada principal'),
      optionalTermsField('invited_contact_name', 'Nombre del contacto', 'Nombre del contacto'),
      optionalTermsField('invited_contact_role', 'Cargo del contacto', 'Cargo del contacto'),
      optionalTermsField('invited_contact_email', 'Correo del contacto', 'correo@empresa.com'),
      optionalTermsField('invited_contact_phone', 'Teléfono del contacto', 'Teléfono o anexo'),
      optionalTermsField('internal_process_owner', 'Responsable interno del proceso', 'Nombre del responsable interno'),
      optionalTermsField('internal_process_owner_role', 'Cargo del responsable interno', 'Cargo o área'),
      optionalTermsField('questions_contact_email', 'Correo de contacto para consultas', 'correo@empresa.com'),
      optionalTermsField('participation_confirmation_deadline', 'Fecha límite para confirmar participación', 'Fecha o hito'),
      optionalTermsField('questions_deadline', 'Fecha límite para consultas', 'Fecha o hito'),
      optionalTermsField('proposal_deadline', 'Fecha límite para presentar propuesta', 'Fecha o hito'),
      optionalTermsField('attached_documents_list', 'Lista de documentos adjuntos', 'TDR, bases, cronograma, anexos', 'textarea'),
      optionalTermsField('bidder_message', 'Mensaje adicional para postores', 'Mensaje breve para incluir en la invitación', 'textarea'),
      optionalTermsField('confidentiality_level', 'Nivel de confidencialidad', 'Interno, confidencial, reservado'),
      optionalTermsField('invited_bidders_list', 'Múltiples postores invitados', 'Una empresa por línea, con contacto/correo si existe', 'textarea'),
    ],
  },
  {
    section_title: 'CRO-04 Cronograma',
    fields: [
      optionalTermsField('call_date', 'Fecha de convocatoria', 'Fecha o Día 1'),
      optionalTermsField('confirmation_deadline', 'Fecha límite de confirmación', 'Fecha o hito'),
      optionalTermsField('technical_visit_date', 'Fecha de visita técnica, si aplica', 'Fecha o No aplica'),
      optionalTermsField('query_deadline', 'Fecha límite de consultas', 'Fecha o hito'),
      optionalTermsField('query_response_date', 'Fecha de absolución de consultas', 'Fecha o hito'),
      optionalTermsField('technical_opening_date', 'Fecha de apertura técnica', 'Fecha o hito'),
      optionalTermsField('economic_opening_date', 'Fecha de apertura económica', 'Fecha o hito'),
      optionalTermsField('award_date', 'Fecha de adjudicación', 'Fecha o hito'),
      optionalTermsField('contract_signature_date', 'Fecha estimada de firma de contrato', 'Fecha o hito'),
      optionalTermsField('execution_start_date', 'Fecha de inicio de ejecución', 'Fecha o hito'),
      optionalTermsField('execution_term', 'Plazo de ejecución', 'Ejemplo: 30 días calendario'),
      optionalTermsField('stage_responsible', 'Responsable por etapa', 'Responsables por fase o hito', 'textarea'),
      optionalTermsField('schedule_observations', 'Observaciones del cronograma', 'Restricciones, feriados, dependencias o hitos críticos', 'textarea'),
    ],
  },
];
const tcoCurrencies = ['PEN', 'USD', 'EUR', 'Otra'];
const dashboardAudiences = ['Gerencia', 'Compras', 'Finanzas', 'Operaciones', 'Proveedores', 'Auditoría', 'Otro'];
const dashboardDataTypes = ['Gastos', 'Proveedores', 'Compras', 'Contratos', 'Inventario', 'Cotizaciones', 'Indicadores KPI', 'Datos mixtos', 'Otro'];
const dashboardFocusOptions = ['Automático', 'Categorías', 'Proveedores', 'Ahorro', 'Cumplimiento', 'Compradores', 'Pagos', 'Ejecutivo', 'Operativo', 'Financiero', 'Gastos', 'Compras', 'Auditoría'];

function getTermsRequirementProgressMessage(requirementType: string) {
  const normalized = requirementType.toLowerCase();
  if (normalized.includes('servicio') || normalized.includes('consultor') || normalized.includes('mantenimiento') || normalized.includes('obra')) {
    return 'Organizando alcance del servicio...';
  }
  if (normalized.includes('producto') || normalized.includes('bien') || normalized.includes('suministro') || normalized.includes('equipo')) {
    return 'Organizando especificaciones del producto...';
  }
  return 'Organizando objetivo, alcance y entregables...';
}

function buildTermsProcessingStages(requirementType: string, hasInstructions: boolean) {
  return [
    { label: 'Subiendo archivos', message: 'Subiendo archivos de soporte...' },
    { label: 'Leyendo archivos', message: 'Leyendo documentos, fichas o bases cargadas...' },
    { label: 'Clasificando tipo de contratación', message: 'Clasificando tipo de contratación y documentos requeridos...' },
    { label: 'Extrayendo información técnica', message: 'Extrayendo información técnica relevante...' },
    { label: 'Identificando brechas de información', message: 'Identificando datos por completar y recomendaciones sugeridas...' },
    { label: 'Organizando requerimiento', message: getTermsRequirementProgressMessage(requirementType) },
    ...(hasInstructions ? [{ label: 'Aplicando instrucciones del usuario', message: 'Aplicando instrucciones del usuario...' }] : []),
    { label: 'Generando TDR', message: 'Generando términos de referencia cuando corresponde...' },
    { label: 'Generando Bases del Concurso', message: 'Preparando reglas, requisitos y criterios del concurso...' },
    { label: 'Preparando invitación a postores', message: 'Redactando invitación formal para empresas postoras...' },
    { label: 'Construyendo cronograma', message: 'Construyendo fases, hitos y plazos del proceso...' },
    { label: 'Validando coherencia documental', message: 'Validando coherencia entre documentos, criterios y cronograma...' },
    { label: 'Construyendo matrices y criterios', message: 'Construyendo matriz de cumplimiento y criterios de evaluación...' },
    { label: 'Preparando resultado final', message: 'Preparando resultado final...' },
    { label: 'Documentos listos', message: 'Documentos de contratación listos.' },
  ];
}

function getProposalInstructionProgressMessage(objective: string) {
  const normalized = objective.toLowerCase();
  if (normalized.includes('certificacion') || normalized.includes('certificación') || normalized.includes('certificaciones')) {
    return 'Aplicando prioridades de evaluación...';
  }
  if (normalized.includes('precio') || normalized.includes('costo') || normalized.includes('económico') || normalized.includes('economico')) {
    return 'Priorizando análisis económico...';
  }
  if (normalized.includes('cumplimiento') || normalized.includes('técnico') || normalized.includes('tecnico')) {
    return 'Revisando cumplimiento técnico...';
  }
  if (normalized.trim()) {
    return 'Aplicando instrucciones del usuario...';
  }
  return 'Detectando criterios, pesos y requisitos...';
}

function buildProposalProgressStages(objective: string) {
  return [
    { label: 'Subiendo propuestas', message: 'Subiendo propuestas...' },
    { label: 'Leyendo archivos de propuestas', message: 'Leyendo archivos de propuestas...' },
    { label: 'Extrayendo datos de proveedores', message: 'Extrayendo datos de proveedores...' },
    { label: 'Detectando criterios, pesos y requisitos', message: getProposalInstructionProgressMessage(objective) },
    { label: 'Comparando precios, plazos y condiciones', message: 'Comparando precios, plazos y condiciones...' },
    { label: 'Evaluando cumplimiento técnico y comercial', message: 'Evaluando cumplimiento técnico y comercial...' },
    { label: 'Aplicando reglas de evaluación', message: 'Aplicando reglas de evaluación...' },
    { label: 'Calculando puntajes ponderados', message: 'Calculando puntajes ponderados...' },
    { label: 'Generando ranking de proveedores', message: 'Generando ranking de proveedores...' },
    { label: 'Detectando riesgos y datos faltantes', message: 'Detectando riesgos y datos faltantes...' },
    { label: 'Generando recomendación final', message: 'Generando recomendación final...' },
    { label: 'Preparando reporte y descargables', message: 'Preparando reporte y descargables...' },
    { label: 'Comparativo listo', message: 'Comparativo listo.' },
  ];
}

function getProposalComparisonErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('tiempo') || normalized.includes('time')) {
    return 'El análisis tomó más tiempo de lo esperado. Intenta nuevamente o reduce el tamaño de los archivos.';
  }
  if (normalized.includes('archivo') || normalized.includes('file') || normalized.includes('format') || normalized.includes('formato')) {
    return 'El archivo no pudo procesarse. Verifica el formato o vuelve a cargarlo.';
  }
  if (normalized.includes('información suficiente') || normalized.includes('informacion suficiente') || normalized.includes('proveedores') || normalized.includes('propuestas')) {
    return 'No encontramos información suficiente para comparar proveedores. Agrega propuestas con precios, condiciones o criterios de evaluación.';
  }
  return 'No se pudo generar el comparativo. Revisa que las propuestas tengan datos válidos o intenta con otros archivos.';
}

function getAgentIcon(icon: string) {
  return iconMap[icon as keyof typeof iconMap] ?? Bot;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalizeAgentKey(agent: Pick<Agent, 'id' | 'agentKey' | 'slug'>) {
  const raw = agent.agentKey || agent.id || agent.slug;
  const legacyMap: Record<string, string> = {
    'agent-quote-comparator': 'proposal_comparison',
    'comparador-cotizaciones': 'proposal_comparison',
    'comparativos-propuestas-proveedores': 'proposal_comparison',
    'agent-terms-reference': 'terms_of_reference',
    'elaboracion-terminos-referencia': 'terms_of_reference',
  };

  return legacyMap[raw] ?? raw;
}

function getDashboardFocusProgressMessage(focus: string) {
  const normalized = focus.toLowerCase();
  if (normalized.includes('categor')) return 'Priorizando análisis por categorías…';
  if (normalized.includes('proveedor')) return 'Priorizando análisis por proveedores…';
  if (normalized.includes('ahorro')) return 'Priorizando ahorro y oportunidades de negociación…';
  if (normalized.includes('cumplimiento')) return 'Revisando estados y cumplimiento de compras…';
  if (normalized.includes('comprador')) return 'Construyendo análisis por comprador…';
  if (normalized.includes('pago')) return 'Revisando condiciones y plazos de pago…';
  if (normalized.includes('financiero') || normalized.includes('gasto')) return 'Priorizando indicadores financieros de compras…';
  return 'Aplicando instrucciones del dashboard…';
}

function buildDashboardProgressStages(focus: string, hasInstructions: boolean) {
  const instructionMessage = hasInstructions
    ? 'Aplicando instrucciones del usuario…'
    : getDashboardFocusProgressMessage(focus);

  return [
    { label: 'Subiendo archivos', message: 'Subiendo archivos de compras…' },
    { label: 'Leyendo archivos', message: 'Leyendo archivos de compras…' },
    { label: 'Detectando hojas y columnas', message: 'Detectando proveedores, categorías, montos y fechas…' },
    { label: 'Limpiando datos', message: 'Limpiando datos y descartando valores no válidos…' },
    { label: 'Aplicando instrucciones', message: instructionMessage },
    { label: 'Calculando KPIs', message: 'Calculando KPIs de compras…' },
    { label: 'Generando gráficos', message: 'Generando gráficos ejecutivos…' },
    { label: 'Construyendo dashboard', message: 'Preparando dashboard visual…' },
    { label: 'Preparando resultado final', message: 'Finalizando resultado y descargas disponibles…' },
    { label: 'Dashboard listo', message: 'Dashboard listo para revisar y descargar.' },
  ];
}

function getDashboardProgressStageIndex(stage: 'uploading_files' | 'reading_files') {
  return stage === 'uploading_files' ? 0 : 1;
}

function getDashboardErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('time') || normalized.includes('tiempo')) {
    return 'El análisis tomó más tiempo de lo esperado. Intenta nuevamente o reduce el tamaño de los archivos.';
  }
  if (normalized.includes('archivo') || normalized.includes('file') || normalized.includes('format')) {
    return 'El archivo no pudo procesarse. Verifica el formato o vuelve a cargarlo.';
  }
  if (normalized.includes('conectar') || normalized.includes('network') || normalized.includes('fetch')) {
    return 'No se pudo conectar con el motor de IA. Intenta nuevamente en unos minutos.';
  }
  return 'No se pudo generar el dashboard. Revisa que los archivos tengan datos válidos de compras o intenta con otro archivo.';
}

function getTermsErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('time') || normalized.includes('tiempo')) {
    return 'El análisis tomó más tiempo de lo esperado. Intenta nuevamente o reduce el tamaño de los archivos.';
  }
  if (normalized.includes('archivo') || normalized.includes('file') || normalized.includes('format') || normalized.includes('formato')) {
    return 'El archivo no pudo procesarse. Verifica el formato o vuelve a cargarlo.';
  }
  if (
    normalized.includes('objetivo') ||
    normalized.includes('alcance') ||
    normalized.includes('descripción') ||
    normalized.includes('descripcion') ||
    normalized.includes('datos') ||
    normalized.includes('obligatorio') ||
    normalized.includes('required')
  ) {
    return 'Faltan datos clave para generar los documentos. Completa el objeto, objetivo o alcance del proceso.';
  }
  return 'No se pudieron generar los documentos. Revisa los datos ingresados o intenta nuevamente.';
}

const NexuIA = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { id: routeAgentId } = useParams();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedAutomationType, setSelectedAutomationType] = useState('Todos');
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [uploadedComparisonFiles, setUploadedComparisonFiles] = useState<File[]>([]);
  const [comparisonService, setComparisonService] = useState('');
  const [comparisonObjective, setComparisonObjective] = useState('');
  const proposalComparisonMutation = useProposalComparison();
  const [proposalProgressStep, setProposalProgressStep] = useState(0);
  const [termsInitialDescription, setTermsInitialDescription] = useState('');
  const [termsFields, setTermsFields] = useState<Record<string, string>>({});
  const [termsSafetyRequirements, setTermsSafetyRequirements] = useState<string[]>([]);
  const [termsFiles, setTermsFiles] = useState<File[]>([]);
  const [termsCurrentStep, setTermsCurrentStep] = useState(0);
  const [termsProcessingStep, setTermsProcessingStep] = useState(0);
  const [termsActiveTab, setTermsActiveTab] = useState('documento');
  const [termsEditedResult, setTermsEditedResult] = useState<Record<string, unknown> | null>(null);
  const [termsPendingReview, setTermsPendingReview] = useState<{
    scope: TermsExportScope;
    items: TermsPendingField[];
  } | null>(null);
  const [isTermsDropActive, setIsTermsDropActive] = useState(false);
  const [loggedRunIds, setLoggedRunIds] = useState<Record<string, string>>({});
  const [feedbackStars, setFeedbackStars] = useState(5);
  const [feedbackType, setFeedbackType] = useState('me_sirvio');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCorrection, setFeedbackCorrection] = useState('');
  const [selectedPdfMode, setSelectedPdfMode] = useState<AgentPdfMode>('standard_branded');
  const [selectedExportFormat, setSelectedExportFormat] = useState<AgentExportFormat>('pdf');
  const [isExportingResult, setIsExportingResult] = useState(false);
  const [confirmedQualityWarnings, setConfirmedQualityWarnings] = useState<Record<string, boolean>>({});
  const termsFormSchemaMutation = useTermsFormSchema();
  const termsGenerateMutation = useGenerateTermsOfReference();
  const dashboardCreatorMutation = useDashboardCreator();
  const tcoAnalysisMutation = useTcoAnalysis();
  const [dashboardForm, setDashboardForm] = useState({
    title: '',
    objective: '',
    audience: 'Gerencia',
    period: '',
    dataType: 'Datos mixtos',
    visualizationFocus: 'Automático',
    additionalContext: '',
  });
  const [dashboardFiles, setDashboardFiles] = useState<File[]>([]);
  const [isDashboardDropActive, setIsDashboardDropActive] = useState(false);
  const [dashboardProgressStep, setDashboardProgressStep] = useState(0);
  const [dashboardUploadPercent, setDashboardUploadPercent] = useState(0);
  const termsHasAdditionalInstructions = Boolean(
    termsFields.additional_instructions?.trim() ||
    termsFields.important_observations?.trim() ||
    termsFields.dynamic_important_observations?.trim() ||
    termsFields.dynamic_additional_instructions?.trim(),
  );
  const proposalProgressStages = useMemo(
    () => buildProposalProgressStages(comparisonObjective),
    [comparisonObjective],
  );
  const termsProcessingStages = useMemo(
    () => buildTermsProcessingStages(termsFields.requirement_type ?? '', termsHasAdditionalInstructions),
    [termsFields.requirement_type, termsHasAdditionalInstructions],
  );
  const dashboardProgressStages = useMemo(
    () => buildDashboardProgressStages(
      dashboardForm.visualizationFocus,
      Boolean(dashboardForm.objective.trim() || dashboardForm.additionalContext.trim()),
    ),
    [dashboardForm.additionalContext, dashboardForm.objective, dashboardForm.visualizationFocus],
  );
  const [tcoGeneral, setTcoGeneral] = useState({
    title: '',
    itemName: '',
    analysisType: tcoAnalysisTypes[0],
    evaluationHorizon: '3 años',
    comparisonUnit: 'Por unidad',
    currency: 'PEN',
    purchaseVolume: '',
    objective: '',
    generalContext: '',
    additionalInstructions: '',
  });
  const [tcoFiles, setTcoFiles] = useState<File[]>([]);
  const [tcoProgressStep, setTcoProgressStep] = useState(0);
  const tcoProgressStages = useMemo(
    () => [
      { label: 'Leyendo archivos', message: 'Leyendo archivos...' },
      { label: 'Extrayendo datos', message: 'Extrayendo datos de propuestas...' },
      { label: 'Detectando tipo', message: 'Detectando tipo de analisis...' },
      { label: 'Organizando datos', message: 'Organizando datos, supuestos y faltantes...' },
      { label: 'Matriz TCO', message: 'Construyendo matriz TCO...' },
      { label: 'Modelo financiero', message: 'Calculando modelo financiero...' },
      { label: 'Scorecard y ranking', message: 'Generando scorecard y ranking...' },
      { label: 'Descargables', message: 'Preparando descargables...' },
      { label: 'Finalizando', message: 'Finalizando analisis...' },
    ],
    [],
  );
  const [limitNotice, setLimitNotice] = useState('');
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  const curatedAgentsById = useMemo(
    () => new Map(nodusIaAgents.map((agent) => [agent.id, agent])),
    [],
  );
  const curatedAgentsBySlug = useMemo(
    () => new Map(nodusIaAgents.map((agent) => [agent.slug, agent])),
    [],
  );
  const routeCuratedAgent =
    (routeAgentId ? curatedAgentsById.get(routeAgentId) : undefined) ||
    (routeAgentId ? curatedAgentsBySlug.get(routeAgentId) : undefined);

  const selectedAgentId = routeAgentId || '';

  const detailQuery = useQuery({
    queryKey: ['agents', selectedAgentId],
    queryFn: () => getAgentDetail(selectedAgentId),
    enabled: Boolean(selectedAgentId && !routeCuratedAgent),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  const executionsQuery = useQuery({
    queryKey: ['agents', 'executions', 'mine'],
    queryFn: getMyAgentExecutions,
  });
  const monetizationQuery = useQuery({
    queryKey: ['monetization', 'mine'],
    queryFn: getMyMonetization,
    enabled: user?.role !== 'admin',
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setAgentInputs((current) => {
      const next = { ...current };

      detailQuery.data.inputs.forEach((inputLabel) => {
        if (typeof next[inputLabel] !== 'string') {
          next[inputLabel] = '';
        }
      });

      return next;
    });
  }, [detailQuery.data]);

  useEffect(() => {
    setUploadedComparisonFiles([]);
    setComparisonService('');
    setComparisonObjective('');
    setAgentInputs({});
    proposalComparisonMutation.reset();
    setProposalProgressStep(0);
    setTermsInitialDescription('');
    setTermsFields({});
    setTermsSafetyRequirements([]);
    setTermsFiles([]);
    setTermsCurrentStep(0);
    setTermsProcessingStep(0);
    setTermsActiveTab('documento');
    setTermsEditedResult(null);
    setTermsPendingReview(null);
    setIsTermsDropActive(false);
    termsFormSchemaMutation.reset();
    termsGenerateMutation.reset();
    dashboardCreatorMutation.reset();
    setDashboardForm({
      title: '',
      objective: '',
      audience: 'Gerencia',
      period: '',
      dataType: 'Datos mixtos',
      visualizationFocus: 'Automático',
      additionalContext: '',
    });
    setDashboardFiles([]);
    setDashboardProgressStep(0);
    setDashboardUploadPercent(0);
    tcoAnalysisMutation.reset();
    setTcoGeneral({
      title: '',
      itemName: '',
      analysisType: tcoAnalysisTypes[0],
      evaluationHorizon: '3 años',
      comparisonUnit: 'Por unidad',
      currency: 'PEN',
      purchaseVolume: '',
      objective: '',
      generalContext: '',
      additionalInstructions: '',
    });
    setTcoFiles([]);
    setTcoProgressStep(0);
    setFeedbackComment('');
    setFeedbackCorrection('');
    setSelectedPdfMode('standard_branded');
    setFeedbackStars(5);
    setFeedbackType('me_sirvio');
  }, [routeAgentId]);

  useEffect(() => {
    if (termsGenerateMutation.isSuccess) {
      setTermsProcessingStep(termsProcessingStages.length - 1);
      return undefined;
    }

    if (!termsGenerateMutation.isPending) {
      setTermsProcessingStep(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTermsProcessingStep((current) => Math.min(current + 1, termsProcessingStages.length - 2));
    }, 1300);

    return () => window.clearInterval(intervalId);
  }, [termsGenerateMutation.isPending, termsGenerateMutation.isSuccess, termsProcessingStages.length]);

  useEffect(() => {
    if (dashboardCreatorMutation.isSuccess) {
      setDashboardProgressStep(dashboardProgressStages.length - 1);
      setDashboardUploadPercent(100);
      return undefined;
    }

    if (!dashboardCreatorMutation.isPending) {
      setDashboardProgressStep(0);
      if (!dashboardCreatorMutation.isError) setDashboardUploadPercent(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDashboardProgressStep((current) => Math.min(current + 1, dashboardProgressStages.length - 2));
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [dashboardCreatorMutation.isPending, dashboardCreatorMutation.isSuccess, dashboardProgressStages.length]);

  useEffect(() => {
    if (!dashboardCreatorMutation.data) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    new Notification('Buyer Nodus', {
      body: 'Tu dashboard ya está listo para revisar y descargar.',
    });
  }, [dashboardCreatorMutation.data]);

  useEffect(() => {
    if (!termsGenerateMutation.data) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    new Notification('Buyer Nodus', {
      body: 'Tu término de referencia ya está listo para revisar y descargar.',
    });
  }, [termsGenerateMutation.data]);

  useEffect(() => {
    if (proposalComparisonMutation.isSuccess) {
      setProposalProgressStep(proposalProgressStages.length - 1);
      return undefined;
    }

    if (!proposalComparisonMutation.isPending) {
      if (!proposalComparisonMutation.isError) setProposalProgressStep(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setProposalProgressStep((current) => Math.min(current + 1, proposalProgressStages.length - 2));
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [proposalComparisonMutation.isError, proposalComparisonMutation.isPending, proposalComparisonMutation.isSuccess, proposalProgressStages.length]);

  useEffect(() => {
    if (!proposalComparisonMutation.data) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    new Notification('Buyer Nodus', {
      body: 'Tu comparativo de propuestas ya está listo para revisar y descargar.',
    });
  }, [proposalComparisonMutation.data]);

  useEffect(() => {
    if (tcoAnalysisMutation.isSuccess) {
      setTcoProgressStep(tcoProgressStages.length - 1);
      return undefined;
    }

    if (!tcoAnalysisMutation.isPending) {
      setTcoProgressStep(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTcoProgressStep((current) => Math.min(current + 1, tcoProgressStages.length - 2));
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [tcoAnalysisMutation.isPending, tcoAnalysisMutation.isSuccess]);

  const runMutation = useMutation({
    mutationFn: runAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'executions', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['agents', selectedAgentId] });
      toast({
        title: 'Agente ejecutado',
        description: 'La automatizacion ya genero un resultado listo para revisar.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo ejecutar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: submitAgentFeedback,
    onSuccess: () => {
      setFeedbackComment('');
      setFeedbackCorrection('');
      setFeedbackStars(5);
      setFeedbackType('me_sirvio');
      queryClient.invalidateQueries({ queryKey: ['agents', 'executions', 'mine'] });
      toast({
        title: 'Feedback enviado',
        description: 'Gracias. El equipo admin podra revisarlo para mejorar el agente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo enviar el feedback',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    },
  });

  const catalogAgents = useMemo(() => {
    const agentsFromApi = agentsQuery.data ?? [];
    const agentsByKey = new Map(agentsFromApi.map((agent) => [normalizeAgentKey(agent), agent]));

    return nodusIaAgents
      .map((baseAgent) => {
        const apiAgent = agentsByKey.get(baseAgent.agentKey);
        const status = apiAgent?.status ?? baseAgent.status;

        return {
          ...baseAgent,
          status,
          isActive: status === 'active',
          visibleToBuyer: status !== 'hidden',
          executions: apiAgent?.executions,
          averageStars: apiAgent?.averageStars,
          metrics: apiAgent?.metrics,
          recommendations: apiAgent?.recommendations,
          updatedAt: apiAgent?.updatedAt ?? baseAgent.updatedAt,
        } satisfies Agent;
      })
      .filter((agent) => agent.visibleToBuyer !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [agentsQuery.data]);

  const categories = useMemo(() => {
    const items = new Set(catalogAgents.map((agent) => agent.category));
    return ['Todos', ...items];
  }, [catalogAgents]);

  const automationTypes = useMemo(() => {
    const items = new Set(catalogAgents.map((agent) => agent.automationType));
    return ['Todos', ...items];
  }, [catalogAgents]);

  const filteredAgents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return catalogAgents.filter((agent) => {
      const matchesCategory =
        selectedCategory === 'Todos' || agent.category === selectedCategory;
      const matchesAutomation =
        selectedAutomationType === 'Todos' ||
        agent.automationType === selectedAutomationType;
      const matchesSearch =
        !normalizedSearch ||
        `${agent.name} ${agent.description} ${agent.useCase}`.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesAutomation && matchesSearch;
    });
  }, [catalogAgents, search, selectedAutomationType, selectedCategory]);

  const selectedAgentFromCatalog = routeAgentId
    ? catalogAgents.find((agent) => agent.id === routeAgentId || agent.slug === routeAgentId)
    : undefined;
  const selectedAgent = selectedAgentFromCatalog
    ? selectedAgentFromCatalog
    : detailQuery.data
      ? {
          ...(curatedAgentsById.get(normalizeAgentKey(detailQuery.data)) ?? detailQuery.data),
          status: detailQuery.data.status,
          isActive: detailQuery.data.status === 'active',
        }
      : undefined;
  const isDetailView = Boolean(routeAgentId);
  const isQuoteComparator =
    selectedAgent?.id === 'agent-quote-comparator' ||
    selectedAgent?.id === 'proposal_comparison' ||
    selectedAgent?.agentKey === 'proposal_comparison' ||
    selectedAgent?.slug === 'comparador-cotizaciones' ||
    selectedAgent?.slug === 'comparativos-propuestas-proveedores';
  const isTermsReference =
    selectedAgent?.id === 'agent-terms-reference' ||
    selectedAgent?.id === 'terms_of_reference' ||
    selectedAgent?.agentKey === 'terms_of_reference' ||
    selectedAgent?.slug === 'elaboracion-terminos-referencia';
  const isTcoAnalysis =
    selectedAgent?.id === 'tco_analysis' ||
    selectedAgent?.agentKey === 'tco_analysis' ||
    selectedAgent?.slug === 'analisis-costo-total-tco';
  const isDashboardCreator =
    selectedAgent?.id === 'dashboard_creator' ||
    selectedAgent?.agentKey === 'dashboard_creator' ||
    selectedAgent?.slug === 'creador-dashboard';
  const selectedAgentKey = selectedAgent ? normalizeAgentKey(selectedAgent) : '';
  const runExecution = runMutation.data?.execution;
  const isCurrentRunForSelectedAgent = Boolean(selectedAgent?.id && runExecution?.agentId === selectedAgent.id);
  const pdfOptionsQuery = useQuery({
    queryKey: ['agent-pdf-options', selectedAgentKey],
    queryFn: () => getMyAgentPdfOptions(selectedAgentKey),
    enabled: Boolean(selectedAgentKey),
  });
  const availablePdfModes = useMemo(() => {
    const modes = pdfOptionsQuery.data?.modes;
    return [
      { value: 'standard_branded' as const, label: 'PDF Buyer Nodus', enabled: modes?.standardBranded ?? true },
      { value: 'white_label' as const, label: 'PDF sin logo', enabled: Boolean(modes?.whiteLabel) },
      { value: 'custom_brand' as const, label: 'PDF con mi logo', enabled: Boolean(modes?.customBrand) },
    ].filter((mode) => mode.enabled);
  }, [pdfOptionsQuery.data]);
  const exportFormatOptions = useMemo(
    () => [
      { value: 'pdf' as const, label: 'PDF' },
      { value: 'pptx' as const, label: 'PowerPoint' },
      { value: 'xlsx' as const, label: 'Excel' },
    ],
    [],
  );
  const selectedExportFormatLabel = exportFormatOptions.find((option) => option.value === selectedExportFormat)?.label ?? 'PDF';
  const isAdminUser = user?.role === 'admin';
  const isAgentActive = selectedAgent?.status ? selectedAgent.status === 'active' : Boolean(selectedAgent?.isActive);
  const canUseSelectedAgent = Boolean(selectedAgent) && (isAgentActive || (isAdminUser && selectedAgent?.status !== 'hidden'));
  const currentFeedbackRunId =
    isCurrentRunForSelectedAgent && runExecution
      ? runExecution.agentRunId
      : selectedAgent?.id
        ? loggedRunIds[selectedAgent.id]
        : undefined;

  const marketplaceStats = [
    {
      label: 'Agentes disponibles',
      value: String(catalogAgents.length),
      icon: Layers3,
    },
    {
      label: 'Categorias activas',
      value: String(Math.max(categories.length - 1, 0)),
      icon: Sparkles,
    },
    {
      label: 'Automatizaciones ejecutadas',
      value: String(executionsQuery.data?.length ?? 0),
      icon: Zap,
    },
  ];

  const ensureNodusIaCredit = async () => {
    setLimitNotice('');
    setShowUpgradePanel(false);
    return true;
  };

  const logAgentUsage = (agentId: string, operationName: string, result: Record<string, unknown>, pdfGenerated = false) => {
    const outputTokens = Math.max(1, Math.round(JSON.stringify(result).length / 4));
    const executiveSummary = result.executive_summary;
    const summaryText =
      typeof executiveSummary === 'object' && executiveSummary && 'final_recommendation' in executiveSummary
        ? String((executiveSummary as { final_recommendation?: unknown }).final_recommendation)
        : String(executiveSummary ?? result.final_recommendation ?? 'Resultado generado');
    void recordAgentUsage({
      agentId,
      operationName,
      model: 'AI Engine',
      outputTokens,
      totalTokens: outputTokens,
      pdfGenerated,
      outputData: {
        status: 'completed',
        summary: summaryText,
      },
    })
      .then((response) => {
        if (response.agentRunId) {
          setLoggedRunIds((current) => ({ ...current, [agentId]: response.agentRunId ?? '' }));
        }
      })
      .catch(() => undefined);
  };

  const handleRunAgent = async () => {
    if (!selectedAgent) {
      return;
    }

    if (!isAgentActive) {
      toast({
        title: selectedAgent.status === 'coming_soon' ? 'Agente proximamente' : 'Agente no disponible',
        description: 'El administrador puede cambiar la disponibilidad desde Gestion de agentes IA.',
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

    const inputData = selectedAgent.inputs.reduce<Record<string, string>>((acc, label) => {
      acc[label] = agentInputs[label]?.trim() ?? '';
      return acc;
    }, {});

    runMutation.mutate(
      {
        agentId: selectedAgent.id,
        inputData,
      },
    );
  };

  const handleComparisonFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const maxFiles = 5;
    const maxFileSizeMb = 10;
    const hasUnsupportedFile = files.some((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return !extension || !['pdf', 'docx', 'xlsx', 'csv', 'png', 'jpg', 'jpeg'].includes(extension);
    });
    if (hasUnsupportedFile) {
      toast({
        title: 'Formato no soportado para este agente.',
        description: 'Formatos permitidos: PDF, DOCX, XLSX, CSV, JPG, JPEG y PNG.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    if (files.length > maxFiles) {
      toast({
        title: `Puedes subir como máximo ${maxFiles} archivos.`,
        description: 'Reduce la cantidad de propuestas para este comparativo.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    if (files.some((file) => file.size > maxFileSizeMb * 1024 * 1024)) {
      toast({
        title: 'Un archivo supera el tamaño permitido.',
        description: `Cada archivo debe pesar ${maxFileSizeMb} MB como máximo.`,
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    setUploadedComparisonFiles(files);
  };

  const handleProposalComparison = async () => {
    if (!selectedAgent) {
      return;
    }

    if (!comparisonService.trim()) {
      toast({
        title: 'Falta el servicio o categoría',
        description: 'Indica qué servicio, producto o categoría deseas comparar.',
        variant: 'destructive',
      });
      return;
    }

    if (uploadedComparisonFiles.length < 2) {
      toast({
        title: 'Faltan propuestas',
        description: 'Sube al menos 2 propuestas de proveedores para iniciar el análisis.',
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

    setProposalProgressStep(0);
    proposalComparisonMutation.mutate(
      {
        title: selectedAgent.name,
        service: comparisonService.trim(),
        objective: comparisonObjective.trim(),
        files: uploadedComparisonFiles,
      },
      {
        onSuccess: (result) => {
          logAgentUsage(selectedAgent.id, 'Comparativo de propuestas de proveedores', result as unknown as Record<string, unknown>);
          toast({
            title: 'Análisis completado',
            description: 'El comparativo ya está listo para revisar.',
          });
        },
        onError: (error) => {
          toast({
            title: 'No se pudo analizar',
            description: getProposalComparisonErrorMessage(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const updateTermsField = (name: string, value: string) => {
    setTermsFields((current) => ({ ...current, [name]: value }));
  };

  const getUsableTermsSuggestion = (placeholder?: string) => {
    const suggestion = placeholder?.trim();
    if (!suggestion) return '';
    return suggestion.replace(/^(ejemplo|sugerencia)\s*:\s*/i, '').trim();
  };

  const applyTermsFieldSuggestion = (field: TermsFormField) => {
    const suggestion = getUsableTermsSuggestion(field.placeholder);
    if (!suggestion) return;
    updateTermsField(field.name, suggestion);
    toast({
      title: 'Sugerencia aplicada',
      description: 'Puedes editar el texto antes de generar los documentos.',
    });
  };

  const handleCreateTermsForm = () => {
    if (!termsInitialDescription.trim()) {
      toast({
        title: 'Describe primero qué necesitas realizar.',
        description: 'Agrega una descripción inicial para crear el formulario inteligente.',
        variant: 'destructive',
      });
      return;
    }

    termsFormSchemaMutation.mutate(termsInitialDescription.trim(), {
      onSuccess: (schema) => {
        const nextFields: Record<string, string> = {};
        schema.form_sections.forEach((section) => {
          section.fields.forEach((field) => {
            if (field.type !== 'file' && field.type !== 'multiselect') {
              nextFields[field.name] = termsFields[field.name] ?? '';
            }
          });
        });
        nextFields.requirement_type = nextFields.requirement_type || schema.requirement_type;
        nextFields.category = nextFields.category || schema.detected_category;
        setTermsFields(nextFields);
        setTermsSafetyRequirements(schema.recommended_safety_requirements);
        setTermsCurrentStep(1);
        toast({
          title: 'Formulario inteligente creado',
          description: 'Revisa la categoría sugerida y completa los campos del requerimiento.',
        });
      },
      onError: (error) => {
        toast({
          title: 'No se pudo generar el formulario inteligente. Intenta nuevamente.',
          description: error instanceof Error ? error.message : 'No se pudo conectar con el motor de IA.',
          variant: 'destructive',
        });
      },
      });
  };

  const ensureExportModeAllowed = async () => {
    if (!selectedAgentKey) {
      throw new Error('Selecciona un agente antes de descargar el resultado.');
    }

    await validateAgentPdfMode({ agentKey: selectedAgentKey, pdfMode: selectedPdfMode });
  };

  const canDownloadQuality = (qualityId: string, report?: DeliverableQualityReport) => {
    if (!report) return false;
    if (report.status === 'blocked') return false;
    if (report.status === 'approved_with_warnings') return Boolean(confirmedQualityWarnings[qualityId]);
    return true;
  };

  const renderExportControls = (
    onDownload: () => void | Promise<void>,
    contextLabel?: string,
    quality?: { id: string; report?: DeliverableQualityReport },
  ) => (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>Formato</span>
      <select
        value={selectedExportFormat}
        onChange={(event) => setSelectedExportFormat(event.target.value as AgentExportFormat)}
        className="h-9 rounded-full border border-border bg-background px-3 text-xs text-foreground"
      >
        {exportFormatOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <span>Plantilla</span>
      <select
        value={selectedPdfMode}
        onChange={(event) => setSelectedPdfMode(event.target.value as AgentPdfMode)}
        className="h-9 rounded-full border border-border bg-background px-3 text-xs text-foreground"
      >
        {availablePdfModes.map((mode) => (
          <option key={mode.value} value={mode.value}>{mode.label}</option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => void onDownload()}
        disabled={isExportingResult || (quality ? !canDownloadQuality(quality.id, quality.report) : false)}
      >
        <Download className="mr-2 h-4 w-4" />
        {isExportingResult ? 'Preparando...' : `Descargar ${selectedExportFormatLabel}${contextLabel ? ` ${contextLabel}` : ''}`}
      </Button>
    </div>
  );

  const renderDeliverableQualityReview = (qualityId: string, report?: DeliverableQualityReport) => {
    if (!report) return null;
    const tone = report.status === 'approved'
      ? 'border-success/20 bg-success/10'
      : report.status === 'approved_with_warnings'
        ? 'border-amber-200 bg-amber-50'
        : 'border-destructive/20 bg-destructive/10';
    const label = report.status === 'approved'
      ? 'Aprobado'
      : report.status === 'approved_with_warnings'
        ? 'Aprobado con advertencias'
        : 'Requiere informacion adicional';

    return (
      <div data-export-hidden="true" className={`rounded-2xl border p-4 text-sm ${tone}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              {report.status === 'blocked' ? <TriangleAlert className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
              <span>Revision del entregable</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.userMessage}</p>
          </div>
          <Badge variant="outline" className="bg-white/80">
            {label} · {report.score}/100
          </Badge>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Datos detectados</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {report.detectedData.length ? report.detectedData.join(', ') : 'Contenido ejecutivo disponible'}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Faltantes criticos</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {report.missingFields.critical.length ? report.missingFields.critical.join(', ') : 'Sin faltantes criticos detectados'}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Sugerencias</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {report.suggestions.length ? report.suggestions.slice(0, 3).join(' | ') : 'No se requieren datos adicionales'}
            </p>
          </div>
        </div>

        {report.warnings.length ? (
          <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-muted-foreground">
            {report.warnings.slice(0, 2).join(' ')}
          </p>
        ) : null}

        {report.status === 'approved_with_warnings' ? (
          <label className="mt-3 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(confirmedQualityWarnings[qualityId])}
              onChange={(event) => setConfirmedQualityWarnings((current) => ({ ...current, [qualityId]: event.target.checked }))}
              className="mt-0.5"
            />
            <span>Entiendo que el archivo se generara con la informacion disponible y que puede no alcanzar la maxima calidad posible por falta de datos complementarios.</span>
          </label>
        ) : null}
      </div>
    );
  };

  const addTermsFiles = (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    const mergedFiles = [...termsFiles, ...selectedFiles].filter(
      (file, index, allFiles) =>
        index === allFiles.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified),
    );
    const validationMessage = validateTermsFiles(mergedFiles);
    if (validationMessage) {
      toast({
        title: validationMessage,
        description: 'Formatos soportados: PDF, hojas de cálculo, CSV, imágenes y documentos compatibles.',
        variant: 'destructive',
      });
      return;
    }
    setTermsFiles(mergedFiles);
  };

  const handleTermsFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    addTermsFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleTermsDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsTermsDropActive(false);
    addTermsFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removeTermsFile = (targetFile: File) => {
    setTermsFiles((current) =>
      current.filter(
        (file) =>
          !(file.name === targetFile.name && file.size === targetFile.size && file.lastModified === targetFile.lastModified),
      ),
    );
  };

  const handleToggleSafetyRequirement = (value: string) => {
    setTermsSafetyRequirements((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const updateDashboardForm = (field: keyof typeof dashboardForm, value: string) => {
    setDashboardForm((current) => ({ ...current, [field]: value }));
  };

  const addDashboardFiles = (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    const duplicateFiles = selectedFiles.filter((file) =>
      dashboardFiles.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified),
    );
    const mergedFiles = [...dashboardFiles, ...selectedFiles].filter(
      (file, index, allFiles) =>
        index === allFiles.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified),
    );
    const validationMessage = validateTermsFiles(mergedFiles);
    if (validationMessage) {
      toast({
        title: validationMessage,
        description: 'Formatos soportados: XLSX, CSV, PDF, DOCX, JPG, JPEG y PNG.',
        variant: 'destructive',
      });
      return;
    }
    if (mergedFiles.length > 8) {
      toast({
        title: 'Puedes subir como máximo 8 archivos.',
        description: 'Reduce la cantidad de archivos de datos para este dashboard.',
        variant: 'destructive',
      });
      return;
    }
    setDashboardFiles(mergedFiles);
    setDashboardProgressStep(0);
    setDashboardUploadPercent(0);
    if (duplicateFiles.length) {
      toast({
        title: 'Se omitieron archivos duplicados.',
        description: `${duplicateFiles.length} archivo(s) ya estaban cargados en el dashboard.`,
      });
    }
  };

  const handleDashboardFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    addDashboardFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDashboardDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDashboardDropActive(false);
    addDashboardFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removeDashboardFile = (targetFile: File) => {
    setDashboardFiles((current) =>
      current.filter(
        (file) =>
          !(file.name === targetFile.name && file.size === targetFile.size && file.lastModified === targetFile.lastModified),
      ),
    );
  };

  const handleCreateDashboard = async () => {
    if (!selectedAgent) return;
    if (!(await ensureNodusIaCredit())) return;

    if (!dashboardForm.title.trim() || !dashboardForm.objective.trim()) {
      toast({
        title: 'Completa los campos obligatorios.',
        description: 'Nombre y objetivo del dashboard son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    if (!dashboardFiles.length) {
      toast({
        title: 'Sube al menos un archivo de datos para crear el dashboard.',
        description: 'Puedes usar Excel, CSV, PDF, DOCX o imágenes.',
        variant: 'destructive',
      });
      return;
    }

    setDashboardProgressStep(0);
    setDashboardUploadPercent(0);
    dashboardCreatorMutation.mutate(
      {
        title: dashboardForm.title.trim(),
        dashboardName: dashboardForm.title.trim(),
        objective: dashboardForm.objective.trim(),
        objectiveInstructions: dashboardForm.objective.trim(),
        audience: dashboardForm.audience,
        period: dashboardForm.period,
        dataType: dashboardForm.dataType,
        visualizationFocus: dashboardForm.visualizationFocus,
        dashboardFocus: dashboardForm.visualizationFocus,
        additionalContext: dashboardForm.additionalContext,
        useLlmInsights: true,
        files: dashboardFiles,
        onProgress: ({ stage, uploadPercent }) => {
          setDashboardProgressStep((current) => Math.max(current, getDashboardProgressStageIndex(stage)));
          if (typeof uploadPercent === 'number') setDashboardUploadPercent(uploadPercent);
        },
      },
      {
        onSuccess: (result) => {
          logAgentUsage(selectedAgent.id, 'Creador de Dashboard', result as unknown as Record<string, unknown>, false);
          toast({
            title: 'Dashboard creado',
            description: 'El dashboard visual ya está listo para revisar.',
          });
        },
        onError: (error) => {
          toast({
            title: 'No se pudo generar el dashboard.',
            description: getDashboardErrorMessage(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleGenerateTerms = async () => {
    const dynamicFormData = Object.fromEntries(
      Object.entries(termsFields).filter(([key]) => key.startsWith('dynamic_')),
    );
    const contextValue = [
      termsInitialDescription,
      termsFields.location,
      termsFields.important_observations,
      termsFields.dynamic_important_observations,
      termsFields.additional_instructions,
      termsFields.requesting_area,
      termsFields.request_owner,
      ...Object.entries(dynamicFormData)
        .filter(([key]) => /area|context|observ|solicit|owner|responsable/i.test(key))
        .map(([, value]) => value),
    ].join(' ');
    const requiredChecks = [
      { label: 'nombre del requerimiento', value: termsFields.title },
      { label: 'tipo de compra', value: termsFields.requirement_type },
      { label: 'objetivo', value: termsFields.objective },
      { label: 'alcance o descripción', value: termsFields.scope },
      { label: 'área solicitante o contexto', value: contextValue },
      { label: 'plazo o fecha estimada', value: termsFields.required_date },
    ];
    const missingLabels = requiredChecks.filter((item) => !item.value?.trim()).map((item) => item.label);

    if (!termsInitialDescription.trim()) {
      toast({
        title: 'Describe primero qué necesitas realizar.',
        description: 'Ese texto inicial ayuda a la IA a contextualizar el término de referencia.',
        variant: 'destructive',
      });
      return;
    }

    if (missingLabels.length) {
      toast({
        title: 'Completa los campos mínimos del TDR.',
        description: `Falta completar: ${missingLabels.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

    setTermsProcessingStep(termsFiles.length ? 0 : 2);
    termsGenerateMutation.mutate(
      {
        initialDescription: termsInitialDescription.trim(),
        fields: termsFields,
        safetyRequirements: termsSafetyRequirements,
        dynamicFormData,
        files: termsFiles,
      },
      {
        onSuccess: (result) => {
          setTermsEditedResult(result as unknown as Record<string, unknown>);
          setTermsPendingReview(null);
          if (selectedAgent) {
            logAgentUsage(selectedAgent.id, 'Elaboración de términos de referencia', result as unknown as Record<string, unknown>);
          }
          toast({
            title: 'Término de referencia generado',
            description: 'El documento ya está listo para revisar y descargar.',
          });
        },
        onError: (error) => {
          toast({
            title: 'No se pudo generar el término de referencia.',
            description: getTermsErrorMessage(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleExportResult = async (input: {
    title: string;
    result: Record<string, unknown>;
    fileName: string;
    operationName: string;
    captureElementId?: string;
    termsScope?: TermsExportScope;
    qualityId: string;
    qualityReport: DeliverableQualityReport;
  }) => {
    try {
      if (input.qualityReport.status === 'blocked') {
        throw new Error(input.qualityReport.userMessage);
      }
      if (input.qualityReport.status === 'approved_with_warnings' && !confirmedQualityWarnings[input.qualityId]) {
        throw new Error('Confirma que deseas continuar con la informacion disponible antes de descargar.');
      }
      setIsExportingResult(true);
      await ensureExportModeAllowed();
      await downloadAgentResult({
        title: input.title,
        agentName: selectedAgent?.name,
        userName: user?.fullName,
        result: input.termsScope?.hasPendingWarnings ? input.result : input.qualityReport.sanitizedPayload,
        fileName: input.fileName,
        format: selectedExportFormat,
        agentKey: selectedAgentKey,
        pdfMode: selectedPdfMode,
        pdfOptions: pdfOptionsQuery.data,
        captureElementId: selectedExportFormat === 'pdf' ? input.captureElementId : undefined,
        termsScope: input.termsScope,
      });
      if (selectedAgent) {
        logAgentUsage(selectedAgent.id, `${input.operationName} ${selectedExportFormat.toUpperCase()}`, input.result, selectedExportFormat === 'pdf');
      }
    } catch (error) {
      toast({
        title: 'No se pudo descargar el resultado.',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingResult(false);
    }
  };

  const textValue = (value: unknown, fallback = 'No especificado') => {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.map((item) => textValue(item, '')).filter(Boolean).join('; ') || fallback;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const listRows = (items: unknown[] | undefined, label = 'Detalle') =>
    (items?.length ? items : ['No especificado']).map((item, index) => ({ N: index + 1, [label]: textValue(item) }));

  const recordRows = (record: Record<string, unknown>) =>
    Object.entries(record).map(([key, value]) => ({
      Campo: key.replace(/_/g, ' '),
      Valor: textValue(value),
    }));

  const buildTermsVisibleExport = (result: NonNullable<typeof termsGenerateMutation.data>) => ({
    'Resumen ejecutivo': result.executive_summary,
    'Datos principales': [
      { Campo: 'Nombre', Valor: result.title },
      { Campo: 'Tipo', Valor: result.requirement_type },
      { Campo: 'Categoria', Valor: result.category },
      { Campo: 'Completitud', Valor: `${result.completion_level ?? 'Media'}${result.completion_score ? ` (${result.completion_score}%)` : ''}` },
    ],
    'Metricas': result.dashboard_metrics?.length ? result.dashboard_metrics : [
      { label: 'Riesgo informacion faltante', value: result.risk_level ?? 'Medio', status: 'warning' },
      { label: 'Documentos cargados', value: String(result.supporting_documents_summary.length), status: 'neutral' },
      { label: 'Entregables definidos', value: String(result.generated_document.final_deliverables.length), status: 'complete' },
    ],
    'Flujo del requerimiento': listRows(result.flow_steps?.length ? result.flow_steps : ['Necesidad', 'Alcance', 'Actividades', 'Entregables', 'Requisitos', 'Proveedor'], 'Paso'),
    'Entregables para enviar a proveedores': [
      { Entregable: 'Bases sugeridas para licitación', Detalle: result.tender_bases?.object ?? 'Objeto, alcance, requisitos, criterios y condiciones para solicitar propuestas.' },
      { Entregable: 'Correo a proveedores', Detalle: result.supplier_invitation_email?.subject ?? 'Correo listo para copiar, ajustar y enviar.' },
      { Entregable: 'Siguientes pasos de licitación', Detalle: (result.tender_process?.length ?? 0) > 0 ? `${result.tender_process?.length} pasos sugeridos desde validar el TdR hasta emitir OC o contrato.` : 'Flujo sugerido para invitar, resolver consultas, comparar propuestas y adjudicar.' },
    ],
    'Documento - Datos generales': listRows([
      `Nombre: ${result.generated_document.general_data.requirement_name}`,
      `Tipo: ${result.generated_document.general_data.requirement_type}`,
      `Categoria: ${result.generated_document.general_data.category}`,
      `Ubicacion: ${result.generated_document.general_data.location ?? 'No especificado'}`,
      `Fecha requerida: ${result.generated_document.general_data.required_date ?? 'No especificado'}`,
    ]),
    'Documento - Objetivo': result.generated_document.objective,
    'Documento - Alcance': result.generated_document.scope,
    'Documento - Caracteristicas tecnicas': listRows(result.generated_document.technical_characteristics),
    'Documento - Actividades requeridas': listRows(result.generated_document.required_activities),
    'Documento - Entregables': listRows(result.generated_document.final_deliverables),
    'Documento - Justificacion': result.generated_document.justification,
    'Documento - Requisitos de seguridad': listRows(result.generated_document.safety_requirements),
    'Documento - Condiciones para proveedores': listRows(result.generated_document.supplier_conditions),
    'Documento - Estructura de informe final': listRows(result.generated_document.final_report_structure),
    'Documento - Anexos sugeridos': listRows(result.generated_document.suggested_annexes),
    'Checklist de calidad': result.checklist ?? [],
    'Información que conviene completar antes de enviar': listRows(result.missing_information),
    'Recomendaciones accionables': listRows(result.buyer_recommendations),
    'Bases de licitación - Objeto y alcance': [
      { Campo: 'Objeto', Valor: result.tender_bases?.object ?? 'No especificado' },
      { Campo: 'Alcance', Valor: result.tender_bases?.scope ?? 'No especificado' },
    ],
    'Bases de licitación - Requisitos mínimos del proveedor': listRows(result.tender_bases?.minimum_supplier_requirements),
    'Bases de licitación - Documentación solicitada': listRows(result.tender_bases?.requested_documentation),
    'Bases de licitación - Criterios de evaluación': listRows(result.tender_bases?.evaluation_criteria),
    'Bases de licitación - Condiciones de presentación': listRows(result.tender_bases?.proposal_submission_conditions),
    'Bases de licitación - Criterios de adjudicación': listRows(result.tender_bases?.award_criteria),
    'Bases de licitación - Condiciones de descalificación': listRows(result.tender_bases?.disqualification_conditions),
    'Bases de licitación - Observaciones para compradores': listRows(result.tender_bases?.buyer_observations),
    'Bases de licitación - Advertencia': result.tender_bases?.disclaimer ?? 'Estas bases son una guía inicial y deben ser revisadas por el área de compras, legal o responsable interno antes de enviarse.',
    'Correo sugerido para invitar proveedores': [
      { Campo: 'Asunto', Valor: result.supplier_invitation_email?.subject ?? 'Invitación a presentar propuesta' },
      { Campo: 'Saludo', Valor: result.supplier_invitation_email?.greeting },
      { Campo: 'Cuerpo', Valor: result.supplier_invitation_email?.body },
      { Campo: 'Adjuntos', Valor: (result.supplier_invitation_email?.attached_documents ?? ['Termino de referencia']).join(', ') },
      { Campo: 'Plazo', Valor: result.supplier_invitation_email?.response_deadline ?? 'No especificado' },
      { Campo: 'Contacto', Valor: result.supplier_invitation_email?.contact_details ?? 'No especificado' },
      { Campo: 'Cierre', Valor: result.supplier_invitation_email?.closing },
    ],
    'Proceso de licitación': listRows(result.tender_process?.length ? result.tender_process : [
      'Revisar y ajustar el término de referencia con el usuario interno.',
      'Enviar invitación a proveedores con bases y anexos.',
      'Resolver consultas y consolidar respuestas.',
      'Comparar propuestas y sustentar recomendación.',
      'Emitir orden de compra o contrato según corresponda.',
    ], 'Paso'),
    'Documentos de apoyo leidos': result.supporting_documents_summary ?? [],
    'Disclaimer': result.disclaimer,
  });

  const resolveTermsDownloadScope = (activeTab: string): TermsExportScope => {
    if (['documento', 'matriz', 'calidad'].includes(activeTab)) {
      return { documentCode: 'TDR-01', documentTitle: 'Terminos de Referencia', sections: ['tdr', 'matrizRiesgos', 'calidad'] };
    }
    if (activeTab === 'licitacion') return { documentCode: 'BC-01', documentTitle: 'Bases del Concurso', sections: ['bases'] };
    if (activeTab === 'correo') return { documentCode: 'INV-03', documentTitle: 'Invitacion', sections: ['invitacion'] };
    if (activeTab === 'cronograma') return { documentCode: 'CRO-04', documentTitle: 'Cronograma del Proceso', sections: ['cronograma'] };
    return { documentCode: 'PEN-05', documentTitle: 'Pendientes y Recomendaciones', sections: ['pendientes', 'recomendaciones'] };
  };

  const termsExportContextLabel = resolveTermsDownloadScope(termsActiveTab).documentCode;

  const getTermsProcessCodeForExport = (result: Record<string, unknown>) =>
    textValue(result.process_code, '').trim();

  const withTermsProcessCode = (scope: TermsExportScope, result: Record<string, unknown>): TermsExportScope => ({
    ...scope,
    processCode: getTermsProcessCodeForExport(result),
  });

  const normalizePendingLabel = (token: string) => {
    const label = token
      .replace(/^\[(COMPLETAR|SUGERIDO)(?:\s*[-:]\s*confirmar)?\s*:?\s*/i, '')
      .replace(/\]$/g, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    if (!label) return /sugerido/i.test(token) ? 'Dato sugerido por confirmar' : 'Dato pendiente';
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const normalizePendingKey = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const inferTermsPendingInput = (label: string): Pick<TermsPendingField, 'inputType' | 'group' | 'priority' | 'help' | 'options'> => {
    const normalized = normalizePendingKey(label);
    if (/correo|email|e-mail/.test(normalized)) {
      return { inputType: 'email', group: 'Contactos e invitación', priority: 'alta', help: 'Ingresa un correo válido para consultas o coordinación.' };
    }
    if (/fecha|plazo|convocatoria|adjudicacion|inicio|fin|limite|l[ií]mite/.test(normalized)) {
      return { inputType: 'date', group: 'Fechas y cronograma', priority: 'alta', help: 'Selecciona la fecha aplicable para el documento.' };
    }
    if (/presupuesto|monto|importe|valor|precio/.test(normalized)) {
      return { inputType: 'number', group: 'Condiciones comerciales', priority: 'alta', help: 'Ingresa un monto positivo, sin símbolos ni separadores especiales.' };
    }
    if (/moneda/.test(normalized)) {
      return { inputType: 'select', group: 'Condiciones comerciales', priority: 'media', help: 'Selecciona la moneda del proceso.', options: ['PEN', 'USD', 'EUR', 'Otra'] };
    }
    if (/modalidad/.test(normalized)) {
      return { inputType: 'select', group: 'Datos generales', priority: 'media', help: 'Selecciona o confirma la modalidad del concurso.', options: ['Concurso privado', 'Licitación', 'Solicitud de cotización', 'Compra directa', 'Otra'] };
    }
    if (/medio|envio|presentacion|presentaci[oó]n/.test(normalized)) {
      return { inputType: 'select', group: 'Datos generales', priority: 'media', help: 'Indica cómo se presentarán las propuestas.', options: ['Correo electrónico', 'Plataforma', 'Presencial', 'Mixto', 'Otro'] };
    }
    if (/empresa|postor|contacto|responsable|cargo/.test(normalized)) {
      return { inputType: 'text', group: 'Contactos e invitación', priority: 'alta', help: 'Completa el dato tal como debe aparecer en la invitación.' };
    }
    if (/norma|legal|tecnica|t[eé]cnica|garantia|garant[ií]a|condicion|condici[oó]n|observacion|observaci[oó]n|descripcion|descripci[oó]n/.test(normalized)) {
      return { inputType: 'textarea', group: 'Requisitos técnicos / legales', priority: 'media', help: 'Describe el dato con el nivel de detalle necesario para el proveedor.' };
    }
    if (/codigo|c[oó]digo|entidad/.test(normalized)) {
      return { inputType: 'text', group: 'Datos generales', priority: 'alta', help: normalized.includes('codigo') ? 'Ejemplo: TDR-2026-001 o BN-OBRA-001.' : 'Indica la entidad, empresa o área convocante.' };
    }
    return { inputType: 'text', group: 'Otros pendientes', priority: 'media', help: 'Completa este dato para mejorar el documento antes de descargar.' };
  };

  const cleanSuggestedTermsValue = (token: string) =>
    normalizePendingLabel(token).replace(/^confirmar\s*:\s*/i, '').trim();

  const extractTermsPendingFields = (
    result: Record<string, unknown>,
    scope: TermsExportScope,
  ): TermsPendingField[] => {
    const generatedDocument = (result.generated_document as Record<string, unknown>) ?? {};
    const sourceSections = [
      { section: 'TDR', enabled: scope.sections.includes('tdr'), value: generatedDocument },
      { section: 'Matriz y riesgos', enabled: scope.sections.includes('matrizRiesgos'), value: [generatedDocument.evaluation_matrix, generatedDocument.compliance_matrix, generatedDocument.guarantees_penalties, generatedDocument.identified_risks] },
      { section: 'Calidad', enabled: scope.sections.includes('calidad'), value: [result.checklist, result.quality_check, result.consistency_validation, result.buyer_recommendations, result.recommended_questions] },
      { section: 'Bases', enabled: scope.sections.includes('bases'), value: [result.tender_bases, generatedDocument.evaluation_matrix, generatedDocument.guarantees_penalties] },
      { section: 'Invitación', enabled: scope.sections.includes('invitacion'), value: [result.supplier_invitation_email, result.invited_bidders] },
      { section: 'Cronograma', enabled: scope.sections.includes('cronograma'), value: [result.process_schedule, result.tender_process] },
      { section: 'Pendientes y recomendaciones', enabled: scope.sections.includes('pendientes'), value: [result.missing_information, result.buyer_recommendations, result.recommended_questions, generatedDocument, result.tender_bases, result.supplier_invitation_email, result.process_schedule] },
    ];
    const fields = new Map<string, TermsPendingField>();
    sourceSections.filter((source) => source.enabled).forEach((source) => {
      const text = textValue(source.value, '');
      const matches = text.match(/\[(COMPLETAR|SUGERIDO)[^\]]*\]/gi) ?? [];
      matches.forEach((originalToken) => {
        const id = normalizePendingKey(originalToken).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${scope.documentCode}-${fields.size + 1}`;
        const type = /completar/i.test(originalToken) ? 'COMPLETAR' as const : 'SUGERIDO' as const;
        const label = normalizePendingLabel(originalToken);
        const inferred = inferTermsPendingInput(label);
        const existing = fields.get(originalToken);
        if (existing) {
          fields.set(originalToken, {
            ...existing,
            documentSection: existing.documentSection.includes(source.section)
              ? existing.documentSection
              : `${existing.documentSection}, ${source.section}`,
          });
          return;
        }
        fields.set(originalToken, {
          id,
          label,
          originalToken,
          token: originalToken,
          type,
          documentCode: scope.documentCode,
          document: scope.documentCode,
          documentSection: source.section,
          value: type === 'SUGERIDO' ? cleanSuggestedTermsValue(originalToken) : '',
          replacement: type === 'SUGERIDO' ? cleanSuggestedTermsValue(originalToken) : '',
          ...inferred,
        });
      });
    });
    return Array.from(fields.values()).sort((a, b) => {
      const priorityOrder = { alta: 0, media: 1, baja: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.label.localeCompare(b.label);
    });
  };

  const collectTermsPendingItems = (result: Record<string, unknown>, scope: TermsExportScope) => {
    return extractTermsPendingFields(result, scope);
  };

  const replaceTermsTokens = (value: unknown, replacements: Record<string, string>): unknown => {
    if (typeof value === 'string') {
      return Object.entries(replacements).reduce((text, [token, replacement]) => text.split(token).join(replacement || token), value);
    }
    if (Array.isArray(value)) return value.map((item) => replaceTermsTokens(item, replacements));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceTermsTokens(item, replacements)]));
    }
    return value;
  };

  const exportTermsWithScope = async (scope: TermsExportScope, forceWarnings = false) => {
    if (!termsResult) return;
    const result = termsResult as unknown as Record<string, unknown>;
    const scopedExport = withTermsProcessCode(scope, result);
    const pendingItems = collectTermsPendingItems(result, scopedExport);
    const criticalPending = pendingItems.filter(isCriticalTermsPendingField);
    if (forceWarnings && criticalPending.length) {
      toast({
        title: 'Completa los datos críticos antes de descargar.',
        description: 'Los campos de alta prioridad deben resolverse para evitar un documento incompleto.',
        variant: 'destructive',
      });
      return;
    }
    if (!forceWarnings && pendingItems.length) {
      setTermsPendingReview({ scope: scopedExport, items: pendingItems });
      return;
    }
    if (forceWarnings) setTermsPendingReview(null);
    const scopedQualityReport = auditDeliverableBeforeDownload({
      agentKey: 'terms_of_reference',
      result,
      options: { termsScope: { ...scopedExport, hasPendingWarnings: forceWarnings && pendingItems.some((item) => item.type === 'COMPLETAR') } },
    });
    await handleExportResult({
      title: `${scopedExport.documentCode} ${scopedExport.documentTitle}`,
      result,
      fileName: scopedExport.documentCode,
      operationName: `Descarga ${scopedExport.documentCode}`,
      termsScope: { ...scopedExport, hasPendingWarnings: forceWarnings && pendingItems.some((item) => item.type === 'COMPLETAR') },
      qualityId: 'terms',
      qualityReport: scopedQualityReport,
    });
  };

  const updateTermsPendingReplacement = (id: string, replacement: string) => {
    setTermsPendingReview((current) => current
      ? { ...current, items: current.items.map((item) => item.id === id ? { ...item, replacement, value: replacement } : item) }
      : current);
  };

  const validateTermsPendingField = (item: TermsPendingField) => {
    const value = item.replacement.trim();
    if (!value) return item.type === 'COMPLETAR' ? 'Campo pendiente' : '';
    if (item.inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Correo inválido';
    if (item.inputType === 'date' && Number.isNaN(new Date(value).getTime())) return 'Fecha inválida';
    if (item.inputType === 'number' && (!(Number(value) > 0) || Number.isNaN(Number(value)))) return 'Debe ser un número positivo';
    return '';
  };

  const isCriticalTermsPendingField = (item: TermsPendingField) =>
    item.type === 'COMPLETAR' && item.priority === 'alta' && !item.replacement.trim();

  const applyTermsPendingAndDownload = async () => {
    if (!termsPendingReview || !termsResult) return;
    const invalidFields = termsPendingReview.items.filter((item) => validateTermsPendingField(item));
    if (invalidFields.length) {
      toast({
        title: 'Todavía hay campos sin completar.',
        description: 'Puedes completarlos o descargar con advertencias.',
        variant: 'destructive',
      });
      return;
    }
    const replacements = Object.fromEntries(
      termsPendingReview.items
        .filter((item) => item.replacement.trim())
        .map((item) => [item.token, item.replacement.trim()]),
    );
    const updated = replaceTermsTokens(termsResult as unknown as Record<string, unknown>, replacements) as Record<string, unknown>;
    setTermsEditedResult(updated);
    const scope = withTermsProcessCode(termsPendingReview.scope, updated);
    const updatedQualityReport = auditDeliverableBeforeDownload({
      agentKey: 'terms_of_reference',
      result: updated,
      options: { termsScope: scope },
    });
    setTermsPendingReview(null);
    await handleExportResult({
      title: `${scope.documentCode} ${scope.documentTitle}`,
      result: updated,
      fileName: scope.documentCode,
      operationName: `Descarga ${scope.documentCode}`,
      termsScope: scope,
      qualityId: 'terms',
      qualityReport: updatedQualityReport,
    });
  };

  const handleDownloadTermsResult = async () => {
    if (!termsResult) return;
    await exportTermsWithScope(resolveTermsDownloadScope(termsActiveTab));
  };

  const updateTcoGeneral = (field: keyof typeof tcoGeneral, value: string) => {
    setTcoGeneral((current) => ({ ...current, [field]: value }));
  };

  const handleTcoFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const validationMessage = validateTermsFiles(files);
    if (validationMessage) {
      toast({
        title: validationMessage,
        description: 'Formatos soportados: PDF, DOCX, XLSX, CSV, JPG, JPEG y PNG.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    if (files.length > 8) {
      toast({
        title: 'Puedes subir como máximo 8 archivos.',
        description: 'Reduce la cantidad de documentos de apoyo para este análisis.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    setTcoFiles(files);
  };

  const handleAnalyzeTco = async () => {
    if (!selectedAgent) {
      return;
    }

    const requiredGeneral = [
      tcoGeneral.title,
      tcoGeneral.itemName,
      tcoGeneral.analysisType,
      tcoGeneral.evaluationHorizon,
      tcoGeneral.currency,
    ];

    if (requiredGeneral.some((value) => !value.trim())) {
      toast({
        title: 'Completa los campos obligatorios antes de analizar.',
        description: 'Revisa nombre, producto, tipo de análisis, horizonte y moneda.',
        variant: 'destructive',
      });
      return;
    }

    if (!tcoFiles.length && !tcoGeneral.objective.trim() && !tcoGeneral.generalContext.trim() && !tcoGeneral.additionalInstructions.trim()) {
      toast({
        title: 'Agrega documentos o contexto.',
        description: 'Puedes subir cotizaciones/propuestas o describir la compra para generar un análisis preliminar.',
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

    setTcoProgressStep(0);
    tcoAnalysisMutation.mutate(
      {
        title: tcoGeneral.title.trim(),
        itemName: tcoGeneral.itemName.trim(),
        analysisType: tcoGeneral.analysisType,
        evaluationHorizon: tcoGeneral.evaluationHorizon,
        comparisonUnit: tcoGeneral.comparisonUnit,
        currency: tcoGeneral.currency,
        purchaseVolume: tcoGeneral.purchaseVolume,
        objective: tcoGeneral.objective,
        generalContext: tcoGeneral.generalContext,
        additionalInstructions: tcoGeneral.additionalInstructions,
        files: tcoFiles,
      },
      {
        onSuccess: (result) => {
          logAgentUsage(
            selectedAgent.id,
            'Análisis de Costo Total / TCO',
            result as unknown as Record<string, unknown>,
            false,
          );
          toast({
            title: 'Análisis TCO completado',
            description: 'El análisis de costo total ya está listo para revisar.',
          });
        },
        onError: (error) => {
          toast({
            title: 'No se pudo generar el análisis TCO.',
            description: error instanceof Error ? error.message : 'No se pudo conectar con el motor de IA.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDownloadTcoPdf = async () => {
    if (!tcoAnalysisMutation.data || !tcoQualityReport) return;
    await handleExportResult({
      title: 'Análisis de Costo Total / TCO',
      result: tcoAnalysisMutation.data as unknown as Record<string, unknown>,
      fileName: 'analisis-tco-nodus-ia',
      operationName: 'Descarga análisis TCO',
      captureElementId: 'tco-analysis-export-view',
      qualityId: 'tco',
      qualityReport: tcoQualityReport,
    });
  };

  const handleDownloadDashboardPdf = async () => {
    if (!dashboardCreatorMutation.data || !dashboardQualityReport) return;
    await handleExportResult({
      title: dashboardCreatorMutation.data.dashboard_title || 'Dashboard generado',
      result: dashboardCreatorMutation.data as unknown as Record<string, unknown>,
      fileName: 'dashboard-nodus-ia',
      operationName: 'Descarga dashboard',
      captureElementId: 'dashboard-creator-export-view',
      qualityId: 'dashboard',
      qualityReport: dashboardQualityReport,
    });
  };

  const handleDownloadProposalPdf = async () => {
    if (!proposalComparisonResult || !proposalQualityReport) return;
    await handleExportResult({
      title: 'Comparativos de propuestas de proveedores',
      result: proposalComparisonResult as unknown as Record<string, unknown>,
      fileName: 'comparativo-propuestas-nodus-ia',
      operationName: 'Descarga comparativo de propuestas',
      captureElementId: 'proposal-comparison-export-view',
      qualityId: 'proposal',
      qualityReport: proposalQualityReport,
    });
  };

  const handleDownloadRunPdf = async () => {
    const runExecution = runMutation.data?.execution;
    if (!runExecution || !runQualityReport) return;
    await handleExportResult({
      title: selectedAgent?.name ?? 'Resultado Nodus IA',
      result: runExecution.outputData,
      fileName: 'resultado-nodus-ia',
      operationName: 'Descarga resultado agente',
      qualityId: 'generic-run',
      qualityReport: runQualityReport,
    });
  };

  const handleSubmitFeedback = () => {
    if (!currentFeedbackRunId) {
      toast({
        title: 'Primero ejecuta el agente',
        description: 'El feedback se asocia al resultado generado.',
        variant: 'destructive',
      });
      return;
    }

    feedbackMutation.mutate({
      agentRunId: currentFeedbackRunId,
      stars: feedbackStars,
      feedbackType,
      comment: feedbackComment,
      correctedVersion: feedbackCorrection,
      improvementSuggestion: feedbackType === 'sugerencia' ? feedbackCorrection : undefined,
      errorCategories: feedbackType === 'tuvo_errores' ? ['buyer_reported_error'] : [],
    });
  };

  const proposalComparisonResult = proposalComparisonMutation.data;
  const proposalQualityReport = proposalComparisonResult
    ? auditDeliverableBeforeDownload({ agentKey: 'proposal_comparison', result: proposalComparisonResult })
    : undefined;
  const termsFormSchema = termsFormSchemaMutation.data;
  const termsResult = (termsEditedResult ?? termsGenerateMutation.data) as typeof termsGenerateMutation.data;
  const termsQualityReport = termsResult
    ? auditDeliverableBeforeDownload({ agentKey: 'terms_of_reference', result: termsResult })
    : undefined;
  const termsGeneratedDocuments = termsResult?.generated_documents?.length
    ? termsResult.generated_documents
    : ['TDR', 'Bases del Concurso', 'Invitacion a postores', 'Cronograma'];
  const hasTermsDocument = (name: string) => termsGeneratedDocuments.some((item) => item.toLowerCase().includes(name.toLowerCase()));
  const showTermsTdr = hasTermsDocument('tdr');
  const showTermsBases = hasTermsDocument('bases');
  const showTermsInvitation = hasTermsDocument('invitacion') || hasTermsDocument('invitación');
  const showTermsSchedule = hasTermsDocument('cronograma');
  const termsDefaultTab = showTermsTdr ? 'documento' : showTermsBases ? 'licitacion' : showTermsInvitation ? 'correo' : showTermsSchedule ? 'cronograma' : 'matriz';
  useEffect(() => {
    if (termsResult) setTermsActiveTab(termsDefaultTab);
  }, [termsResult?.title, termsDefaultTab]);
  const tcoResult = tcoAnalysisMutation.data;
  const tcoQualityReport = tcoResult
    ? auditDeliverableBeforeDownload({ agentKey: 'tco_analysis', result: tcoResult })
    : undefined;
  const tcoPresentation = tcoResult ? normalizeTcoForPresentation(tcoResult) : undefined;
  const tcoRecommendation = tcoResult?.strategic_recommendation;
  const tcoExecutiveCards = tcoPresentation?.kpis ?? [];
  const tcoScoreTotals = tcoPresentation?.scorecard.totals ?? [];
  const tcoScoreWinner = tcoScoreTotals[0];
  const tcoWinningFinancial = tcoPresentation?.financialModel.find((item) => textValue(item.alternative, '') === textValue(tcoScoreWinner?.alternative ?? tcoRecommendation?.final_recommended_option ?? tcoResult?.executive_summary.best_alternative, ''));
  const tcoConfidence = tcoPresentation?.scorecard.confidenceLevel || tcoResult?.extracted_data_quality?.confidence_level || 'No especificado';
  const dashboardResult = dashboardCreatorMutation.data;
  const dashboardQualityReport = dashboardResult
    ? auditDeliverableBeforeDownload({ agentKey: 'dashboard_creator', result: dashboardResult })
    : undefined;
  const runQualityReport = isCurrentRunForSelectedAgent && runExecution
    ? auditDeliverableBeforeDownload({ agentKey: selectedAgentKey, result: runExecution.outputData })
    : undefined;
  const dashboardProgressPercent = dashboardProgressStep === 0 && dashboardUploadPercent > 0
    ? Math.max(8, Math.min(18, (dashboardUploadPercent / 100) * 18))
    : ((dashboardProgressStep + 1) / dashboardProgressStages.length) * 100;
  const proposalProgressCompletedSteps = proposalComparisonMutation.isSuccess
    ? proposalProgressStages.length
    : proposalComparisonMutation.isPending
      ? proposalProgressStep
      : proposalComparisonMutation.isError
        ? proposalProgressStep
        : 0;
  const proposalProgressPercent = Math.round((proposalProgressCompletedSteps / proposalProgressStages.length) * 100);
  const termsSections = termsFormSchema ? [...termsFormSchema.form_sections, ...termsContractingExtraSections] : [];
  const termsTotalSteps = termsFormSchema ? termsSections.length + 2 : 1;
  const termsProgressPercent = termsFormSchema
    ? Math.round(((termsCurrentStep + 1) / termsTotalSteps) * 100)
    : termsInitialDescription.trim()
      ? 18
      : 0;
  const termsRequiredFields = useMemo(
    () => termsSections.flatMap((section) => section.fields).filter((field) => field.required && field.type !== 'file' && field.type !== 'multiselect'),
    [termsSections],
  );
  const termsCompletedRequired = termsRequiredFields.filter((field) => Boolean(termsFields[field.name]?.trim())).length;
  const termsMissingRequired = termsRequiredFields.filter((field) => !termsFields[field.name]?.trim());
  const termsRecommendedMissing = termsSections
    .flatMap((section) => section.fields)
    .filter((field) => !field.required && field.type !== 'file' && field.type !== 'multiselect' && !termsFields[field.name]?.trim())
    .slice(0, 6);

  const getTermsSectionStatus = (sectionIndex: number) => {
    const section = termsSections[sectionIndex];
    if (!section) return 'pending';
    const required = section.fields.filter((field) => field.required && field.type !== 'file' && field.type !== 'multiselect');
    if (!required.length) return 'recommended';
    return required.every((field) => termsFields[field.name]?.trim()) ? 'completed' : 'pending';
  };

  const goToNextTermsStep = () => {
    if (!termsFormSchema && !termsInitialDescription.trim()) {
      toast({
        title: 'Describe primero qué necesitas realizar.',
        description: 'La IA necesita ese punto de partida para crear el formulario inteligente.',
        variant: 'destructive',
      });
      return;
    }
    if (!termsFormSchema) {
      handleCreateTermsForm();
      return;
    }
    setTermsCurrentStep((current) => Math.min(current + 1, termsTotalSteps - 1));
  };

  const goToPreviousTermsStep = () => {
    setTermsCurrentStep((current) => Math.max(current - 1, 0));
  };

  const copySupplierEmail = async () => {
    const email = termsResult?.supplier_invitation_email;
    if (!email) return;
    const text = [
      `Asunto: ${email.subject}`,
      '',
      email.greeting,
      '',
      email.body,
      '',
      email.attached_documents?.length ? `Documentos adjuntos: ${email.attached_documents.join(', ')}` : '',
      `Plazo de respuesta: ${email.response_deadline || 'No especificado'}`,
      `Contacto: ${email.contact_details || 'No especificado'}`,
      '',
      email.closing,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Correo copiado', description: 'El texto quedó listo para pegarlo en tu correo.' });
  };

  const renderTermsField = (field: TermsFormField) => {
    if (field.type === 'file') {
      return (
        <div key={field.name} className="min-w-0 space-y-2">
          <label className="text-sm font-medium text-foreground/80">{field.label}</label>
          <p className="text-xs leading-5 text-muted-foreground/70">
            Puedes subir planos con medidas, fichas técnicas, fotos, croquis, documentos previos,
            Excel con cantidades, manuales técnicos o imágenes del estado actual.
          </p>
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsTermsDropActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsTermsDropActive(false);
            }}
            onDrop={handleTermsDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-center transition ${
              isTermsDropActive
                ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/15'
                : 'border-primary/25 bg-primary/5 hover:border-primary/35 hover:bg-primary/10'
            }`}
          >
            <Upload className={`h-5 w-5 ${isTermsDropActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isTermsDropActive ? 'Suelta los documentos aquí' : 'Arrastra documentos o selecciónalos'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                PDF, hojas de cálculo, CSV, imágenes y documentos compatibles. Máximo 8 archivos.
              </p>
              <span className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white">
                Seleccionar archivos
              </span>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png"
              onChange={handleTermsFilesChange}
              className="hidden"
            />
          </label>
          {termsFiles.length ? (
            <div className="space-y-2 rounded-2xl border border-primary/15 bg-white p-3">
              {termsFiles.map((file) => {
                const isSpreadsheet = file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv');
                const FileIcon = isSpreadsheet ? FileSpreadsheet : FileText;
                return (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm text-foreground/80">{file.name}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full border border-primary/15 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                      onClick={() => removeTermsFile(file)}
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    if (field.type === 'multiselect') {
      return (
        <div key={field.name} className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{field.label}</label>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {field.options.map((option) => (
              <label key={option} className="flex min-w-0 items-center gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={termsSafetyRequirements.includes(option)}
                  onChange={() => handleToggleSafetyRequirement(option)}
                  className="h-4 w-4 rounded border-primary/25"
                />
                <span className="min-w-0 break-words">{option}</span>
              </label>
            ))}
          </div>
          {termsSafetyRequirements.includes('Otro') ? (
            <Input
              value={termsFields.safety_other ?? ''}
              onChange={(event) => updateTermsField('safety_other', event.target.value)}
              placeholder="Describe el requisito de seguridad adicional"
              className="rounded-xl border-primary/15"
            />
          ) : null}
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.name} className="min-w-0 space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">{field.label}</label>
          <select
            value={termsFields[field.name] ?? ''}
            onChange={(event) => updateTermsField(field.name, event.target.value)}
            className="h-10 w-full min-w-0 rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground"
            required={field.required}
          >
            <option value="">Selecciona una opción</option>
            {field.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    const Control = field.type === 'textarea' ? Textarea : Input;
    const fieldSuggestion = getUsableTermsSuggestion(field.placeholder);
    const canApplySuggestion = Boolean(fieldSuggestion) && !termsFields[field.name]?.trim();
    return (
      <div key={field.name} className="min-w-0 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-foreground/80">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </label>
          {canApplySuggestion ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2 text-xs text-primary hover:bg-primary/10"
              onClick={() => applyTermsFieldSuggestion(field)}
              aria-label={`Usar sugerencia para ${field.label}`}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Usar sugerencia
            </Button>
          ) : null}
        </div>
        <Control
          value={termsFields[field.name] ?? ''}
          onChange={(event) => updateTermsField(field.name, event.target.value)}
          placeholder={field.placeholder}
          className={field.type === 'textarea' ? 'min-h-[96px] min-w-0 rounded-2xl border-primary/15' : 'min-w-0 rounded-xl border-primary/15'}
          required={field.required}
        />
      </div>
    );
  };

  const renderTermsProcessingPanel = () => {
    const isError = termsGenerateMutation.isError;
    const activeStep = isError ? Math.min(termsProcessingStep, termsProcessingStages.length - 1) : termsProcessingStep;
    const progressValue = isError
      ? Math.max(((activeStep + 1) / termsProcessingStages.length) * 100, 16)
      : ((activeStep + 1) / termsProcessingStages.length) * 100;

    return (
      <div className={`space-y-4 rounded-[8px] border p-5 text-sm shadow-sm ${
        isError ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-primary/15 bg-white text-foreground'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {isError ? <TriangleAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4 animate-pulse text-primary" />}
              <span>
                {isError
                  ? 'No se pudo construir el término de referencia'
                  : 'Analizando información y construyendo término de referencia…'}
              </span>
            </div>
            <p className={`mt-2 text-xs leading-5 ${isError ? 'text-destructive/80' : 'text-muted-foreground'}`}>
              {isError
                ? getTermsErrorMessage(termsGenerateMutation.error)
                : termsProcessingStages[activeStep]?.message ?? 'Procesando información del requerimiento...'}
            </p>
            {!isError ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
                Mantén esta pantalla abierta mientras el agente procesa la información.
              </p>
            ) : null}
          </div>
          {isError ? (
            <Button type="button" variant="outline" className="rounded-full bg-white" onClick={handleGenerateTerms}>
              Reintentar
            </Button>
          ) : null}
        </div>
        <Progress value={progressValue} className={`h-2 ${isError ? 'bg-destructive/10' : 'bg-primary/10 [&>div]:animate-pulse'}`} />
        <div className="grid gap-2 sm:grid-cols-2">
          {termsProcessingStages.map((step, index) => {
            const isCompleted = !isError && index < activeStep;
            const isActive = !isError && index === activeStep;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${
                  isCompleted
                    ? 'bg-primary/5 text-primary'
                    : isActive
                      ? 'border border-primary/20 bg-primary/10 text-primary'
                      : isError && index === activeStep
                        ? 'border border-destructive/20 bg-white text-destructive'
                        : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                    isActive
                      ? 'border-primary bg-primary'
                      : isError && index === activeStep
                        ? 'border-destructive bg-destructive'
                        : 'border-muted-foreground/40 bg-transparent'
                  }`} />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTermsGuidedForm = () => {
    const isReviewStep = Boolean(termsFormSchema) && termsCurrentStep === termsTotalSteps - 1;
    const activeSection = termsFormSchema ? termsSections[termsCurrentStep - 1] : null;
    const activeStatus = activeSection ? getTermsSectionStatus(termsCurrentStep - 1) : 'pending';

    return (
      <div className="min-w-0 space-y-4">
        <div className="min-w-0 rounded-2xl border border-primary/15 bg-primary/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Paso {Math.min(termsCurrentStep + 1, termsTotalSteps)} de {termsTotalSteps}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {termsFormSchema ? `${termsProgressPercent}% completado` : 'Empieza describiendo la necesidad para que la IA cree el formulario.'}
              </p>
            </div>
            {termsFormSchema ? (
              <Badge variant="outline" className="rounded-full bg-white">
                {termsCompletedRequired}/{termsRequiredFields.length} obligatorios completos
              </Badge>
            ) : null}
          </div>
          <Progress value={termsProgressPercent} className="mt-3 h-2 bg-white" />
          {termsFormSchema ? (
            <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
              {['Necesidad inicial', ...termsSections.map((section) => section.section_title), 'Revision'].map((label, index) => {
                const status = index === 0 ? 'completed' : index === termsTotalSteps - 1 ? (termsMissingRequired.length ? 'pending' : 'completed') : getTermsSectionStatus(index - 1);
                return (
                  <button
                    key={`${label}-${index}`}
                    type="button"
                    onClick={() => setTermsCurrentStep(index)}
                    className={`w-[min(150px,70vw)] shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
                      index === termsCurrentStep
                        ? 'border-primary bg-white text-foreground shadow-sm'
                        : 'border-primary/10 bg-white/70 text-muted-foreground hover:bg-white'
                    }`}
                  >
                    <span className="block truncate font-medium">{label}</span>
                    <span className="mt-1 block">
                      {status === 'completed' ? 'Completado' : status === 'recommended' ? 'Recomendado' : 'Pendiente'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {termsCurrentStep === 0 ? (
          <div className="min-w-0 space-y-3 rounded-2xl border border-primary/15 bg-white p-3 sm:p-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">
                ¿Qué necesitas contratar o solicitar?
              </label>
              <Textarea
                value={termsInitialDescription}
                onChange={(event) => setTermsInitialDescription(event.target.value)}
                placeholder="Ejemplo: Necesito mantenimiento de luminarias en planta, reparación de paredes con humedad, servicio de limpieza de oficinas, compra de laptops..."
                className="min-h-[112px] min-w-0 rounded-2xl border-primary/15"
                required
              />
            </div>
            <Button
              type="button"
              className="w-full rounded-full bg-primary hover:bg-primary sm:w-auto"
              onClick={handleCreateTermsForm}
              disabled={termsFormSchemaMutation.isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {termsFormSchemaMutation.isPending ? 'Creando formulario inteligente...' : 'Crear formulario inteligente'}
            </Button>
          </div>
        ) : null}

        {termsFormSchema && activeSection ? (
          <div className="min-w-0 space-y-4 rounded-2xl border border-primary/15 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{activeSection.section_title}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Estado: {activeStatus === 'completed' ? 'completado' : activeStatus === 'recommended' ? 'recomendado' : 'pendiente'}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {termsFormSchema.detected_category}
              </Badge>
            </div>
            <div className="grid min-w-0 gap-3">
              {activeSection.fields.map((field) => renderTermsField(field))}
            </div>
          </div>
        ) : null}

        {termsFormSchema && isReviewStep ? (
          <div className="min-w-0 space-y-4 rounded-2xl border border-primary/15 bg-white p-3 sm:p-4">
            <div className="grid min-w-0 gap-3 lg:grid-cols-3">
              <div className="min-w-0 rounded-xl bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Categoria</p>
                <p className="mt-1 break-words text-sm font-medium text-foreground">{termsFormSchema.detected_category}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Tipo</p>
                <p className="mt-1 break-words text-sm font-medium text-foreground">{termsFormSchema.requirement_type}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Complejidad</p>
                <p className="mt-1 break-words text-sm font-medium text-foreground">{termsFormSchema.complexity}</p>
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-primary/15 p-3">
                <p className="text-sm font-medium text-foreground">Campos completos</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{termsCompletedRequired}/{termsRequiredFields.length}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Obligatorios para generar un TdR corporativo.</p>
              </div>
              <div className="min-w-0 rounded-xl border border-primary/15 p-3">
                <p className="text-sm font-medium text-foreground">Documentos cargados</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{termsFiles.length}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Se usarán como contexto temporal.</p>
              </div>
            </div>
            {termsMissingRequired.length ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">Campos obligatorios pendientes</p>
                <ul className="mt-2 space-y-1 text-sm text-destructive">
                  {termsMissingRequired.map((field) => <li key={field.name}>- {field.label}</li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-foreground/80">
                El requerimiento tiene los campos obligatorios listos para generar el término de referencia.
              </div>
            )}
            {termsRecommendedMissing.length ? (
              <div className="rounded-xl border border-primary/15 p-3">
                <p className="text-sm font-medium text-foreground">Información recomendable por completar</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {termsRecommendedMissing.map((field) => <li key={field.name}>- {field.label}</li>)}
                </ul>
              </div>
            ) : null}
            {termsFormSchema.notes_for_buyer.length ? (
              <div className="rounded-xl border border-primary/15 p-3">
                <p className="text-sm font-medium text-foreground">Advertencias y sugerencias</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {termsFormSchema.notes_for_buyer.map((note) => <li key={note}>- {note}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">Al generar también recibirás</p>
              <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-3">
                {[
                  ['Bases sugeridas para licitación', 'Objeto, alcance, documentación solicitada, criterios de evaluación y advertencia de revisión interna/legal.'],
                  ['Correo para invitar proveedores', 'Asunto, cuerpo del correo, adjuntos sugeridos, plazo de respuesta y cierre profesional.'],
                  ['Proceso sugerido de licitación', 'Pasos para validar TdR, invitar proveedores, recibir consultas, comparar propuestas y adjudicar.'],
                ].map(([title, description]) => (
                  <div key={title} className="min-w-0 rounded-xl border border-primary/10 bg-white p-3">
                    <p className="break-words text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {termsGenerateMutation.isPending || termsGenerateMutation.isError ? renderTermsProcessingPanel() : null}

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={goToPreviousTermsStep} disabled={termsCurrentStep === 0 || termsGenerateMutation.isPending}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={goToNextTermsStep} disabled={termsCurrentStep >= termsTotalSteps - 1 || termsGenerateMutation.isPending}>
            Siguiente
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderTermsList = (items?: string[]) => (
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      {(items?.length ? items : ['No especificado']).map((item) => <li key={item}>- {item}</li>)}
    </ul>
  );

  const renderTermsPendingInput = (item: TermsPendingField) => {
    const commonClass = 'mt-2 min-w-0 rounded-xl border-amber-200 bg-white';
    if (item.inputType === 'textarea') {
      return (
        <Textarea
          value={item.replacement}
          onChange={(event) => updateTermsPendingReplacement(item.id, event.target.value)}
          placeholder={`Completa ${item.label.toLowerCase()}`}
          className={`${commonClass} min-h-[88px]`}
        />
      );
    }
    if (item.inputType === 'select') {
      return (
        <select
          value={item.replacement}
          onChange={(event) => updateTermsPendingReplacement(item.id, event.target.value)}
          className={`${commonClass} h-10 w-full px-3 text-sm text-foreground`}
        >
          <option value="">Selecciona una opción</option>
          {(item.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    return (
      <Input
        type={item.inputType}
        value={item.replacement}
        min={item.inputType === 'number' ? 0 : undefined}
        step={item.inputType === 'number' ? '0.01' : undefined}
        onChange={(event) => updateTermsPendingReplacement(item.id, event.target.value)}
        placeholder={`Completa ${item.label.toLowerCase()}`}
        className={commonClass}
      />
    );
  };

  const renderAgentFeedbackPanel = () => {
    if (!currentFeedbackRunId) {
      return null;
    }

    return (
      <div className="rounded-[24px] border border-primary/15 bg-white p-4">
        <p className="text-sm font-medium text-foreground">¿Cómo fue tu experiencia con este agente?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setFeedbackStars(star)}
              className={`h-9 w-9 rounded-full border text-sm font-semibold ${
                feedbackStars >= star
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/15 bg-white text-muted-foreground'
              }`}
              aria-label={`${star} estrellas`}
            >
              ★
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['me_sirvio', 'Me sirvió'],
            ['tuvo_errores', 'Tuvo errores'],
            ['sugerencia', 'Quiero sugerir una mejora'],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={feedbackType === value ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setFeedbackType(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Textarea
          value={feedbackComment}
          onChange={(event) => setFeedbackComment(event.target.value)}
          placeholder="Cuéntanos qué funcionó, qué falló o qué mejorarías."
          className="mt-3 min-h-[88px] rounded-2xl border-primary/15"
        />
        <Textarea
          value={feedbackCorrection}
          onChange={(event) => setFeedbackCorrection(event.target.value)}
          placeholder="Si deseas, escribe cómo debería corregirse."
          className="mt-3 min-h-[72px] rounded-2xl border-primary/15"
        />
        <Button
          type="button"
          className="mt-3 rounded-full bg-primary hover:bg-primary"
          onClick={handleSubmitFeedback}
          disabled={feedbackMutation.isPending}
        >
          {feedbackMutation.isPending ? 'Enviando feedback...' : 'Enviar feedback'}
        </Button>
      </div>
    );
  };

  const renderValueList = (items: unknown) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return <p className="text-sm text-muted-foreground">Sin datos.</p>;
    }

    return (
      <ul className="space-y-1 text-sm text-muted-foreground">
        {list.map((item, index) => (
          <li key={`${String(item)}-${index}`}>- {String(item)}</li>
        ))}
      </ul>
    );
  };

  const renderRecordBlock = (record: Record<string, unknown>) => (
    <div className="space-y-1 text-sm text-muted-foreground">
      {Object.entries(record).map(([key, value]) => (
        <p key={key}>
          <span className="font-medium text-foreground">{key.replace(/_/g, ' ')}:</span>{' '}
          {Array.isArray(value)
            ? value.join('; ')
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value ?? 'No especificado')}
        </p>
      ))}
    </div>
  );

  return (
    <div className="responsive-agent-page min-w-0 space-y-6 pb-8">
      <section className="overflow-hidden rounded-2xl border border-[#2e24ba]/15 bg-[linear-gradient(135deg,#1f1fae_0%,#3325b8_38%,#4f31cb_70%,#6844dc_100%)] shadow-[0_24px_60px_rgba(54,33,170,0.22)] sm:rounded-[32px]">
        <div className="grid min-w-0 gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.35fr_0.95fr] lg:items-center lg:px-8 lg:py-9">
          <div className="min-w-0">
            <Badge
              variant="outline"
              className="border-white/20 bg-white/10 px-4 py-1 text-[13px] font-medium uppercase tracking-[0.24em] text-white backdrop-blur-sm"
            >
              Nodus IA
            </Badge>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Buyer agentes
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 md:text-[1.1rem] md:leading-8">
              Explora agentes especializados, activa automatizaciones y ejecuta flujos de compras
              en un entorno simple, visual y escalable para sourcing, riesgo, logistica y
              negociacion.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:items-end lg:justify-center">
            <div className="grid w-full gap-3 lg:max-w-[420px] lg:grid-cols-1">
              {marketplaceStats.map((item) => {
                const Icon = item.icon;

                return (
                  <Card
                    key={item.label}
                    className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur-sm"
                  >
                    <CardHeader className="pb-3">
                      <CardDescription className="flex items-center gap-2 text-white/75">
                        <Icon className="h-4 w-4 text-white/80" />
                        {item.label}
                      </CardDescription>
                      <CardTitle className="text-3xl text-white">{item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {!isDetailView ? (
      <section className="space-y-6">
        <Card className="min-w-0 border-primary/15 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Marketplace de agentes IA</CardTitle>
            <CardDescription>
              Filtra por categoria o automatizacion y abre la ficha completa de cada agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, caso de uso o descripcion"
                className="h-11 rounded-2xl border-primary/15 pl-11"
              />
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {filteredAgents.map((agent) => {
                const Icon = getAgentIcon(agent.icon);
                const isSelected = selectedAgentId === agent.id;
                const status = agent.status ?? (agent.isActive ? 'active' : 'coming_soon');
                const statusLabel =
                  status === 'active'
                    ? 'Activo'
                    : status === 'coming_soon'
                      ? 'Proximamente'
                      : status === 'disabled'
                        ? 'No disponible'
                        : 'Oculto';

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => navigate(`/nexu-ia/${agent.id}`)}
                    className={`min-w-0 rounded-[22px] border p-4 text-left transition-all sm:rounded-[26px] sm:p-5 ${
                      isSelected
                        ? 'border-primary/25 bg-[var(--gradient-soft)] shadow-md'
                        : status === 'active'
                          ? 'border-primary/15 bg-white hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm'
                          : 'border-primary/10 bg-muted/30 opacity-85 hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: 'var(--color-blue-buyer)' }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-primary/15 text-muted-foreground">
                        {statusLabel}
                      </Badge>
                    </div>

                    <h3 className="mt-4 break-words text-lg font-medium text-foreground">{agent.name}</h3>
                    <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{agent.description}</p>

                    <div className="mt-4 rounded-2xl bg-primary/5 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Caso de uso
                      </p>
                      <p className="mt-1 text-sm text-foreground/80">{agent.useCase}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Badge className="border border-primary/20 bg-primary/12 text-primary hover:bg-primary/18">
                        {agent.automationType}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground/80">
                        {status === 'active' ? 'Usar agente' : statusLabel}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {!filteredAgents.length ? (
              <div className="rounded-[24px] border border-dashed border-primary/15 bg-primary/5 p-6 text-sm text-muted-foreground/70">
                No hay agentes disponibles en este momento.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
      ) : (
      <section className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/nexu-ia')}
          className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-primary/25 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Regresar
        </button>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 overflow-hidden border-primary/15 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-[var(--gradient-soft)]">
              <CardDescription>Vista detalle del agente</CardDescription>
              <CardTitle className="break-words text-lg text-foreground sm:text-xl">
                {selectedAgent ? selectedAgent.name : 'Selecciona un agente'}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-6 p-4 sm:p-6">
              {detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground/70">Cargando detalle del agente...</p>
              ) : selectedAgent ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="border-primary/15 text-muted-foreground">
                      {selectedAgent.category}
                    </Badge>
                    <Badge className="border border-primary/20 bg-primary/12 text-primary hover:bg-primary/18">
                      {selectedAgent.automationType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={canUseSelectedAgent ? 'border-success/25 text-success-foreground' : 'border-destructive/20 text-destructive'}
                    >
                      {isAgentActive
                        ? 'Activo'
                        : isAdminUser
                          ? 'Disponible para admin'
                        : selectedAgent.status === 'coming_soon'
                          ? 'Proximamente'
                          : 'No disponible'}
                    </Badge>
                  </div>

                  {!canUseSelectedAgent ? (
                    <div className="rounded-2xl border border-primary/15 bg-muted/40 p-4 text-sm text-muted-foreground">
                      Este agente esta marcado como {selectedAgent.status === 'coming_soon' ? 'Proximamente' : 'no disponible'}.
                      La card se mantiene visible y bloqueada hasta que administracion lo active.
                    </div>
                  ) : null}

                  <p className="break-words text-sm leading-6 text-muted-foreground">{selectedAgent.longDescription}</p>

                  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <div className="min-w-0 rounded-[20px] border border-primary/15 bg-primary/5 p-4 sm:rounded-[24px]">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Funcionalidades
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.functionalities.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success-foreground" />
                            <span className="min-w-0 break-words">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-[20px] border border-primary/15 bg-primary/5 p-4 sm:rounded-[24px]">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Beneficios
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.benefits.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                            <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <span className="min-w-0 break-words">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <div className="min-w-0 rounded-[20px] border border-primary/15 p-3 sm:rounded-[24px] sm:p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Inputs requeridos
                      </p>
                      <div className="mt-3 space-y-3">
                        {isTermsReference ? (
                          renderTermsGuidedForm()
                        ) : isQuoteComparator ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground/80">
                                Servicio, producto o categoría a comparar
                              </label>
                              <p className="text-xs text-muted-foreground/70">
                                Aquí indica para qué son las propuestas que vas a comparar.
                              </p>
                              <Textarea
                                value={comparisonService}
                                onChange={(event) => setComparisonService(event.target.value)}
                                placeholder="Ejemplo: Servicio de limpieza integral de oficinas 300 m², pintado de paredes, compra de laptops, mantenimiento preventivo, proveedor logístico…"
                                className="min-h-[92px] rounded-2xl border-primary/15"
                                required
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground/80">
                                Objetivo de la compra
                              </label>
                              <Textarea
                                value={comparisonObjective}
                                onChange={(event) => setComparisonObjective(event.target.value)}
                                placeholder="Ejemplo: Seleccionar el proveedor más conveniente considerando precio, alcance, garantía, condiciones comerciales y riesgo operativo."
                                className="min-h-[92px] rounded-2xl border-primary/15"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground/80">
                                Subir propuestas de proveedores
                              </label>
                              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    Subir PDF, Excel, CSV o imágenes
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">
                                    Carga 2 a 5 propuestas. Los archivos se procesan temporalmente.
                                  </p>
                                </div>
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
                                  onChange={handleComparisonFilesChange}
                                  className="hidden"
                                />
                              </label>
                              {uploadedComparisonFiles.length ? (
                                <div className="space-y-2 rounded-2xl border border-primary/15 bg-white p-3">
                                  {uploadedComparisonFiles.map((file) => {
                                    const isSpreadsheet =
                                      file.name.endsWith('.xls') ||
                                      file.name.endsWith('.xlsx') ||
                                      file.name.endsWith('.csv');
                                    const FileIcon = isSpreadsheet ? FileSpreadsheet : FileText;

                                    return (
                                      <div
                                        key={`${file.name}-${file.size}`}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                                          <span className="truncate text-sm text-foreground/80">{file.name}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground/70">
                                          {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : isDashboardCreator ? (
                          <div className="space-y-5">
                            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 1 - Información general del dashboard</p>
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Nombre del dashboard *</label>
                                  <Input value={dashboardForm.title} onChange={(event) => updateDashboardForm('title', event.target.value)} placeholder="Ejemplo: Dashboard de gastos por proveedor 2026" className="rounded-xl border-primary/15" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Audiencia</label>
                                  <select value={dashboardForm.audience} onChange={(event) => updateDashboardForm('audience', event.target.value)} className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground">
                                    {dashboardAudiences.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-sm font-medium text-foreground/80">Objetivo e instrucciones del dashboard *</label>
                                  <Textarea value={dashboardForm.objective} onChange={(event) => updateDashboardForm('objective', event.target.value)} placeholder="Indica qué quieres analizar, qué columnas priorizar, qué datos excluir, qué enfoque deseas, qué filtros aplicar o qué resultado esperas del dashboard." className="min-h-[88px] rounded-2xl border-primary/15" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Periodo</label>
                                  <Input value={dashboardForm.period} onChange={(event) => updateDashboardForm('period', event.target.value)} placeholder="Ejemplo: enero a marzo 2026" className="rounded-xl border-primary/15" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Tipo de datos</label>
                                  <select value={dashboardForm.dataType} onChange={(event) => updateDashboardForm('dataType', event.target.value)} className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground">
                                    {dashboardDataTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 2 - Archivos de datos</p>
                              <p className="text-xs leading-5 text-muted-foreground/70">
                                Sube Excel, CSV, PDF, imágenes, reportes o documentos con datos. El agente unificará la información y generará un dashboard visual con KPIs, gráficos, tablas, insights y recomendaciones.
                              </p>
                              <label
                                onDragEnter={(event) => {
                                  event.preventDefault();
                                  setIsDashboardDropActive(true);
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onDragLeave={(event) => {
                                  event.preventDefault();
                                  setIsDashboardDropActive(false);
                                }}
                                onDrop={handleDashboardDrop}
                                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-center transition ${
                                  isDashboardDropActive
                                    ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/15'
                                    : 'border-primary/25 bg-white hover:border-primary/35 hover:bg-primary/10'
                                }`}
                              >
                                <Upload className={`h-5 w-5 ${isDashboardDropActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {isDashboardDropActive ? 'Suelta los archivos aquí' : 'Arrastra archivos o selecciónalos'}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">XLSX, CSV, PDF, DOCX, JPG, JPEG o PNG. Máximo 8 archivos.</p>
                                  <span className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white">
                                    Seleccionar archivos
                                  </span>
                                </div>
                                <input type="file" multiple accept=".xlsx,.csv,.pdf,.docx,.jpg,.jpeg,.png" onChange={handleDashboardFilesChange} className="hidden" />
                              </label>
                              {dashboardFiles.length ? (
                                <div className="space-y-2 rounded-2xl border border-primary/15 bg-white p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-foreground">{dashboardFiles.length} archivo(s) cargado(s)</p>
                                    <p className="text-xs text-muted-foreground/70">Puedes quitar archivos antes de crear el dashboard.</p>
                                  </div>
                                  {dashboardFiles.map((file) => {
                                    const isSpreadsheet = file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv');
                                    const FileIcon = isSpreadsheet ? FileSpreadsheet : FileText;
                                    return (
                                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                          <span className="truncate text-sm text-foreground/80">{file.name}</span>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <span className="text-xs text-muted-foreground/70">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                            onClick={() => removeDashboardFile(file)}
                                          >
                                            Quitar
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-1.5 rounded-2xl border border-primary/15 bg-white p-4">
                              <label className="text-sm font-medium text-foreground/80">Paso 3 - Enfoque del dashboard</label>
                              <select value={dashboardForm.visualizationFocus} onChange={(event) => updateDashboardForm('visualizationFocus', event.target.value)} className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground">
                                {dashboardFocusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </div>
                          </div>
                        ) : isTcoAnalysis ? (
                          <div className="space-y-5">
                            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 1 - Datos generales</p>
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Nombre del análisis *</label>
                                  <Input
                                    value={tcoGeneral.title}
                                    onChange={(event) => updateTcoGeneral('title', event.target.value)}
                                    placeholder="Ejemplo: Análisis TCO para compra de equipos ManLift"
                                    className="rounded-xl border-primary/15"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Producto, equipo o servicio *</label>
                                  <Input
                                    value={tcoGeneral.itemName}
                                    onChange={(event) => updateTcoGeneral('itemName', event.target.value)}
                                    placeholder="Ejemplo: ManLift, laptops corporativas, servicio de limpieza"
                                    className="rounded-xl border-primary/15"
                                  />
                                </div>
                                {[
                                  ['analysisType', 'Tipo de análisis', tcoAnalysisTypes],
                                  ['evaluationHorizon', 'Horizonte de evaluación', tcoEvaluationHorizons],
                                  ['currency', 'Moneda base', tcoCurrencies],
                                ].map(([field, label, options]) => (
                                  <div key={String(field)} className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground/80">{String(label)} *</label>
                                    <select
                                      value={String(tcoGeneral[field as keyof typeof tcoGeneral])}
                                      onChange={(event) => updateTcoGeneral(field as keyof typeof tcoGeneral, event.target.value)}
                                      className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground"
                                    >
                                      {(options as string[]).map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground/80">Información importante / instrucciones para el análisis</label>
                                <Textarea
                                  value={tcoGeneral.objective}
                                  onChange={(event) => updateTcoGeneral('objective', event.target.value)}
                                  placeholder="Ejemplo: Considera un horizonte de 5 años, 12 unidades, uso en campo, 25,000 km/año, prioridad en menor TCO, mantenimiento, garantía, consumo, riesgos y valor residual. Usa el Excel adjunto como referencia estructural si existe."
                                  className="min-h-[88px] rounded-2xl border-primary/15"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 2 - Documentos para analizar</p>
                              <p className="text-xs leading-5 text-muted-foreground/70">
                                Sube cotizaciones, propuestas, fichas técnicas, PDFs, Excel, imágenes o documentos comerciales. El agente detectará las alternativas y realizará el análisis TCO con la información disponible.
                              </p>
                              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">Subir documentos para analizar</p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">PDF, DOCX, XLSX, CSV, JPG, JPEG o PNG. Máximo 8 archivos.</p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">También puedes generar un análisis preliminar solo con contexto escrito.</p>
                                </div>
                                <input type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png" onChange={handleTcoFilesChange} className="hidden" />
                              </label>
                              {tcoFiles.length ? (
                                <div className="space-y-2 rounded-2xl border border-primary/15 bg-white p-3">
                                  {tcoFiles.map((file) => {
                                    const isSpreadsheet = file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv');
                                    const FileIcon = isSpreadsheet ? FileSpreadsheet : FileText;
                                    return (
                                      <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                          <span className="truncate text-sm text-foreground/80">{file.name}</span>
                                        </div>
                                        <span className="shrink-0 text-xs text-muted-foreground/70">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>

                          </div>
                        ) : (
                          selectedAgent.inputs.map((inputLabel) => (
                            <div key={inputLabel} className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground/80">{inputLabel}</label>
                              <Input
                                value={agentInputs[inputLabel] ?? ''}
                                onChange={(event) =>
                                  setAgentInputs((current) => ({
                                    ...current,
                                    [inputLabel]: event.target.value,
                                  }))
                                }
                                placeholder={`Ingresa ${inputLabel.toLowerCase()}`}
                                className="rounded-xl border-primary/15"
                              />
                            </div>
                          ))
                        )}
                        {!isQuoteComparator && !isTermsReference && !isDashboardCreator && !isTcoAnalysis ? (
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground/80">
                              Contexto adicional
                            </label>
                            <Textarea
                              value={agentInputs['Contexto adicional'] ?? ''}
                              onChange={(event) =>
                                setAgentInputs((current) => ({
                                  ...current,
                                  'Contexto adicional': event.target.value,
                                }))
                              }
                              placeholder="Agrega instrucciones, restricciones o notas para la ejecucion"
                              className="min-h-[104px] rounded-2xl border-primary/15"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-[20px] border border-primary/15 p-3 sm:rounded-[24px] sm:p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Output esperado
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.outputs.map((item) => (
                          <div key={item} className="flex min-w-0 items-start gap-2 text-sm text-foreground/80">
                            <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <span className="min-w-0 break-words">{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 min-w-0 rounded-[20px] bg-primary/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                          Caso de uso principal
                        </p>
                        <p className="mt-2 break-words text-sm leading-6 text-foreground/80">{selectedAgent.useCase}</p>
                      </div>
                    </div>
                  </div>

                  {limitNotice ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-medium">{limitNotice}</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 rounded-full"
                        onClick={() => setShowUpgradePanel((current) => !current)}
                      >
                        Ver opciones de upgrade
                      </Button>
                    </div>
                  ) : null}

                  {showUpgradePanel ? (
                    <div className="rounded-[24px] border border-primary/15 bg-white p-4">
                      <MonetizationPanel
                        mode="upgrade"
                        focus={(monetizationQuery.data?.membership.plan ?? user?.membership?.plan) === 'free' ? 'plans' : 'credits'}
                        reason={limitNotice || 'Elige un plan o compra créditos para continuar.'}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    {!canUseSelectedAgent ? (
                      <Button type="button" className="rounded-full" disabled>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {selectedAgent.status === 'coming_soon' ? 'Proximamente' : 'Agente bloqueado'}
                      </Button>
                    ) : isTermsReference ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={handleGenerateTerms}
                        disabled={!termsFormSchema || termsGenerateMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {termsGenerateMutation.isPending
                          ? 'Nodus IA está trabajando en tu solicitud…'
                          : 'Generar término de referencia'}
                      </Button>
                    ) : isQuoteComparator ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={handleProposalComparison}
                        disabled={proposalComparisonMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {proposalComparisonMutation.isPending
                          ? 'Analizando propuestas y construyendo comparativo…'
                          : 'Analizar propuestas'}
                      </Button>
                    ) : isDashboardCreator ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={handleCreateDashboard}
                        disabled={dashboardCreatorMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {dashboardCreatorMutation.isPending ? 'Analizando archivos y construyendo dashboard…' : 'Crear dashboard'}
                      </Button>
                    ) : isTcoAnalysis ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={handleAnalyzeTco}
                        disabled={tcoAnalysisMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {tcoAnalysisMutation.isPending ? 'Analizando archivos y construyendo matriz TCO…' : 'Analizar TCO'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          className="rounded-full bg-primary hover:bg-primary"
                          onClick={handleRunAgent}
                          disabled={runMutation.isPending}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          {runMutation.isPending ? 'Nodus IA está trabajando en tu solicitud…' : 'Ejecutar agente'}
                        </Button>
                      </>
                    )}
                  </div>

                  {tcoAnalysisMutation.isPending ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-white p-5 text-sm shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-primary">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                            <span>Analizando archivos y construyendo matriz TCO…</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {tcoProgressStages[tcoProgressStep]?.message ?? 'Construyendo matriz TCO…'}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Paso {Math.min(tcoProgressStep + 1, tcoProgressStages.length)} de {tcoProgressStages.length}
                        </span>
                      </div>

                      <Progress value={((tcoProgressStep + 1) / tcoProgressStages.length) * 100} className="h-2 bg-primary/10 [&>div]:animate-pulse" />

                      <div className="grid gap-2 sm:grid-cols-2">
                        {tcoProgressStages.map((step, index) => {
                          const isCompleted = index < tcoProgressStep;
                          const isActive = index === tcoProgressStep;
                          return (
                            <div
                              key={step.label}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                isCompleted
                                  ? 'border-success/20 bg-success/10 text-success-foreground'
                                  : isActive
                                    ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                                    : 'border-primary/10 bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30'}`} />
                              )}
                              <span>{step.label}{isActive ? '…' : ''}</span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="rounded-2xl bg-primary/5 px-3 py-2 text-xs leading-5 text-primary/75">
                        Mantén esta pantalla abierta mientras el agente procesa la información.
                      </p>
                    </div>
                  ) : null}

                  {dashboardCreatorMutation.isPending ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-white p-5 text-sm shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-primary">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                            <span>Analizando archivos y construyendo dashboard…</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {dashboardProgressStages[dashboardProgressStep]?.message ?? 'Preparando resultado final…'}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Paso {Math.min(dashboardProgressStep + 1, dashboardProgressStages.length)} de {dashboardProgressStages.length}
                        </span>
                      </div>

                      <Progress value={dashboardProgressPercent} className="h-2 bg-primary/10 [&>div]:animate-pulse" />

                      <div className="grid gap-2 sm:grid-cols-2">
                        {dashboardProgressStages.map((step, index) => {
                          const isCompleted = index < dashboardProgressStep;
                          const isActive = index === dashboardProgressStep;
                          return (
                            <div
                              key={step.label}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                isCompleted
                                  ? 'border-success/20 bg-success/10 text-success-foreground'
                                  : isActive
                                    ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                                    : 'border-primary/10 bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30'}`} />
                              )}
                              <span>{step.label}{isActive ? '…' : ''}</span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="rounded-2xl bg-primary/5 px-3 py-2 text-xs leading-5 text-primary/75">
                        Mantén esta pantalla abierta mientras procesamos tu dashboard.
                      </p>
                    </div>
                  ) : null}

                  {isDashboardCreator && dashboardCreatorMutation.isSuccess ? (
                    <div className="space-y-2 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success-foreground">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span>Dashboard listo</span>
                      </div>
                      <Progress value={100} className="h-2 bg-success/10" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Ya puedes revisar y descargar el resultado.
                      </p>
                    </div>
                  ) : null}

                  {isQuoteComparator && proposalComparisonMutation.isPending ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-white p-5 text-sm shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-primary">
                            <Sparkles className="h-4 w-4 animate-pulse" />
                            <span>Analizando propuestas y construyendo comparativo…</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {proposalProgressStages[proposalProgressStep]?.message ?? 'Comparando propuestas de proveedores...'}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Paso {Math.min(proposalProgressStep + 1, proposalProgressStages.length)} de {proposalProgressStages.length}
                        </span>
                      </div>

                      <Progress value={proposalProgressPercent} className="h-2 bg-primary/10 [&>div]:animate-pulse" />

                      <div className="grid gap-2 sm:grid-cols-2">
                        {proposalProgressStages.map((step, index) => {
                          const isCompleted = index < proposalProgressStep;
                          const isActive = index === proposalProgressStep;
                          return (
                            <div
                              key={step.label}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                isCompleted
                                  ? 'border-success/20 bg-success/10 text-success-foreground'
                                  : isActive
                                    ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                                    : 'border-primary/10 bg-muted/30 text-muted-foreground'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30'}`} />
                              )}
                              <span>{step.label}{isActive ? '…' : ''}</span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="rounded-2xl bg-primary/5 px-3 py-2 text-xs leading-5 text-primary/75">
                        Mantén esta pantalla abierta mientras el agente compara las propuestas y prepara el reporte.
                      </p>
                    </div>
                  ) : null}

                  {isQuoteComparator && proposalComparisonMutation.isSuccess ? (
                    <div className="space-y-2 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success-foreground">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span>Comparativo listo</span>
                      </div>
                      <Progress value={100} className="h-2 bg-success/10" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Ya puedes revisar el resultado y descargar el reporte.
                      </p>
                    </div>
                  ) : null}

                  {isQuoteComparator && proposalComparisonMutation.isError ? (
                    <div className="space-y-4 rounded-[24px] border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-semibold">
                            <TriangleAlert className="h-4 w-4" />
                            <span>No se pudo generar el comparativo</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-destructive/80">
                            {getProposalComparisonErrorMessage(proposalComparisonMutation.error)}
                          </p>
                        </div>
                        <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium">
                          Revisión requerida
                        </span>
                      </div>

                      <Progress value={Math.max(proposalProgressPercent, 8)} className="h-2 bg-destructive/10" />

                      <div className="grid gap-2 sm:grid-cols-2">
                        {proposalProgressStages.map((step, index) => {
                          const isCompleted = index < proposalProgressStep;
                          const isError = index === proposalProgressStep;
                          return (
                            <div
                              key={step.label}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                isCompleted
                                  ? 'border-success/20 bg-white text-success-foreground'
                                  : isError
                                    ? 'border-destructive/25 bg-white text-destructive shadow-sm'
                                    : 'border-destructive/10 bg-white/60 text-destructive/55'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : isError ? (
                                <TriangleAlert className="h-3.5 w-3.5" />
                              ) : (
                                <span className="h-2.5 w-2.5 rounded-full bg-destructive/25" />
                              )}
                              <span>{step.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {runMutation.isPending ? (
                    <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-primary">
                      <div className="flex items-center gap-2 font-medium">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span>Nodus IA está trabajando en tu solicitud…</span>
                      </div>
                      <Progress value={72} className="h-2 bg-primary/10 [&>div]:animate-pulse" />
                      <p className="text-xs leading-5 text-primary/70">
                        Mantén esta pantalla abierta mientras el agente procesa la información.
                      </p>
                    </div>
                  ) : null}

                  {isDashboardCreator && dashboardCreatorMutation.isError ? (
                    <div className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      <div className="flex items-center gap-2 font-medium">
                        <TriangleAlert className="h-4 w-4" />
                        <span>No se pudo generar el dashboard</span>
                      </div>
                      <Progress value={Math.max(((dashboardProgressStep + 1) / dashboardProgressStages.length) * 100, 12)} className="h-2 bg-destructive/10" />
                      <p className="text-xs leading-5 text-destructive/80">
                        {getDashboardErrorMessage(dashboardCreatorMutation.error)}
                      </p>
                    </div>
                  ) : null}

                  {isTcoAnalysis && tcoAnalysisMutation.isError ? (
                    <div className="space-y-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      <div className="flex items-center gap-2 font-medium">
                        <TriangleAlert className="h-4 w-4" />
                        <span>No se pudo completar el análisis TCO.</span>
                      </div>
                      <Progress value={Math.max(((tcoProgressStep + 1) / tcoProgressStages.length) * 100, 12)} className="h-2 bg-destructive/10" />
                      <p className="text-xs leading-5 text-destructive/80">
                        Revisa los archivos cargados o intenta nuevamente. Si el problema continúa, valida que los documentos sean legibles.
                      </p>
                    </div>
                  ) : null}

                  {isCurrentRunForSelectedAgent && runExecution ? (
                    <div className="rounded-[24px] border border-success/15 bg-success/15 p-4">
                      {renderDeliverableQualityReview('generic-run', runQualityReport)}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-medium text-success-foreground">Resultado mas reciente</p>
                        {renderExportControls(handleDownloadRunPdf, undefined, { id: 'generic-run', report: runQualityReport })}
                      </div>
                      <p className="mt-2 text-sm text-success-foreground">
                        {String(runExecution.outputData.summary ?? 'Ejecucion completada')}
                      </p>
                      <p className="mt-2 text-xs text-success-foreground">
                        Ejecutado el {formatDateTime(runExecution.executedAt)}
                      </p>
                    </div>
                  ) : null}

                  {isCurrentRunForSelectedAgent ? renderAgentFeedbackPanel() : null}

                  {isTermsReference && termsResult ? (
                    <div id="terms-of-reference-export-view" className="space-y-5 rounded-[8px] border border-primary/15 bg-white p-4 shadow-sm">
                      {renderDeliverableQualityReview('terms', termsQualityReport)}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen ejecutivo</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {termsResult.executive_summary}
                          </p>
                        </div>
                        <div data-export-hidden="true">{renderExportControls(handleDownloadTermsResult, termsExportContextLabel, { id: 'terms', report: termsQualityReport })}</div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-4">
                        {[
                          ['Nombre', termsResult.title],
                          ['Documentos generados', termsGeneratedDocuments.join(', ')],
                          ['Código de proceso', termsResult.process_code ?? '[COMPLETAR: código del proceso]'],
                          ['Tipo', termsResult.requirement_type],
                          ['Tipo de TDR identificado', termsResult.generated_document.tdr_type ?? termsResult.requirement_type],
                          ['Categoria', termsResult.category],
                          ['Completitud', `${termsResult.completion_level ?? 'Media'}${termsResult.completion_score ? ` (${termsResult.completion_score}%)` : ''}`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-primary/15 bg-white p-4">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">{label}</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-3 lg:grid-cols-3">
                        {(termsResult.dashboard_metrics?.length ? termsResult.dashboard_metrics : [
                          { label: 'Riesgo informacion faltante', value: termsResult.risk_level ?? 'Medio', status: 'warning' },
                          { label: 'Documentos cargados', value: String(termsResult.supporting_documents_summary.length), status: 'neutral' },
                          { label: 'Entregables definidos', value: String(termsResult.generated_document.final_deliverables.length), status: 'complete' },
                        ]).map((metric) => (
                          <div key={metric.label} className="rounded-2xl border border-primary/15 bg-white p-4">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">{metric.label}</p>
                            <p className="mt-2 text-xl font-semibold text-foreground">{metric.value}</p>
                            {metric.detail ? <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p> : null}
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-sm font-medium text-foreground">Flujo del requerimiento</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {(termsResult.flow_steps?.length ? termsResult.flow_steps : ['Necesidad', 'Alcance', 'Actividades', 'Entregables', 'Requisitos', 'Proveedor']).map((step, index, steps) => (
                            <div key={`${step}-${index}`} className="flex items-center gap-2">
                              <span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground">{step}</span>
                              {index < steps.length - 1 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-sm font-medium text-foreground">Entregables para enviar a proveedores</p>
                        <div className="mt-3 grid gap-3 lg:grid-cols-3">
                          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                            <p className="text-sm font-medium text-foreground">Bases sugeridas para licitación</p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {termsResult.tender_bases?.object ?? 'Objeto, alcance, requisitos, criterios y condiciones para solicitar propuestas.'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                            <p className="text-sm font-medium text-foreground">Correo a proveedores</p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {termsResult.supplier_invitation_email?.subject ?? 'Correo listo para copiar, ajustar y enviar.'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                            <p className="text-sm font-medium text-foreground">Siguientes pasos de licitación</p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {(termsResult.tender_process?.length ?? 0) > 0
                                ? `${termsResult.tender_process?.length} pasos sugeridos desde validar el TdR hasta emitir OC o contrato.`
                                : 'Flujo sugerido para invitar, resolver consultas, comparar propuestas y adjudicar.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Tabs value={termsActiveTab} onValueChange={setTermsActiveTab} className="rounded-2xl border border-primary/15 bg-white p-4">
                        <TabsList className="flex h-auto flex-wrap justify-start rounded-xl bg-primary/5 p-1">
                          {showTermsTdr ? <TabsTrigger value="documento">TDR</TabsTrigger> : null}
                          <TabsTrigger value="matriz">Matriz y riesgos</TabsTrigger>
                          <TabsTrigger value="calidad">Calidad</TabsTrigger>
                          {showTermsBases ? <TabsTrigger value="licitacion">Bases</TabsTrigger> : null}
                          {showTermsInvitation ? <TabsTrigger value="correo">Invitación</TabsTrigger> : null}
                          {showTermsSchedule ? <TabsTrigger value="cronograma">Cronograma</TabsTrigger> : null}
                          <TabsTrigger value="proceso">Siguientes pasos</TabsTrigger>
                        </TabsList>

                        {showTermsTdr ? <TabsContent value="documento" className="mt-4">
                          <Accordion type="multiple" defaultValue={['datos', 'objetivo']} className="space-y-2">
                            {[
                              ['datos', 'Datos generales', [
                                `Nombre: ${termsResult.generated_document.general_data.requirement_name}`,
                                `Tipo: ${termsResult.generated_document.general_data.requirement_type}`,
                                `Categoria: ${termsResult.generated_document.general_data.category}`,
                                `Ubicacion: ${termsResult.generated_document.general_data.location ?? 'No especificado'}`,
                                `Fecha requerida: ${termsResult.generated_document.general_data.required_date ?? 'No especificado'}`,
                              ]],
                              ['antecedentes', 'Antecedentes', [termsResult.generated_document.background ?? 'Dato no especificado']],
                              ['objetivo', 'Objetivo', [termsResult.generated_document.objective]],
                              ['alcance', 'Alcance', [termsResult.generated_document.scope]],
                              ['tecnicas', 'Caracteristicas tecnicas', termsResult.generated_document.technical_characteristics],
                              ['actividades', 'Actividades requeridas', termsResult.generated_document.required_activities],
                              ['entregables', 'Entregables', termsResult.generated_document.final_deliverables],
                              ['documentos', 'Documentación requerida al proveedor', termsResult.generated_document.required_documents ?? termsResult.tender_bases?.requested_documentation ?? []],
                              ['normas', 'Normas técnicas, estándares o marco aplicable', termsResult.generated_document.applicable_standards ?? []],
                              ['cronograma', 'Plazo y cronograma sugerido', termsResult.generated_document.suggested_schedule ?? []],
                              ['ejecucion', 'Condiciones de ejecución o metodología', termsResult.generated_document.execution_conditions ?? []],
                              ['justificacion', 'Justificacion', [termsResult.generated_document.justification]],
                              ['seguridad', 'Requisitos de seguridad', termsResult.generated_document.safety_requirements],
                              ['proveedores', 'Condiciones para proveedores', termsResult.generated_document.supplier_conditions],
                              ['comerciales', 'Condiciones comerciales sugeridas', termsResult.generated_document.commercial_conditions ?? []],
                              ['criterios', 'Criterios de evaluación', termsResult.generated_document.evaluation_criteria ?? termsResult.tender_bases?.evaluation_criteria ?? []],
                              ['garantias', 'Garantías, penalidades y condiciones comerciales', (termsResult.generated_document.guarantees_penalties ?? []).map((item) => `${item.type ?? 'Condición'}: ${item.condition ?? item.item ?? 'Dato no especificado'} ${item.status ?? ''}`)],
                              ['informe', 'Estructura de informe final', termsResult.generated_document.final_report_structure],
                              ['anexos', 'Anexos sugeridos', termsResult.generated_document.suggested_annexes],
                            ].map(([value, title, items]) => (
                              <AccordionItem key={String(value)} value={String(value)} className="rounded-xl border border-primary/15 px-3">
                                <AccordionTrigger className="text-sm font-medium text-foreground">{String(title)}</AccordionTrigger>
                                <AccordionContent>{renderTermsList(items as string[])}</AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </TabsContent> : null}

                        <TabsContent value="matriz" className="mt-4 space-y-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Criterios de evaluación ponderados</p>
                            <div className="mt-3 overflow-x-auto rounded-xl border border-primary/15">
                              <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">Criterio</th>
                                    <th className="px-4 py-3 font-medium">Subcriterio</th>
                                    <th className="px-4 py-3 font-medium">Puntaje</th>
                                    <th className="px-4 py-3 font-medium">Evidencia requerida</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(termsResult.generated_document.evaluation_matrix?.length ? termsResult.generated_document.evaluation_matrix : []).map((item, index) => (
                                    <tr key={`${item.criterion ?? 'criterion'}-${index}`} className="border-t border-primary/10">
                                      <td className="px-4 py-3 font-medium text-foreground">{item.criterion ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.subcriterion ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.score ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.required_evidence ?? 'Dato no especificado'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Matriz de cumplimiento</p>
                            <div className="mt-3 overflow-x-auto rounded-xl border border-primary/15">
                              <table className="w-full min-w-[720px] text-left text-sm">
                                <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">Requisito</th>
                                    <th className="px-4 py-3 font-medium">Tipo</th>
                                    <th className="px-4 py-3 font-medium">Evidencia esperada</th>
                                    <th className="px-4 py-3 font-medium">Obligatorio</th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(termsResult.generated_document.compliance_matrix?.length ? termsResult.generated_document.compliance_matrix : [
                                    { requirement: 'Objetivo y alcance comprendidos', expected_evidence: 'Propuesta técnica y declaración de cumplimiento.', mandatory: 'Si', status: 'Recomendación sugerida' },
                                  ]).map((item, index) => (
                                    <tr key={`${item.requirement ?? 'req'}-${index}`} className="border-t border-primary/10">
                                      <td className="px-4 py-3 font-medium text-foreground">{item.requirement ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.type ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.expected_evidence ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.mandatory ?? 'Dato no especificado'}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{item.status ?? 'Dato no especificado'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Riesgos identificados</p>
                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              {(termsResult.generated_document.identified_risks?.length ? termsResult.generated_document.identified_risks : [
                                { risk: 'Datos técnicos pendientes de validación.', impact: 'Medio', mitigation: 'Recomendación sugerida: validar con el área usuaria antes de enviar.' },
                              ]).map((item, index) => (
                                <div key={`${item.risk ?? 'risk'}-${index}`} className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                                  <p className="text-sm font-medium text-foreground">{item.risk ?? 'Dato no especificado'}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">Impacto: {item.impact ?? 'Dato no especificado'}</p>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.mitigation ?? 'Dato no especificado'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="calidad" className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-primary/15 p-4">
                            <p className="text-sm font-medium text-foreground">Checklist de calidad</p>
                            <div className="mt-3 space-y-2">
                              {(termsResult.checklist?.length ? termsResult.checklist : []).map((item) => (
                                <div key={item.label} className="flex items-start gap-2 rounded-lg bg-primary/5 p-2 text-sm">
                                  <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.status === 'complete' ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <div>
                                    <p className="font-medium text-foreground">{item.label}</p>
                                    {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="rounded-xl border border-primary/15 p-4">
                              <p className="text-sm font-medium text-foreground">Información que conviene completar antes de enviar</p>
                              {renderTermsList(termsResult.missing_information)}
                            </div>
                            <div className="rounded-xl border border-primary/15 p-4">
                              <p className="text-sm font-medium text-foreground">Recomendaciones accionables</p>
                              {renderTermsList(termsResult.buyer_recommendations)}
                            </div>
                            <div className="rounded-xl border border-primary/15 p-4">
                              <p className="text-sm font-medium text-foreground">Preguntas recomendadas para completar el TDR</p>
                              {renderTermsList(termsResult.recommended_questions)}
                            </div>
                            <div className="rounded-xl border border-primary/15 p-4">
                              <p className="text-sm font-medium text-foreground">Validación de consistencia</p>
                              {renderTermsList(termsResult.consistency_validation)}
                            </div>
                          </div>
                        </TabsContent>

                        {showTermsBases ? <TabsContent value="licitacion" className="mt-4 space-y-3">
                          <div className="rounded-xl border border-primary/15 p-4">
                            <p className="text-sm font-medium text-foreground">Bases sugeridas para la licitación</p>
                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Objeto:</span> {termsResult.tender_bases?.object ?? 'No especificado'}</p>
                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Alcance:</span> {termsResult.tender_bases?.scope ?? 'No especificado'}</p>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            {[
                              ['Requisitos mínimos del proveedor', termsResult.tender_bases?.minimum_supplier_requirements],
                              ['Documentación solicitada', termsResult.tender_bases?.requested_documentation],
                              ['Criterios de evaluación', termsResult.tender_bases?.evaluation_criteria],
                              ['Condiciones de presentación', termsResult.tender_bases?.proposal_submission_conditions],
                              ['Criterios de adjudicación', termsResult.tender_bases?.award_criteria],
                              ['Condiciones de descalificación', termsResult.tender_bases?.disqualification_conditions],
                              ['Observaciones para compradores', termsResult.tender_bases?.buyer_observations],
                            ].map(([title, items]) => (
                              <div key={String(title)} className="rounded-xl border border-primary/15 p-4">
                                <p className="text-sm font-medium text-foreground">{String(title)}</p>
                                {renderTermsList(items as string[] | undefined)}
                              </div>
                            ))}
                          </div>
                          <p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                            {termsResult.tender_bases?.disclaimer ?? 'Estas bases son una guía inicial y deben ser revisadas por el área de compras, legal o responsable interno antes de enviarse.'}
                          </p>
                        </TabsContent> : null}

                        {showTermsInvitation ? <TabsContent value="correo" className="mt-4">
                          <div className="rounded-xl border border-primary/15 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">Correo sugerido para invitar proveedores</p>
                              <Button type="button" variant="outline" className="rounded-full" onClick={() => void copySupplierEmail()}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar correo
                              </Button>
                            </div>
                            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                              <p><span className="font-medium text-foreground">Asunto:</span> {termsResult.supplier_invitation_email?.subject ?? 'Invitación a presentar propuesta'}</p>
                              <p>{termsResult.supplier_invitation_email?.greeting}</p>
                              <Textarea
                                value={termsResult.supplier_invitation_email?.body ?? ''}
                                readOnly
                                className="min-h-[120px] rounded-2xl border-primary/15 bg-primary/5"
                              />
                              <p><span className="font-medium text-foreground">Adjuntos:</span> {(termsResult.supplier_invitation_email?.attached_documents ?? ['Termino de referencia']).join(', ')}</p>
                              <p><span className="font-medium text-foreground">Plazo:</span> {termsResult.supplier_invitation_email?.response_deadline ?? 'No especificado'}</p>
                              <p><span className="font-medium text-foreground">Contacto:</span> {termsResult.supplier_invitation_email?.contact_details ?? 'No especificado'}</p>
                              <p>{termsResult.supplier_invitation_email?.closing}</p>
                            </div>
                            <div className="mt-4 overflow-x-auto rounded-xl border border-primary/15">
                              <table className="w-full min-w-[640px] text-left text-sm">
                                <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">Contacto</th>
                                    <th className="px-4 py-3 font-medium">Empresa</th>
                                    <th className="px-4 py-3 font-medium">Cargo</th>
                                    <th className="px-4 py-3 font-medium">Correo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(termsResult.invited_bidders?.length ? termsResult.invited_bidders : [{ contact_name: '[COMPLETAR: ingresar empresas invitadas]' }]).map((item, index) => (
                                    <tr key={`bidder-${index}`} className="border-t border-primary/10">
                                      <td className="px-4 py-3 text-muted-foreground">{String(item.contact_name ?? '{nombre_contacto}')}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{String(item.business_name ?? '{razon_social}')}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{String(item.role ?? '{cargo}')}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{String(item.email ?? '{correo}')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TabsContent> : null}

                        {showTermsSchedule ? <TabsContent value="cronograma" className="mt-4">
                          <div className="overflow-x-auto rounded-xl border border-primary/15">
                            <table className="w-full min-w-[960px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">N°</th>
                                  <th className="px-4 py-3 font-medium">Fase</th>
                                  <th className="px-4 py-3 font-medium">Actividad/Hito</th>
                                  <th className="px-4 py-3 font-medium">Responsable</th>
                                  <th className="px-4 py-3 font-medium">Inicio</th>
                                  <th className="px-4 py-3 font-medium">Fin</th>
                                  <th className="px-4 py-3 font-medium">Duración</th>
                                  <th className="px-4 py-3 font-medium">Entregable</th>
                                  <th className="px-4 py-3 font-medium">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(termsResult.process_schedule?.length ? termsResult.process_schedule : []).map((item, index) => (
                                  <tr key={`${item.number ?? index}-${item.activity ?? 'actividad'}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 text-muted-foreground">{item.number ?? index + 1}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.phase ?? 'No especificado'}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{item.activity ?? 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.responsible ?? '[COMPLETAR]'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.start ?? '[SUGERIDO]'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.end ?? '[SUGERIDO]'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.duration ?? '[SUGERIDO]'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.deliverable ?? 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.observations ?? ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TabsContent> : null}

                        <TabsContent value="proceso" className="mt-4">
                          <div className="grid gap-2 lg:grid-cols-2">
                            {(termsResult.tender_process?.length ? termsResult.tender_process : [
                              'Validar término de referencia',
                              'Seleccionar proveedores invitados',
                              'Enviar correo de invitación',
                              'Recibir consultas',
                              'Responder consultas',
                              'Recibir propuestas',
                              'Comparar propuestas',
                              'Negociar si aplica',
                              'Seleccionar proveedor',
                              'Emitir orden de compra o contrato',
                            ]).map((step, index) => (
                              <div key={`${step}-${index}`} className="flex items-start gap-3 rounded-xl border border-primary/15 p-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                                <p className="text-sm text-foreground/80">{step}</p>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>

                      <Dialog open={Boolean(termsPendingReview)} onOpenChange={(open) => { if (!open) setTermsPendingReview(null); }}>
                        <DialogContent data-export-hidden="true" className="max-h-[88vh] overflow-y-auto border-primary/15 bg-white sm:max-w-5xl">
                          <DialogHeader>
                            <DialogTitle>Completa la información antes de descargar</DialogTitle>
                            <DialogDescription>
                              Detectamos datos pendientes en este documento. Puedes completarlos ahora para generar un archivo más profesional.
                            </DialogDescription>
                          </DialogHeader>

                          {termsPendingReview ? (
                            <div className="space-y-5">
                              <div className="grid gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:grid-cols-3">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Documento</p>
                                  <p className="mt-1 text-sm font-semibold text-foreground">{termsPendingReview.scope.documentCode}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Pendientes</p>
                                  <p className="mt-1 text-sm font-semibold text-foreground">
                                    {termsPendingReview.items.filter((item) => item.type === 'COMPLETAR').length}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">Sugeridos</p>
                                  <p className="mt-1 text-sm font-semibold text-foreground">
                                    {termsPendingReview.items.filter((item) => item.type === 'SUGERIDO').length}
                                  </p>
                                </div>
                              </div>

                              {['Datos generales', 'Fechas y cronograma', 'Condiciones comerciales', 'Contactos e invitación', 'Requisitos técnicos / legales', 'Otros pendientes'].map((group) => {
                                const items = termsPendingReview.items.filter((item) => item.type === 'COMPLETAR' && item.group === group);
                                if (!items.length) return null;
                                return (
                                  <div key={group} className="space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">{group}</p>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                      {items.map((item) => (
                                        <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/55 p-4">
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                              <label className="text-sm font-semibold text-foreground">{item.label}</label>
                                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.help}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              <Badge variant="outline" className="bg-white">{item.documentCode}</Badge>
                                              <Badge variant="outline" className="bg-white">{item.priority}</Badge>
                                            </div>
                                          </div>
                                          {renderTermsPendingInput(item)}
                                          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                                            Sección: {item.documentSection}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}

                              {termsPendingReview.items.some((item) => item.type === 'SUGERIDO') ? (
                                <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">Datos sugeridos por confirmar</p>
                                  <div className="grid gap-3 lg:grid-cols-2">
                                    {termsPendingReview.items.filter((item) => item.type === 'SUGERIDO').map((item) => (
                                      <div key={item.id} className="rounded-2xl border border-primary/15 bg-white p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div>
                                            <label className="text-sm font-semibold text-foreground">{item.label}</label>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                              Puedes aceptar, editar o mantener la sugerencia visible en el archivo.
                                            </p>
                                          </div>
                                          <Badge variant="outline">{item.documentCode}</Badge>
                                        </div>
                                        {renderTermsPendingInput(item)}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-full px-3 text-xs text-primary hover:bg-primary/10"
                                            onClick={() => updateTermsPendingReplacement(item.id, cleanSuggestedTermsValue(item.originalToken))}
                                          >
                                            Aceptar sugerencia
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:bg-primary/10"
                                            onClick={() => updateTermsPendingReplacement(item.id, '')}
                                          >
                                            Mantener como sugerido
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <DialogFooter className="gap-2 sm:justify-between">
                            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setTermsPendingReview(null)}>
                              Cancelar
                            </Button>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full bg-white"
                                disabled={Boolean(termsPendingReview?.items.some(isCriticalTermsPendingField))}
                                onClick={() => termsPendingReview ? void exportTermsWithScope(termsPendingReview.scope, true) : undefined}
                              >
                                Descargar con advertencias
                              </Button>
                              <Button type="button" className="rounded-full" onClick={() => void applyTermsPendingAndDownload()}>
                                Guardar y descargar
                              </Button>
                            </div>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {termsResult.supporting_documents_summary.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Documentos de apoyo leídos</p>
                          <div className="mt-3 space-y-2">
                            {termsResult.supporting_documents_summary.map((doc) => (
                              <div key={doc.file_name} className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">{doc.file_name}</p>
                                <p>Tipo detectado: {doc.detected_type}</p>
                                {doc.limitations.length ? <p>Advertencias: {doc.limitations.join('; ')}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <p className="text-xs leading-5 text-muted-foreground/70">{termsResult.disclaimer}</p>
                    </div>
                  ) : null}

                  {isTermsReference && termsResult ? renderAgentFeedbackPanel() : null}

                  {isDashboardCreator && dashboardResult ? (
                    <div className="space-y-4">
                      {renderDeliverableQualityReview('dashboard', dashboardQualityReport)}
                      <DashboardReportView result={dashboardResult} actions={renderExportControls(handleDownloadDashboardPdf, undefined, { id: 'dashboard', report: dashboardQualityReport })} />
                    </div>
                  ) : null}

                  {isDashboardCreator && dashboardResult ? renderAgentFeedbackPanel() : null}

                  {isTcoAnalysis && tcoResult ? (
                    <div id="tco-analysis-export-view" className="space-y-5 rounded-[24px] border border-[#0D1B2A]/10 bg-[#ECEFF1]/40 p-4">
                      {renderDeliverableQualityReview('tco', tcoQualityReport)}
                      <div className="rounded-2xl bg-[#0D1B2A] p-5 text-white shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="max-w-4xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00ACC1]">Dashboard financiero TCO</p>
                            <h3 className="mt-2 text-xl font-semibold">{tcoPresentation?.header.title || tcoResult.analysis_title}</h3>
                            <div className="mt-3 grid gap-2 text-xs text-white/75 sm:grid-cols-2 lg:grid-cols-5">
                              <span>Tipo: {tcoPresentation?.header.analysisType}</span>
                              <span>Producto: {tcoPresentation?.header.itemName}</span>
                              <span>Horizonte: {tcoPresentation?.header.horizon}</span>
                              <span>Moneda: {tcoPresentation?.header.currency}</span>
                              <span>Confianza: {tcoConfidence}</span>
                            </div>
                          </div>
                          <div data-export-hidden="true">{renderExportControls(handleDownloadTcoPdf, undefined, { id: 'tco', report: tcoQualityReport })}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">A. Resumen ejecutivo</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                            Unidad de comparación: {tcoPresentation?.header.unitOfComparison}. Recomendación: {tcoPresentation?.recommendation.finalRecommendedOption}.
                          </p>
                          <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">
                            {textValue(tcoPresentation?.recommendation.rationale || tcoResult.executive_summary.final_recommendation)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          { label: 'Alternativa recomendada', value: tcoPresentation?.recommendation.finalRecommendedOption || tcoResult.executive_summary.best_alternative, note: tcoPresentation?.recommendation.recommendedAction },
                          { label: 'TCO neto ganador', value: tcoWinningFinancial?.net_tco || tcoExecutiveCards.find((card) => /tco/i.test(card.label))?.value, note: 'Desde financial_model / matriz TCO' },
                          { label: 'Score ganador', value: tcoScoreWinner ? `${textValue(tcoScoreWinner.total_score)} / 100` : `${tcoResult.executive_summary.best_alternative_score ?? 'No especificado'} / 100`, note: textValue(tcoScoreWinner?.level ?? tcoResult.executive_summary.best_alternative_score_label, '') },
                          { label: 'Riesgo principal', value: tcoResult.executive_summary.main_risk, note: `Confianza: ${tcoConfidence}` },
                          { label: 'Datos faltantes críticos', value: tcoPresentation?.missingData.length ?? 0, note: tcoPresentation?.missingData.slice(0, 2).join(' | ') },
                          ...tcoExecutiveCards.slice(0, 3),
                        ].map((card, index) => (
                            <div key={`${card.label}-${index}`} className="rounded-2xl border border-[#CFD8DC] bg-white p-4 shadow-sm">
                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">{card.label}</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {textValue(card.value)}
                              </p>
                              {card.note ? (
                                <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground/80">{card.note}</p>
                              ) : null}
                            </div>
                          ))}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Mejor alternativa</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{tcoResult.executive_summary.best_alternative}</p>
                          <p className="mt-1 text-sm font-medium text-primary">
                            Calificación: {tcoResult.executive_summary.best_alternative_score ?? 'No especificado'} / 100
                            {tcoResult.executive_summary.best_alternative_score_label ? ` - ${tcoResult.executive_summary.best_alternative_score_label}` : ''}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{tcoResult.executive_summary.why_it_wins}</p>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Ahorro / sobrecosto estimado</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{tcoResult.executive_summary.estimated_saving_or_overcost}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">Riesgo principal: {tcoResult.executive_summary.main_risk}</p>
                        </div>
                      </div>

                      {tcoResult.detected_alternatives?.length ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">Alternativas detectadas</p>
                          {tcoResult.extracted_data_quality ? (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                              Documentos procesados: {tcoResult.extracted_data_quality.documents_processed}. Confianza: {tcoResult.extracted_data_quality.confidence_level}.
                            </p>
                          ) : null}
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                            <table className="w-full min-w-[1120px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Proveedor</th>
                                  <th className="px-4 py-3 font-medium">Archivo fuente</th>
                                  <th className="px-4 py-3 font-medium">Precio detectado</th>
                                  <th className="px-4 py-3 font-medium">Garantía</th>
                                  <th className="px-4 py-3 font-medium">Plazo</th>
                                  <th className="px-4 py-3 font-medium">Costos detectados</th>
                                  <th className="px-4 py-3 font-medium">Datos detectados</th>
                                  <th className="px-4 py-3 font-medium">Datos faltantes</th>
                                  <th className="px-4 py-3 font-medium">Evidencia</th>
                                  <th className="px-4 py-3 font-medium">Confianza</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tcoResult.detected_alternatives.map((item, index) => (
                                  <tr key={`${item.supplier_name}-${index}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-medium text-foreground">{item.supplier_name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.source_file}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.detected_price || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.warranty || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.lead_time || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.detected_costs?.join(', ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.data_detected.join(', ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.data_missing.join(', ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.source_evidence?.join(' | ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.confidence_level ?? 'medium'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {tcoResult.extracted_data_quality?.warnings?.length ? (
                            <div className="mt-3 rounded-2xl border border-primary/15 bg-white p-4">
                              <p className="text-sm font-medium text-foreground">Advertencias de calidad documental</p>
                              <div className="mt-2">{renderValueList(tcoResult.extracted_data_quality.warnings)}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-sm font-medium text-foreground">B. Datos usados</p>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {tcoResult.data_used.map((item, index) => (
                            <div key={index} className="rounded-xl bg-primary/5 p-3">
                              {renderRecordBlock(item)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-foreground">C. Matriz TCO comparativa</p>
                        <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white shadow-sm">
                          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="bg-[#0d1b3e] text-white">
                                <th className="sticky left-0 z-10 min-w-[260px] bg-[#0d1b3e] px-4 py-3 font-semibold">Componente</th>
                                {tcoPresentation?.alternatives.map((alternative) => (
                                  <th key={alternative.id} className="min-w-[170px] px-4 py-3 text-right font-semibold">{alternative.label}</th>
                                ))}
                                <th className="min-w-[220px] px-4 py-3 font-semibold">Nota / fuente</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tcoPresentation?.matrix.map((section) => (
                                <>
                                  <tr key={`${section.title}-header`} className="bg-primary/10">
                                    <td className="sticky left-0 z-10 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                                      {section.title}
                                    </td>
                                    <td colSpan={(tcoPresentation?.alternatives.length ?? 0) + 1} className="px-4 py-2 text-xs text-muted-foreground">
                                      {section.description || 'Componentes del TCO aplicables al caso'}
                                    </td>
                                  </tr>
                                  {[...section.rows, ...(section.totalRow ? [section.totalRow] : [])].map((row) => (
                                    <tr key={`${section.title}-${row.component}`} className={row.isTotal ? 'bg-emerald-50' : 'bg-white'}>
                                      <td className={`sticky left-0 z-10 border-t border-primary/10 px-4 py-3 ${row.isTotal ? 'bg-emerald-50 font-semibold text-emerald-900' : 'bg-white font-medium text-foreground'}`}>
                                        {row.component}
                                      </td>
                                      {tcoPresentation?.alternatives.map((alternative) => {
                                        const cell = row.values[alternative.label] || 'Dato faltante';
                                        const isStatus = ['Dato faltante', 'No aplica', 'No calculable con datos actuales', 'Requiere base de uso', 'Requiere km/año o vida útil', 'Requiere número de usuarios'].includes(cell);
                                        return (
                                          <td key={`${row.component}-${alternative.label}`} className={`border-t border-primary/10 px-4 py-3 text-right ${row.isTotal ? 'font-semibold text-emerald-900' : 'text-muted-foreground'}`}>
                                            {isStatus ? (
                                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{cell}</span>
                                            ) : cell.toLowerCase().includes('supuesto') ? (
                                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{cell}</span>
                                            ) : (
                                              cell
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="border-t border-primary/10 px-4 py-3 text-xs leading-5 text-muted-foreground">
                                        {[row.source, row.unit, row.note].filter(Boolean).join(' · ') || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {tcoPresentation?.financialModel.length ? (
                        <div className="rounded-2xl border border-[#CFD8DC] bg-white p-4 shadow-sm">
                          <p className="text-sm font-medium text-foreground">Modelo financiero TCO</p>
                          <div className="mt-3 overflow-x-auto rounded-xl border border-primary/10">
                            <table className="w-full min-w-[1040px] text-left text-sm">
                              <thead className="bg-[#1565C0] text-xs uppercase tracking-[0.14em] text-white">
                                <tr>
                                  {['Alternativa', 'TCO neto', 'TCO anual', 'TCO unitario', 'Adquisición', 'Operación', 'Mantenimiento', 'Residual', 'Confianza'].map((heading) => (
                                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tcoPresentation.financialModel.map((item, index) => (
                                  <tr key={`${textValue(item.alternative)}-${index}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-semibold text-foreground">{textValue(item.alternative)}</td>
                                    <td className="px-4 py-3 font-semibold text-[#2E7D32]">{textValue(item.net_tco)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.annualized_tco)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.unit_tco)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.acquisition_costs)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.operating_costs)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.maintenance_costs)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.residual_value)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.confidence_level)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {tcoPresentation?.scorecard.criteria.length || tcoPresentation?.scorecard.totals.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Scorecard profesional</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                                {tcoPresentation.scorecard.scoringMethod}. Confianza: {tcoPresentation.scorecard.confidenceLevel}.
                              </p>
                            </div>
                            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              {tcoPresentation.scorecard.totalPossibleScore} pts
                            </div>
                          </div>

                          {tcoPresentation.scorecard.criteria.length ? (
                            <div className="mt-3 overflow-x-auto rounded-xl border border-primary/10">
                              <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="bg-primary/5 text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">Criterio</th>
                                    <th className="px-4 py-3 font-medium">Peso</th>
                                    {tcoPresentation.alternatives.map((alternative) => (
                                      <th key={alternative.id} className="px-4 py-3 text-right font-medium">{alternative.label}</th>
                                    ))}
                                    <th className="px-4 py-3 font-medium">Evidencia</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tcoPresentation.scorecard.criteria.map((criterion, index) => {
                                    const alternatives = Array.isArray(criterion.alternatives) ? criterion.alternatives as Array<Record<string, unknown>> : [];
                                    return (
                                      <tr key={String(criterion.criterion_id ?? index)} className="border-t border-primary/10">
                                        <td className="px-4 py-3 font-medium text-foreground">{textValue(criterion.criterion_name)}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{textValue(criterion.weight)}%</td>
                                        {tcoPresentation.alternatives.map((alternative) => {
                                          const score = alternatives.find((item) => textValue(item.alternative, '') === alternative.label);
                                          return (
                                            <td key={`${String(criterion.criterion_id ?? index)}-${alternative.label}`} className="px-4 py-3 text-right text-muted-foreground">
                                              {score ? (
                                                <div className="ml-auto w-32">
                                                  <div className="flex items-center justify-end gap-2">
                                                    <span className="font-medium text-foreground">{textValue(score.normalized_score)}</span>
                                                    <span className="text-xs text-muted-foreground">/100</span>
                                                  </div>
                                                  <div className="mt-1 h-1.5 rounded-full bg-[#ECEFF1]">
                                                    <div
                                                      className="h-1.5 rounded-full bg-[#00ACC1]"
                                                      style={{ width: `${Math.min(Number(score.normalized_score) || 0, 100)}%` }}
                                                    />
                                                  </div>
                                                  <p className="mt-1 text-[11px] text-muted-foreground">Pond.: {textValue(score.weighted_score)}</p>
                                                </div>
                                              ) : 'Dato faltante'}
                                            </td>
                                          );
                                        })}
                                        <td className="px-4 py-3 text-xs leading-5 text-muted-foreground">
                                          {textValue(alternatives[0]?.evidence ?? criterion.scoring_logic)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}

                          {tcoPresentation.scorecard.totals.length ? (
                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {tcoPresentation.scorecard.totals.map((item) => (
                                <div key={`${textValue(item.rank)}-${textValue(item.alternative)}`} className="rounded-xl bg-primary/5 p-3">
                                  <p className="text-sm font-semibold text-foreground">
                                    {textValue(item.rank)}. {textValue(item.alternative)}
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-primary">
                                    Score: {textValue(item.total_score)} / 100 - {textValue(item.level)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">Fortaleza: {textValue(item.main_strength)}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">Debilidad: {textValue(item.main_weakness)}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">Confianza: {textValue(item.confidence_level)}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">D. Ranking</p>
                          <div className="mt-3 space-y-2">
                            {(tcoPresentation?.ranking ?? []).map((item) => (
                              <div key={`${textValue(item.position)}-${textValue(item.alternative)}`} className="rounded-xl bg-primary/5 p-3">
                                <p className="text-sm font-medium text-foreground">{textValue(item.position)}. {textValue(item.alternative)}</p>
                                <p className="mt-1 text-sm font-semibold text-primary">
                                  Calificación: {textValue(item.score)} / 100{textValue(item.score_label, '') ? ` - ${textValue(item.score_label)}` : ''}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">TCO: {textValue(item.total_tco)}</p>
                                {Array.isArray(item.source_basis) && item.source_basis.length ? (
                                  <p className="mt-1 text-xs text-muted-foreground/80">Base: {item.source_basis.map((value) => textValue(value)).join(' | ')}</p>
                                ) : null}
                                <p className="mt-1 text-sm text-muted-foreground">{textValue(item.reason)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">E. Interpretación</p>
                          {renderRecordBlock(tcoResult.interpretation)}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">F. Análisis de sensibilidad</p>
                          {renderRecordBlock(tcoResult.sensitivity_analysis)}
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">G. Recomendación estratégica</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              ['Mejor opción económica', tcoRecommendation?.economic_option],
                              ['Mejor opción técnica', tcoRecommendation?.technical_option],
                              ['Mejor opción por menor riesgo', tcoRecommendation?.lowest_risk_option],
                              ['Mejor opción balanceada', tcoRecommendation?.balanced_option],
                              ['Opción recomendada final', tcoRecommendation?.final_recommended_option],
                              ['Justificación', tcoRecommendation?.recommendation_rationale],
                            ]
                              .filter(([, value]) => {
                                const normalized = textValue(value, '');
                                return normalized && !['No especificado', 'No determinado', 'null', 'undefined'].includes(normalized);
                              })
                              .map(([label, value]) => (
                                <div key={String(label)} className="rounded-xl bg-primary/5 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">{String(label)}</p>
                                  <p className="mt-1 text-sm leading-6 text-foreground/80">{textValue(value)}</p>
                                </div>
                              ))}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {tcoPresentation?.recommendation.finalRecommendation}
                          </p>
                          {tcoPresentation?.recommendation.nextSteps.length ? (
                            <div className="mt-3">
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Próximos pasos</p>
                              <div className="mt-2">{renderValueList(tcoPresentation.recommendation.nextSteps.slice(0, 5))}</div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {tcoResult.hidden_costs_detected?.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Costos ocultos detectados</p>
                          <div className="mt-2">{renderValueList(tcoResult.hidden_costs_detected)}</div>
                        </div>
                      ) : null}

                      {tcoResult.risk_analysis.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Análisis de riesgos</p>
                          <div className="mt-3 overflow-x-auto rounded-xl border border-primary/10">
                            <table className="w-full min-w-[900px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                                <tr>
                                  {['Riesgo', 'Alternativa', 'Probabilidad', 'Impacto', 'Nivel', 'Mitigación'].map((heading) => (
                                    <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                            {tcoResult.risk_analysis.map((item, index) => (
                                  <tr key={index} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-medium text-foreground">{textValue(item.risk)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.alternative)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.probability)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.economic_impact)}</td>
                                    <td className="px-4 py-3">
                                      <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-[#E65100]">{textValue(item.level)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.mitigation)}</td>
                                  </tr>
                            ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {tcoPresentation?.transparencyTable.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Transparencia de datos</p>
                          <div className="mt-3 overflow-x-auto rounded-xl border border-primary/10">
                            <table className="w-full min-w-[1040px] text-left text-sm">
                              <thead className="bg-[#ECEFF1] text-xs uppercase tracking-[0.14em] text-muted-foreground/80">
                                <tr>
                                  {['Dato', 'Valor', 'Fuente', 'Confianza', 'Observación'].map((heading) => (
                                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tcoPresentation.transparencyTable.slice(0, 30).map((item, index) => (
                                  <tr key={`${textValue(item.alternative)}-${textValue(item.field)}-${index}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.field)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.value)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.source)}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{textValue(item.confidence_level)}</td>
                                    <td className="px-4 py-3 text-xs leading-5 text-muted-foreground">{textValue(item.observation)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">H. Preguntas o datos faltantes</p>
                          {renderValueList([...tcoResult.missing_information, ...tcoResult.questions_for_user_or_suppliers])}
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">I. Supuestos y límites del análisis</p>
                          {renderValueList([...(tcoResult.assumptions_and_limits ?? []), ...(tcoResult.calculation_warnings ?? [])])}
                        </div>
                      </div>

                      {tcoResult.supporting_documents_summary.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Documentos de apoyo leídos</p>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {tcoResult.supporting_documents_summary.map((item, index) => (
                              <div key={index} className="rounded-xl bg-primary/5 p-3">
                                {renderRecordBlock(item)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <p className="text-xs leading-5 text-muted-foreground/70">{tcoResult.disclaimer}</p>
                    </div>
                  ) : null}

                  {isTcoAnalysis && tcoResult ? renderAgentFeedbackPanel() : null}

                  {isQuoteComparator && proposalComparisonResult ? (
                    <div id="proposal-comparison-export-view" className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      {renderDeliverableQualityReview('proposal', proposalQualityReport)}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen ejecutivo</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {proposalComparisonResult.executive_summary}
                          </p>
                        </div>
                        {renderExportControls(handleDownloadProposalPdf, undefined, { id: 'proposal', report: proposalQualityReport })}
                      </div>
                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                          Proveedor recomendado
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {proposalComparisonResult.recommended_supplier}
                        </p>
                      </div>

                      {proposalComparisonResult.executive_comparison_table?.length ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen ejecutivo comparativo</p>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                            <table className="w-full min-w-[680px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Dato clave</th>
                                  {proposalComparisonResult.suppliers.map((supplier) => (
                                    <th key={supplier.supplier_name} className="px-4 py-3 font-medium">
                                      {supplier.supplier_name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {proposalComparisonResult.executive_comparison_table.map((row) => (
                                  <tr key={row.row_label} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-medium text-foreground">{row.row_label}</td>
                                    {proposalComparisonResult.suppliers.map((supplier) => (
                                      <td key={`${row.row_label}-${supplier.supplier_name}`} className="px-4 py-3 text-muted-foreground">
                                        {row.values[supplier.supplier_name] || 'No especificado'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {proposalComparisonResult.evaluation_matrix?.criteria.length ? (
                        <div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Matriz de evaluación comparativa</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                              {proposalComparisonResult.auto_generated_criteria_note}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground/70">
                              Escala de valoración: 1 = Muy deficiente | 2 = Deficiente | 3 = Aceptable | 4 = Bueno | 5 = Excelente. Puntaje ponderado = Valoración × Peso.
                            </p>
                          </div>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                            <table className="w-full min-w-[760px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">N°</th>
                                  <th className="px-4 py-3 font-medium">Criterio</th>
                                  <th className="px-4 py-3 font-medium">Peso %</th>
                                  {proposalComparisonResult.suppliers.map((supplier) => (
                                    <th key={supplier.supplier_name} className="px-4 py-3 font-medium">
                                      {supplier.supplier_name}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 font-medium">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {proposalComparisonResult.evaluation_matrix.criteria.map((criterion) => (
                                  <tr key={`${criterion.number}-${criterion.criterion}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 text-muted-foreground">{criterion.number}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{criterion.criterion}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{criterion.weight_percent}%</td>
                                    {proposalComparisonResult.suppliers.map((supplier) => (
                                      <td key={`${criterion.criterion}-${supplier.supplier_name}`} className="px-4 py-3 text-muted-foreground">
                                        {criterion.ratings[supplier.supplier_name] ?? 'No especificado'}
                                      </td>
                                    ))}
                                    <td className="px-4 py-3 text-muted-foreground">{criterion.observations}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {proposalComparisonResult.evaluation_matrix?.weighted_totals.length ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">Puntaje ponderado total</p>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                            <table className="w-full min-w-[480px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Proveedor</th>
                                  <th className="px-4 py-3 font-medium">Puntaje ponderado</th>
                                  <th className="px-4 py-3 font-medium">Ranking</th>
                                </tr>
                              </thead>
                              <tbody>
                                {proposalComparisonResult.evaluation_matrix.weighted_totals.map((item) => (
                                  <tr key={item.supplier_name} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-medium text-foreground">{item.supplier_name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.weighted_score.toFixed(2)} / 5.00</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.ranking_position}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {proposalComparisonResult.criteria_guide?.length ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">Guía de criterios</p>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                            <table className="w-full min-w-[760px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">N°</th>
                                  <th className="px-4 py-3 font-medium">Criterio</th>
                                  <th className="px-4 py-3 font-medium">Peso %</th>
                                  <th className="px-4 py-3 font-medium">Escala de valoración 1 a 5</th>
                                  <th className="px-4 py-3 font-medium">Fuente de verificación</th>
                                </tr>
                              </thead>
                              <tbody>
                                {proposalComparisonResult.criteria_guide.map((item) => (
                                  <tr key={`${item.number}-${item.criterion}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 text-muted-foreground">{item.number}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{item.criterion}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.weight_percent}%</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.evaluation_scale_description}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.verification_source}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <p className="text-sm font-medium text-foreground">Ranking</p>
                        <div className="mt-3 space-y-2">
                          {proposalComparisonResult.ranking.map((item) => (
                            <div
                              key={`${item.position}-${item.supplier_name}`}
                              className="rounded-2xl border border-primary/15 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {item.position}. {item.supplier_name}
                                </p>
                                <Badge className="bg-primary text-white hover:bg-primary">
                                  {item.weighted_score ? `${item.weighted_score.toFixed(2)}/5` : `${item.score}/100`}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-foreground">Tabla comparativa</p>
                        <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                          <table className="w-full min-w-[680px] text-left text-sm">
                            <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                              <tr>
                                <th className="px-4 py-3 font-medium">Criterio</th>
                                {proposalComparisonResult.suppliers.map((supplier) => (
                                  <th key={supplier.supplier_name} className="px-4 py-3 font-medium">
                                    {supplier.supplier_name}
                                  </th>
                                ))}
                                <th className="px-4 py-3 font-medium">Comentario</th>
                              </tr>
                            </thead>
                            <tbody>
                              {proposalComparisonResult.comparison_table.map((row) => (
                                <tr key={row.criterion} className="border-t border-primary/10">
                                  <td className="px-4 py-3 font-medium text-foreground">{row.criterion}</td>
                                  {proposalComparisonResult.suppliers.map((supplier) => (
                                    <td key={`${row.criterion}-${supplier.supplier_name}`} className="px-4 py-3 text-muted-foreground">
                                      {row.values[supplier.supplier_name] || 'No especificado'}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-muted-foreground">{row.comment}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Riesgos globales</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {proposalComparisonResult.global_risks.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Información faltante</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {proposalComparisonResult.missing_information.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Preguntas sugeridas</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {proposalComparisonResult.questions_for_suppliers.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-sm font-medium text-foreground">Recomendación final</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {proposalComparisonResult.final_recommendation}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground/70">
                          {proposalComparisonResult.disclaimer}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {isQuoteComparator && proposalComparisonResult ? renderAgentFeedbackPanel() : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground/70">
                  Elige un agente del catalogo para ver descripcion completa, beneficios e inputs.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      )}
    </div>
  );
};

export default NexuIA;


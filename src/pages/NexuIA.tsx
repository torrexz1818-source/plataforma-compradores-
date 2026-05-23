import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
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
  consumeAiCredit,
  validateAgentPdfMode,
} from '@/lib/api';
import { nodusIaAgents } from '../../shared/nodusIaAgents';
import { useAuth } from '@/lib/auth';
import type { Agent, AgentPdfMode } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useProposalComparison } from '@/features/proposal-comparison/useProposalComparison';
import {
  useDownloadTermsPdf,
  useGenerateTermsOfReference,
  useTermsFormSchema,
} from '@/features/terms-of-reference/useTermsOfReference';
import {
  validateTermsFiles,
  type TermsFormField,
} from '@/features/terms-of-reference/termsOfReferenceApi';
import { useDashboardCreator, useDownloadDashboardPdf } from '@/features/dashboard-creator/useDashboardCreator';
import type { DashboardChart } from '@/features/dashboard-creator/dashboardCreatorApi';
import { useDownloadTcoPdf, useTcoAnalysis } from '@/features/tco-analysis/useTcoAnalysis';
import { downloadAgentResultPdf } from '@/lib/agentPdf';
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
  'Producto físico / compra local',
  'Importación vs compra local',
  'Maquinaria / vehículo / activo',
  'Software / SaaS',
  'Servicio recurrente',
  'Servicio puntual',
  'Repuestos / insumos',
  'Otro',
];

const tcoEvaluationHorizons = ['Por compra', 'Mensual', 'Anual', '3 años', '5 años', 'Vida útil', 'Personalizado'];
const tcoComparisonUnits = ['Por unidad', 'Por lote', 'Por usuario', 'Por km', 'Por hora', 'Por contrato', 'Por proyecto', 'Por año', 'Por mes'];
const tcoCurrencies = ['PEN', 'USD', 'EUR', 'Otra'];
const dashboardAudiences = ['Gerencia', 'Compras', 'Finanzas', 'Operaciones', 'Proveedores', 'Auditoría', 'Otro'];
const dashboardDataTypes = ['Gastos', 'Proveedores', 'Compras', 'Contratos', 'Inventario', 'Cotizaciones', 'Indicadores KPI', 'Datos mixtos', 'Otro'];
const dashboardFocusOptions = ['Automático', 'Ejecutivo', 'Operativo', 'Financiero', 'Proveedores', 'Gastos', 'Compras', 'Auditoría'];

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
  const [termsInitialDescription, setTermsInitialDescription] = useState('');
  const [termsFields, setTermsFields] = useState<Record<string, string>>({});
  const [termsSafetyRequirements, setTermsSafetyRequirements] = useState<string[]>([]);
  const [termsFiles, setTermsFiles] = useState<File[]>([]);
  const [loggedRunIds, setLoggedRunIds] = useState<Record<string, string>>({});
  const [feedbackStars, setFeedbackStars] = useState(5);
  const [feedbackType, setFeedbackType] = useState('me_sirvio');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCorrection, setFeedbackCorrection] = useState('');
  const [selectedPdfMode, setSelectedPdfMode] = useState<AgentPdfMode>('standard_branded');
  const termsFormSchemaMutation = useTermsFormSchema();
  const termsGenerateMutation = useGenerateTermsOfReference();
  const termsPdfMutation = useDownloadTermsPdf();
  const dashboardCreatorMutation = useDashboardCreator();
  const dashboardPdfMutation = useDownloadDashboardPdf();
  const tcoAnalysisMutation = useTcoAnalysis();
  const tcoPdfMutation = useDownloadTcoPdf();
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
  const [limitNotice, setLimitNotice] = useState('');
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents(),
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
  });

  const executionsQuery = useQuery({
    queryKey: ['agents', 'executions', 'mine'],
    queryFn: getMyAgentExecutions,
  });
  const monetizationQuery = useQuery({
    queryKey: ['monetization', 'mine'],
    queryFn: getMyMonetization,
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
    setTermsInitialDescription('');
    setTermsFields({});
    setTermsSafetyRequirements([]);
    setTermsFiles([]);
    termsFormSchemaMutation.reset();
    termsGenerateMutation.reset();
    termsPdfMutation.reset();
    dashboardCreatorMutation.reset();
    dashboardPdfMutation.reset();
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
    tcoAnalysisMutation.reset();
    tcoPdfMutation.reset();
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
    setFeedbackComment('');
    setFeedbackCorrection('');
    setSelectedPdfMode('standard_branded');
    setFeedbackStars(5);
    setFeedbackType('me_sirvio');
  }, [routeAgentId]);

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
      .filter((agent) => agent.status !== 'hidden')
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
  const isAgentActive = selectedAgent?.status ? selectedAgent.status === 'active' : Boolean(selectedAgent?.isActive);
  const currentFeedbackRunId =
    selectedAgent?.id && runMutation.data?.execution.agentId === selectedAgent.id
      ? runMutation.data.execution.agentRunId
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
    const result = await consumeAiCredit();
    if (!result.allowed) {
      setLimitNotice('Has alcanzado tu límite de créditos IA. Mejora tu plan o compra créditos adicionales para continuar.');
      setShowUpgradePanel(true);
      return false;
    }

    setLimitNotice('');
    setShowUpgradePanel(false);
    await queryClient.invalidateQueries({ queryKey: ['monetization', 'mine'] });
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
            description:
              error instanceof Error
                ? error.message
                : 'No se pudo conectar con el AI Engine o completar el análisis.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const updateTermsField = (name: string, value: string) => {
    setTermsFields((current) => ({ ...current, [name]: value }));
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

  const buildPdfBrandingPayload = () => ({
    company_name: pdfOptionsQuery.data?.branding.companyName,
    logo_url: pdfOptionsQuery.data?.branding.logoUrl,
    primary_color: pdfOptionsQuery.data?.branding.primaryColor,
    footer_text: pdfOptionsQuery.data?.branding.footerText,
    user_name: user?.fullName,
  });

  const ensurePdfModeAllowed = async () => {
    if (!selectedAgentKey) {
      throw new Error('Selecciona un agente antes de descargar el PDF.');
    }

    await validateAgentPdfMode({ agentKey: selectedAgentKey, pdfMode: selectedPdfMode });
  };

  const renderPdfFormatSelector = () => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Formato de descarga</span>
      <select
        value={selectedPdfMode}
        onChange={(event) => setSelectedPdfMode(event.target.value as AgentPdfMode)}
        className="h-9 rounded-full border border-border bg-background px-3 text-xs text-foreground"
      >
        {availablePdfModes.map((mode) => (
          <option key={mode.value} value={mode.value}>{mode.label}</option>
        ))}
      </select>
      {availablePdfModes.length <= 1 ? <span>PDF personalizado disponible en plan premium.</span> : null}
    </div>
  );

  const handleTermsFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    setTermsFiles(files);
  };

  const handleToggleSafetyRequirement = (value: string) => {
    setTermsSafetyRequirements((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const updateDashboardForm = (field: keyof typeof dashboardForm, value: string) => {
    setDashboardForm((current) => ({ ...current, [field]: value }));
  };

  const handleDashboardFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const validationMessage = validateTermsFiles(files);
    if (validationMessage) {
      toast({
        title: validationMessage,
        description: 'Formatos soportados: XLSX, CSV, PDF, DOCX, JPG, JPEG y PNG.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    if (files.length > 8) {
      toast({
        title: 'Puedes subir como máximo 8 archivos.',
        description: 'Reduce la cantidad de archivos de datos para este dashboard.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    setDashboardFiles(files);
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

    dashboardCreatorMutation.mutate(
      {
        title: dashboardForm.title.trim(),
        objective: dashboardForm.objective.trim(),
        audience: dashboardForm.audience,
        period: dashboardForm.period,
        dataType: dashboardForm.dataType,
        visualizationFocus: dashboardForm.visualizationFocus,
        additionalContext: dashboardForm.additionalContext,
        useLlmInsights: true,
        files: dashboardFiles,
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
            description: error instanceof Error ? error.message : 'No se pudo conectar con el motor de IA.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleGenerateTerms = async () => {
    const requiredFields = ['title', 'requirement_type', 'objective', 'scope', 'deliverables', 'justification'];
    const hasMissingRequired = requiredFields.some((field) => !termsFields[field]?.trim());

    if (!termsInitialDescription.trim()) {
      toast({
        title: 'Describe primero qué necesitas realizar.',
        description: 'Ese texto inicial ayuda a la IA a contextualizar el término de referencia.',
        variant: 'destructive',
      });
      return;
    }

    if (hasMissingRequired) {
      toast({
        title: 'Completa los campos obligatorios antes de generar el término de referencia.',
        description: 'Revisa nombre, tipo, objetivo, alcance, entregables y justificación.',
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

    const dynamicFormData = Object.fromEntries(
      Object.entries(termsFields).filter(([key]) => key.startsWith('dynamic_')),
    );

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
            title: 'No se pudo generar el término de referencia. Intenta nuevamente.',
            description: error instanceof Error ? error.message : 'No se pudo conectar con el motor de IA.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDownloadTermsPdf = async () => {
    if (!termsGenerateMutation.data) {
      return;
    }

    try {
      await ensurePdfModeAllowed();
    } catch (error) {
      toast({
        title: 'Formato PDF no disponible',
        description: error instanceof Error ? error.message : 'No tienes permiso para descargar este formato.',
        variant: 'destructive',
      });
      return;
    }

    termsPdfMutation.mutate({ result: termsGenerateMutation.data, pdfMode: selectedPdfMode, branding: buildPdfBrandingPayload() }, {
      onError: (error) => {
        toast({
          title: 'No se pudo descargar el PDF.',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        });
      },
    });
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
      tcoGeneral.comparisonUnit,
      tcoGeneral.currency,
    ];

    if (requiredGeneral.some((value) => !value.trim())) {
      toast({
        title: 'Completa los campos obligatorios antes de analizar.',
        description: 'Revisa datos generales, horizonte, unidad y moneda.',
        variant: 'destructive',
      });
      return;
    }

    if (!tcoFiles.length) {
      toast({
        title: 'Sube al menos una cotización/propuesta.',
        description: 'El agente necesita documentos para detectar proveedores, costos y condiciones.',
        variant: 'destructive',
      });
      return;
    }

    if (!(await ensureNodusIaCredit())) {
      return;
    }

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
    if (!tcoAnalysisMutation.data) {
      return;
    }

    try {
      await ensurePdfModeAllowed();
    } catch (error) {
      toast({
        title: 'Formato PDF no disponible',
        description: error instanceof Error ? error.message : 'No tienes permiso para descargar este formato.',
        variant: 'destructive',
      });
      return;
    }

    tcoPdfMutation.mutate({ result: tcoAnalysisMutation.data, pdfMode: selectedPdfMode, branding: buildPdfBrandingPayload() }, {
      onSuccess: () => {
        if (selectedAgent) {
          logAgentUsage(
            selectedAgent.id,
            'Descarga PDF Análisis de Costo Total / TCO',
            tcoAnalysisMutation.data as unknown as Record<string, unknown>,
            true,
          );
        }
      },
      onError: (error) => {
        toast({
          title: 'No se pudo descargar el PDF.',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        });
      },
    });
  };

  const handleDownloadDashboardPdf = async () => {
    if (!dashboardCreatorMutation.data) return;

    try {
      await ensurePdfModeAllowed();
    } catch (error) {
      toast({
        title: 'Formato PDF no disponible',
        description: error instanceof Error ? error.message : 'No tienes permiso para descargar este formato.',
        variant: 'destructive',
      });
      return;
    }

    dashboardPdfMutation.mutate(
      { result: dashboardCreatorMutation.data, pdfMode: selectedPdfMode, branding: buildPdfBrandingPayload() },
      {
        onSuccess: () => {
          if (selectedAgent) {
            logAgentUsage(selectedAgent.id, 'Descarga PDF Creador de Dashboard', dashboardCreatorMutation.data as unknown as Record<string, unknown>, true);
          }
        },
        onError: (error) => {
          toast({
            title: 'No se pudo descargar el PDF.',
            description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDownloadProposalPdf = async () => {
    if (!proposalComparisonResult) {
      return;
    }

    try {
      await ensurePdfModeAllowed();
    } catch (error) {
      toast({
        title: 'Formato PDF no disponible',
        description: error instanceof Error ? error.message : 'No tienes permiso para descargar este formato.',
        variant: 'destructive',
      });
      return;
    }

    downloadAgentResultPdf({
      title: 'Comparativos de propuestas de proveedores',
      agentName: selectedAgent?.name,
      userName: user?.fullName,
      result: proposalComparisonResult,
      fileName: 'comparativo-propuestas-nodus-ia.pdf',
      pdfMode: selectedPdfMode,
      pdfOptions: pdfOptionsQuery.data,
    });
  };

  const handleDownloadRunPdf = async () => {
    if (!runMutation.data) {
      return;
    }

    try {
      await ensurePdfModeAllowed();
    } catch (error) {
      toast({
        title: 'Formato PDF no disponible',
        description: error instanceof Error ? error.message : 'No tienes permiso para descargar este formato.',
        variant: 'destructive',
      });
      return;
    }

    downloadAgentResultPdf({
      title: selectedAgent?.name ?? 'Resultado Nodus IA',
      agentName: selectedAgent?.name,
      userName: user?.fullName,
      result: runMutation.data.execution.outputData,
      fileName: 'resultado-nodus-ia.pdf',
      pdfMode: selectedPdfMode,
      pdfOptions: pdfOptionsQuery.data,
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
  const termsFormSchema = termsFormSchemaMutation.data;
  const termsResult = termsGenerateMutation.data;
  const tcoResult = tcoAnalysisMutation.data;
  const dashboardResult = dashboardCreatorMutation.data;

  const renderTermsField = (field: TermsFormField) => {
    if (field.type === 'file') {
      return (
        <div key={field.name} className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{field.label}</label>
          <p className="text-xs leading-5 text-muted-foreground/70">
            Puedes subir planos con medidas, fichas técnicas, fotos, croquis, documentos previos,
            Excel con cantidades, manuales técnicos o imágenes del estado actual.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Subir documentos de apoyo</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                PDF, DOCX, XLSX, CSV, JPG, JPEG o PNG. Máximo 8 archivos.
              </p>
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
          <div className="grid gap-2 sm:grid-cols-2">
            {field.options.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={termsSafetyRequirements.includes(option)}
                  onChange={() => handleToggleSafetyRequirement(option)}
                  className="h-4 w-4 rounded border-primary/25"
                />
                {option}
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
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">{field.label}</label>
          <select
            value={termsFields[field.name] ?? ''}
            onChange={(event) => updateTermsField(field.name, event.target.value)}
            className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground"
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
    return (
      <div key={field.name} className="space-y-1.5">
        <label className="text-sm font-medium text-foreground/80">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </label>
        <Control
          value={termsFields[field.name] ?? ''}
          onChange={(event) => updateTermsField(field.name, event.target.value)}
          placeholder={field.placeholder}
          className={field.type === 'textarea' ? 'min-h-[96px] rounded-2xl border-primary/15' : 'rounded-xl border-primary/15'}
          required={field.required}
        />
      </div>
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

  const renderSimpleChart = (chart: DashboardChart) => {
    const maxValue = Math.max(...chart.data.map((item) => Number(item.value) || 0), 1);

    return (
      <div className="rounded-2xl border border-primary/15 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{chart.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground/70">{chart.description}</p>
          </div>
          <Badge variant="outline" className="border-primary/15 text-muted-foreground">{chart.type}</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {chart.data.slice(0, 10).map((item) => {
            const width = `${Math.max(5, (Number(item.value) / maxValue) * 100)}%`;
            return (
              <div key={`${chart.chart_id}-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-foreground/80">{item.label}</span>
                  <span className="shrink-0 text-muted-foreground">{Number(item.value).toLocaleString('es-PE')}</span>
                </div>
                <div className="h-2.5 rounded-full bg-primary/10">
                  <div className="h-2.5 rounded-full bg-primary" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground/70">{chart.insight}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[32px] border border-[#2e24ba]/15 bg-[linear-gradient(135deg,#1f1fae_0%,#3325b8_38%,#4f31cb_70%,#6844dc_100%)] shadow-[0_24px_60px_rgba(54,33,170,0.22)]">
        <div className="grid gap-8 px-8 py-9 lg:grid-cols-[1.35fr_0.95fr] lg:items-center lg:px-8">
          <div>
            <Badge
              variant="outline"
              className="border-white/20 bg-white/10 px-4 py-1 text-[13px] font-medium uppercase tracking-[0.24em] text-white backdrop-blur-sm"
            >
              Nodus IA
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
              Agentes IA y automatizaciones
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/85 md:text-[1.1rem]">
              Explora agentes especializados, activa automatizaciones y ejecuta flujos de compras
              en un entorno simple, visual y escalable para sourcing, riesgo, logistica y
              negociacion.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:items-end lg:justify-center">
            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-[420px] lg:grid-cols-1">
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
        <Card className="border-primary/15 shadow-sm">
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

            <div className="grid gap-4 md:grid-cols-2">
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
                    className={`rounded-[26px] border p-5 text-left transition-all ${
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

                    <h3 className="mt-4 text-lg font-medium text-foreground">{agent.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{agent.description}</p>

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

        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/15 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-[var(--gradient-soft)]">
              <CardDescription>Vista detalle del agente</CardDescription>
              <CardTitle className="text-xl text-foreground">
                {selectedAgent ? selectedAgent.name : 'Selecciona un agente'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
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
                      className={isAgentActive ? 'border-success/25 text-success-foreground' : 'border-destructive/20 text-destructive'}
                    >
                      {isAgentActive
                        ? 'Activo'
                        : selectedAgent.status === 'coming_soon'
                          ? 'Proximamente'
                          : 'No disponible'}
                    </Badge>
                  </div>

                  {!isAgentActive ? (
                    <div className="rounded-2xl border border-primary/15 bg-muted/40 p-4 text-sm text-muted-foreground">
                      Este agente esta marcado como {selectedAgent.status === 'coming_soon' ? 'Proximamente' : 'no disponible'}.
                      La card se mantiene visible y bloqueada hasta que administracion lo active.
                    </div>
                  ) : null}

                  <p className="text-sm leading-6 text-muted-foreground">{selectedAgent.longDescription}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Funcionalidades
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.functionalities.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success-foreground" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Beneficios
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.benefits.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                            <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-primary/15 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Inputs requeridos
                      </p>
                      <div className="mt-3 space-y-3">
                        {isTermsReference ? (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground/80">
                                Describe qué necesitas realizar
                              </label>
                              <Textarea
                                value={termsInitialDescription}
                                onChange={(event) => setTermsInitialDescription(event.target.value)}
                                placeholder="Ejemplo: Necesito mantenimiento de luminarias en planta, reparación de paredes con humedad, implementación de estacionamiento, inspección de equipos de aire acondicionado, compra de laptops..."
                                className="min-h-[112px] rounded-2xl border-primary/15"
                                required
                              />
                            </div>
                            <Button
                              type="button"
                              className="rounded-full bg-primary hover:bg-primary"
                              onClick={handleCreateTermsForm}
                              disabled={termsFormSchemaMutation.isPending}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              {termsFormSchemaMutation.isPending ? 'Creando formulario inteligente...' : 'Crear formulario inteligente'}
                            </Button>

                            {termsFormSchema ? (
                              <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="rounded-xl bg-white p-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                                      Categoría sugerida
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-foreground">{termsFormSchema.detected_category}</p>
                                  </div>
                                  <div className="rounded-xl bg-white p-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                                      Tipo
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-foreground">{termsFormSchema.requirement_type}</p>
                                  </div>
                                  <div className="rounded-xl bg-white p-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                                      Complejidad
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-foreground">{termsFormSchema.complexity}</p>
                                  </div>
                                </div>

                                {termsFormSchema.notes_for_buyer.length ? (
                                  <div className="rounded-xl border border-primary/15 bg-white p-3">
                                    <p className="text-sm font-medium text-foreground">Puntos sugeridos para aclarar</p>
                                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                      {termsFormSchema.notes_for_buyer.map((note) => (
                                        <li key={note}>- {note}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {termsFormSchema.form_sections.map((section) => (
                                  <div key={section.section_title} className="space-y-3 rounded-2xl border border-primary/15 bg-white p-4">
                                    <p className="text-sm font-medium text-foreground">{section.section_title}</p>
                                    <div className="space-y-3">
                                      {section.fields.map((field) => renderTermsField(field))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
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
                                    Subir PDF, DOCX, Excel, CSV o imágenes
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">
                                    Carga 2 a 5 propuestas. Los archivos se procesan temporalmente.
                                  </p>
                                </div>
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.xlsx,.csv,.docx,.png,.jpg,.jpeg"
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
                                        <div className="flex items-center gap-2">
                                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm text-foreground/80">{file.name}</span>
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
                              <div className="grid gap-3 md:grid-cols-2">
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
                                  <label className="text-sm font-medium text-foreground/80">Objetivo del dashboard *</label>
                                  <Textarea value={dashboardForm.objective} onChange={(event) => updateDashboardForm('objective', event.target.value)} placeholder="Ejemplo: visualizar gastos por proveedor, detectar categorías con mayor consumo, identificar oportunidades de ahorro..." className="min-h-[88px] rounded-2xl border-primary/15" />
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
                                Sube Excel, CSV, PDF, imágenes, reportes o documentos con datos. El agente analizará la información y generará un dashboard visual con KPIs, tablas, gráficos e insights.
                              </p>
                              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">Subir archivos para dashboard</p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">XLSX, CSV, PDF, DOCX, JPG, JPEG o PNG. Máximo 8 archivos.</p>
                                </div>
                                <input type="file" multiple accept=".xlsx,.csv,.pdf,.docx,.jpg,.jpeg,.png" onChange={handleDashboardFilesChange} className="hidden" />
                              </label>
                              {dashboardFiles.length ? (
                                <div className="space-y-2 rounded-2xl border border-primary/15 bg-white p-3">
                                  {dashboardFiles.map((file) => {
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

                            <div className="space-y-1.5 rounded-2xl border border-primary/15 bg-white p-4">
                              <label className="text-sm font-medium text-foreground/80">Paso 3 - Contexto adicional</label>
                              <Textarea value={dashboardForm.additionalContext} onChange={(event) => updateDashboardForm('additionalContext', event.target.value)} placeholder="Agrega instrucciones, restricciones, definiciones de columnas, objetivos de negocio, KPIs deseados, filtros, áreas, centros de costo, categorías o cualquier dato que ayude a interpretar el dashboard." className="min-h-[96px] rounded-2xl border-primary/15" />
                            </div>

                            <div className="space-y-1.5 rounded-2xl border border-primary/15 bg-white p-4">
                              <label className="text-sm font-medium text-foreground/80">Paso 4 - Enfoque del dashboard</label>
                              <select value={dashboardForm.visualizationFocus} onChange={(event) => updateDashboardForm('visualizationFocus', event.target.value)} className="h-10 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm text-foreground">
                                {dashboardFocusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </div>
                          </div>
                        ) : isTcoAnalysis ? (
                          <div className="space-y-5">
                            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 1 - Datos generales</p>
                              <div className="grid gap-3 md:grid-cols-2">
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
                                  ['comparisonUnit', 'Unidad de comparación', tcoComparisonUnits],
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
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium text-foreground/80">Volumen de compra</label>
                                  <Input
                                    value={tcoGeneral.purchaseVolume}
                                    onChange={(event) => updateTcoGeneral('purchaseVolume', event.target.value)}
                                    placeholder="Ejemplo: 1 equipo, 200 unidades, 50 usuarios"
                                    className="rounded-xl border-primary/15"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground/80">Objetivo del análisis</label>
                                <Textarea
                                  value={tcoGeneral.objective}
                                  onChange={(event) => updateTcoGeneral('objective', event.target.value)}
                                  placeholder="Ejemplo: Determinar qué alternativa tiene menor costo total considerando mantenimiento, garantía, operación y riesgos."
                                  className="min-h-[88px] rounded-2xl border-primary/15"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                              <p className="text-sm font-medium text-foreground">Paso 2 - Documentos para analizar</p>
                              <p className="text-xs leading-5 text-muted-foreground/70">
                                Sube cotizaciones, propuestas, fichas técnicas, PDFs, imágenes, Excel, CSV, contratos o cualquier documento donde aparezcan proveedores, precios, condiciones, garantías, plazos, costos y datos técnicos.
                              </p>
                              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">Subir documentos para análisis automático</p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">PDF, DOCX, XLSX, CSV, JPG, JPEG o PNG. Máximo 8 archivos.</p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">El agente extraerá automáticamente las alternativas/proveedores desde los documentos cargados.</p>
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

                            <div className="space-y-1.5 rounded-2xl border border-primary/15 bg-white p-4">
                              <label className="text-sm font-medium text-foreground/80">Paso 3 - Información general o contexto adicional</label>
                              <Textarea
                                value={tcoGeneral.generalContext}
                                onChange={(event) => updateTcoGeneral('generalContext', event.target.value)}
                                placeholder="Agrega aquí cualquier dato general que no aparezca en los documentos: tipo de cambio, supuestos, restricciones, costos internos, condiciones comerciales, volumen esperado, horizonte, riesgos conocidos o criterios importantes para tu empresa."
                                className="min-h-[96px] rounded-2xl border-primary/15"
                              />
                            </div>

                            <div className="space-y-1.5 rounded-2xl border border-primary/15 bg-white p-4">
                              <label className="text-sm font-medium text-foreground/80">Paso 4 - Instrucciones adicionales</label>
                              <Textarea
                                value={tcoGeneral.additionalInstructions}
                                onChange={(event) => updateTcoGeneral('additionalInstructions', event.target.value)}
                                placeholder="Indica si quieres que el análisis priorice menor TCO, menor riesgo, garantía, disponibilidad local, lead time, soporte técnico, importación vs compra local, o cualquier condición especial."
                                className="min-h-[100px] rounded-2xl border-primary/15"
                              />
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

                    <div className="rounded-[24px] border border-primary/15 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        Output esperado
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.outputs.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                            <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 rounded-[20px] bg-primary/5 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                          Caso de uso principal
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground/80">{selectedAgent.useCase}</p>
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
                    {!isAgentActive ? (
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
                          ? 'Nodus IA está trabajando en tu solicitud…'
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
                        {dashboardCreatorMutation.isPending ? 'Analizando datos y creando dashboard…' : 'Crear dashboard'}
                      </Button>
                    ) : isTcoAnalysis ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={handleAnalyzeTco}
                        disabled={tcoAnalysisMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {tcoAnalysisMutation.isPending ? 'Analizando documentos y calculando TCO…' : 'Analizar costo total'}
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

                  {(proposalComparisonMutation.isPending || termsGenerateMutation.isPending || dashboardCreatorMutation.isPending || tcoAnalysisMutation.isPending || runMutation.isPending) ? (
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-primary">
                      {dashboardCreatorMutation.isPending
                        ? 'Analizando datos y creando dashboard…'
                        : tcoAnalysisMutation.isPending
                          ? 'Analizando documentos y calculando TCO…'
                          : 'Nodus IA está trabajando en tu solicitud…'}
                    </div>
                  ) : null}

                  {runMutation.data?.execution.agentId === selectedAgent.id ? (
                    <div className="rounded-[24px] border border-success/15 bg-success/15 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-medium text-success-foreground">Resultado mas reciente</p>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {renderPdfFormatSelector()}
                          <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadRunPdf}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar PDF
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-success-foreground">
                        {String(runMutation.data.execution.outputData.summary ?? 'Ejecucion completada')}
                      </p>
                      <p className="mt-2 text-xs text-success-foreground">
                        Ejecutado el {formatDateTime(runMutation.data.execution.executedAt)}
                      </p>
                    </div>
                  ) : null}

                  {runMutation.data?.execution.agentId === selectedAgent.id ? renderAgentFeedbackPanel() : null}

                  {isTermsReference && termsResult ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen del requerimiento</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {termsResult.executive_summary}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {renderPdfFormatSelector()}
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={handleDownloadTermsPdf}
                            disabled={termsPdfMutation.isPending}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {termsPdfMutation.isPending ? 'Preparando PDF...' : 'Descargar PDF'}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                          Documento generado
                        </p>
                        <div className="mt-3 space-y-4 text-sm leading-6 text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Objetivo</p>
                            <p>{termsResult.generated_document.objective}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Alcance</p>
                            <p>{termsResult.generated_document.scope}</p>
                          </div>
                          {[
                            ['Características técnicas', termsResult.generated_document.technical_characteristics],
                            ['Actividades requeridas', termsResult.generated_document.required_activities],
                            ['Producto final / entregables', termsResult.generated_document.final_deliverables],
                            ['Requisitos de seguridad', termsResult.generated_document.safety_requirements],
                            ['Condiciones para proveedores', termsResult.generated_document.supplier_conditions],
                            ['Anexos sugeridos', termsResult.generated_document.suggested_annexes],
                          ].map(([title, items]) => (
                            <div key={String(title)}>
                              <p className="font-medium text-foreground">{String(title)}</p>
                              <ul className="mt-1 space-y-1">
                                {(items as string[]).map((item) => (
                                  <li key={item}>- {item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Información faltante</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {termsResult.missing_information.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Recomendaciones</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {termsResult.buyer_recommendations.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Validación de calidad</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {termsResult.quality_check.is_complete ? 'Documento completo según la validación básica.' : 'Requiere completar secciones antes de enviarlo.'}
                          </p>
                          {termsResult.quality_check.warnings.length ? (
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {termsResult.quality_check.warnings.map((item) => (
                                <li key={item}>- {item}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </div>

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
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{dashboardResult.dashboard_title}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{dashboardResult.executive_summary}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {renderPdfFormatSelector()}
                          <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadDashboardPdf} disabled={dashboardPdfMutation.isPending}>
                            <Download className="mr-2 h-4 w-4" />
                            {dashboardPdfMutation.isPending ? 'Generando PDF...' : 'Descargar PDF'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {dashboardResult.kpis.map((kpi) => (
                          <div key={kpi.title} className="rounded-2xl border border-primary/15 bg-white p-4">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">{kpi.title}</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{kpi.value}</p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground/70">{kpi.description}</p>
                          </div>
                        ))}
                      </div>

                      {dashboardResult.charts.length ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          {dashboardResult.charts.map((chart) => renderSimpleChart(chart))}
                        </div>
                      ) : null}

                      {dashboardResult.tables.length ? (
                        <div className="space-y-4">
                          {dashboardResult.tables.map((table) => (
                            <div key={table.title} className="rounded-2xl border border-primary/15 bg-white p-4">
                              <p className="text-sm font-medium text-foreground">{table.title}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground/70">{table.description}</p>
                              <div className="mt-3 overflow-x-auto">
                                <table className="w-full min-w-[520px] text-left text-sm">
                                  <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                    <tr>{table.columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr>
                                  </thead>
                                  <tbody>
                                    {table.rows.slice(0, 10).map((row, index) => (
                                      <tr key={index} className="border-t border-primary/10">
                                        {table.columns.map((column) => <td key={column} className="px-3 py-2 text-muted-foreground">{String(row[column] ?? '')}</td>)}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Insights detectados</p>
                          <div className="mt-3 space-y-2">
                            {dashboardResult.insights.map((insight) => (
                              <div key={insight.title} className="rounded-xl bg-primary/5 p-3">
                                <p className="text-sm font-medium text-foreground">{insight.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                                <p className="mt-1 text-xs text-muted-foreground/70">Acción: {insight.recommended_action}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Recomendaciones</p>
                          <div className="mt-2">{renderValueList(dashboardResult.recommendations)}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Calidad de datos</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {dashboardResult.data_profile.rows_detected} filas, {dashboardResult.data_profile.columns_detected} columnas, {dashboardResult.data_profile.files_processed} archivo(s).
                          </p>
                          <div className="mt-2">{renderValueList(dashboardResult.data_profile.data_quality_warnings)}</div>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Filtros sugeridos e información faltante</p>
                          <div className="mt-2">{renderValueList([...dashboardResult.suggested_filters, ...dashboardResult.missing_information])}</div>
                        </div>
                      </div>

                      <p className="text-xs leading-5 text-muted-foreground/70">{dashboardResult.disclaimer}</p>
                    </div>
                  ) : null}

                  {isDashboardCreator && dashboardResult ? renderAgentFeedbackPanel() : null}

                  {isTcoAnalysis && tcoResult ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">A. Resumen ejecutivo</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {tcoResult.executive_summary.final_recommendation}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {renderPdfFormatSelector()}
                          <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadTcoPdf} disabled={tcoPdfMutation.isPending}>
                            <Download className="mr-2 h-4 w-4" />
                            {tcoPdfMutation.isPending ? 'Generando PDF...' : 'Descargar PDF'}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Mejor alternativa</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{tcoResult.executive_summary.best_alternative}</p>
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
                            <table className="w-full min-w-[760px] text-left text-sm">
                              <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Proveedor</th>
                                  <th className="px-4 py-3 font-medium">Archivo fuente</th>
                                  <th className="px-4 py-3 font-medium">Datos detectados</th>
                                  <th className="px-4 py-3 font-medium">Datos faltantes</th>
                                  <th className="px-4 py-3 font-medium">Confianza</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tcoResult.detected_alternatives.map((item, index) => (
                                  <tr key={`${item.supplier_name}-${index}`} className="border-t border-primary/10">
                                    <td className="px-4 py-3 font-medium text-foreground">{item.supplier_name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.source_file}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.data_detected.join(', ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.data_missing.join(', ') || 'No especificado'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.confidence_level ?? 'medium'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {tcoResult.extracted_data_quality?.warnings?.length ? (
                            <div className="mt-3 rounded-2xl border border-primary/15 bg-white p-4">
                              <p className="text-sm font-medium text-foreground">Advertencias de extracción</p>
                              <div className="mt-2">{renderValueList(tcoResult.extracted_data_quality.warnings)}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-primary/15 bg-white p-4">
                        <p className="text-sm font-medium text-foreground">B. Datos usados</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {tcoResult.data_used.map((item, index) => (
                            <div key={index} className="rounded-xl bg-primary/5 p-3">
                              {renderRecordBlock(item)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-foreground">C. Matriz TCO comparativa</p>
                        <div className="mt-3 overflow-x-auto rounded-2xl border border-primary/15 bg-white">
                          <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-primary/5 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                              <tr>
                                <th className="px-4 py-3 font-medium">Componente</th>
                                {tcoResult.tco_totals.map((item) => (
                                  <th key={String(item.alternative)} className="px-4 py-3 font-medium">{String(item.alternative)}</th>
                                ))}
                                <th className="px-4 py-3 font-medium">Notas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tcoResult.tco_matrix.map((row) => (
                                <tr key={row.cost_component} className="border-t border-primary/10">
                                  <td className="px-4 py-3 font-medium text-foreground">{row.cost_component}</td>
                                  {tcoResult.tco_totals.map((item) => (
                                    <td key={`${row.cost_component}-${String(item.alternative)}`} className="px-4 py-3 text-muted-foreground">
                                      {String(row.values[String(item.alternative)] ?? 'No especificado')}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-muted-foreground">{row.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">D. Ranking</p>
                          <div className="mt-3 space-y-2">
                            {tcoResult.ranking.map((item) => (
                              <div key={`${item.position}-${item.alternative}`} className="rounded-xl bg-primary/5 p-3">
                                <p className="text-sm font-medium text-foreground">{item.position}. {item.alternative}</p>
                                <p className="mt-1 text-sm text-muted-foreground">TCO: {item.total_tco ?? 'No especificado'}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">E. Interpretación</p>
                          {renderRecordBlock(tcoResult.interpretation)}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">F. Análisis de sensibilidad</p>
                          {renderRecordBlock(tcoResult.sensitivity_analysis)}
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">G. Recomendación estratégica</p>
                          {renderRecordBlock(tcoResult.strategic_recommendation)}
                        </div>
                      </div>

                      {tcoResult.risk_analysis.length ? (
                        <div className="rounded-2xl border border-primary/15 bg-white p-4">
                          <p className="text-sm font-medium text-foreground">Análisis de riesgos</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {tcoResult.risk_analysis.map((item, index) => (
                              <div key={index} className="rounded-xl bg-primary/5 p-3">
                                {renderRecordBlock(item)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
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
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen ejecutivo</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {proposalComparisonResult.executive_summary}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {renderPdfFormatSelector()}
                          <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadProposalPdf}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar PDF
                          </Button>
                        </div>
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

                      <div className="grid gap-4 md:grid-cols-3">
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


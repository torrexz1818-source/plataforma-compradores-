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
  recordAgentUsage,
  runAgent,
  submitAgentFeedback,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Agent } from '@/types';
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
import { downloadAgentResultPdf } from '@/lib/agentPdf';

const aiPlanLimits: Record<string, number> = {
  free: 1,
  basic: 1,
  professional: 3,
  premium: Number.POSITIVE_INFINITY,
};

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

function getAgentIcon(icon: string) {
  return iconMap[icon as keyof typeof iconMap] ?? Bot;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const curatedAgents: Agent[] = [
  {
    id: 'agent-quote-comparator',
    slug: 'comparativos-propuestas-proveedores',
    name: 'Comparativos de propuestas de proveedores',
    description:
      'Sube propuestas de proveedores y recibe una tabla comparativa con condiciones, riesgos, ranking y recomendación final.',
    longDescription:
      'Centraliza propuestas comerciales, analiza diferencias clave y genera un comparativo orientado a decision para procesos RFQ, licitaciones privadas y compras recurrentes.',
    category: 'Compras',
    automationType: 'Evaluacion',
    useCase:
      'Comparar propuestas en procesos de compra y sustentar la recomendacion de adjudicacion.',
    functionalities: [
      'Consolida propuestas y anexos',
      'Ordena diferencias por precio, plazo y condiciones',
      'Genera comparativo ejecutivo listo para compartir',
    ],
    benefits: [
      'Acelera decisiones de compra',
      'Reduce sesgos al evaluar propuestas',
      'Mejora trazabilidad para auditoria interna',
    ],
    inputs: ['Archivos de propuestas'],
    outputs: ['Tabla comparativa', 'Ranking recomendado', 'Resumen ejecutivo', 'Recomendación final'],
    isActive: true,
    accentColor: '#0f766e',
    icon: 'Scale',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'agent-terms-reference',
    slug: 'elaboracion-terminos-referencia',
    name: 'Elaboracion de terminos de referencia',
    description:
      'Redacta terminos de referencia claros y bien estructurados para procesos de compra y contratacion.',
    longDescription:
      'Ayuda a construir TdR a partir del objetivo, alcance y entregables de la necesidad, entregando una base consistente para solicitar propuestas y alinear expectativas.',
    category: 'Compras',
    automationType: 'Generacion',
    useCase:
      'Preparar bases documentales para servicios, consultorias, licitaciones y compras tecnicas.',
    functionalities: [
      'Estructura objetivo, alcance y entregables',
      'Propone secciones minimas requeridas',
      'Genera borrador listo para revision',
    ],
    benefits: [
      'Reduce tiempo de redaccion',
      'Mejora consistencia documental',
      'Facilita coordinacion con usuarios internos',
    ],
    inputs: ['Objetivo de la contratacion', 'Alcance', 'Entregables esperados'],
    outputs: ['Borrador de TdR', 'Criterios sugeridos', 'Estructura documental'],
    isActive: true,
    accentColor: '#1d4ed8',
    icon: 'FileCheck',
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
  },
  {
    id: 'agent-contract-management',
    slug: 'administracion-contratos',
    name: 'Administracion de contratos',
    description:
      'Organiza obligaciones, alertas y vencimientos clave para una gestion contractual mas ordenada.',
    longDescription:
      'Resume hitos contractuales, identifica renovaciones proximas y ayuda a controlar compromisos operativos o comerciales a lo largo del ciclo de vida del contrato.',
    category: 'Contratos',
    automationType: 'Gestion',
    useCase:
      'Monitorear contratos de suministro, servicios y convenios marco desde compras.',
    functionalities: [
      'Resume clausulas y fechas criticas',
      'Detecta hitos y renovaciones proximas',
      'Genera alertas y checklist de seguimiento',
    ],
    benefits: [
      'Reduce riesgo por vencimientos',
      'Mejora orden documental',
      'Facilita seguimiento contractual',
    ],
    inputs: ['Contrato o anexos', 'Fechas relevantes', 'Obligaciones contractuales'],
    outputs: ['Resumen contractual', 'Alertas de gestion', 'Checklist de seguimiento'],
    isActive: true,
    accentColor: '#7c3aed',
    icon: 'FileCheck',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
  {
    id: 'agent-kraljic-matrix',
    slug: 'segmentacion-proveedores-matriz-kraljic',
    name: 'Segmentacion de proveedores y matriz de Kraljic',
    description:
      'Clasifica proveedores y categorias para apoyar decisiones estrategicas del abastecimiento.',
    longDescription:
      'Segmenta proveedores segun impacto economico y nivel de criticidad, proponiendo una lectura tipo Kraljic que ayude a priorizar estrategias de gestion y relacion.',
    category: 'Sourcing',
    automationType: 'Analitica',
    useCase:
      'Definir estrategias por cuadrante y ordenar cartera de proveedores.',
    functionalities: [
      'Segmenta proveedores por criticidad',
      'Sugiere cuadrantes Kraljic',
      'Propone acciones por segmento',
    ],
    benefits: [
      'Aporta foco estrategico',
      'Mejora priorizacion del equipo',
      'Facilita conversaciones ejecutivas',
    ],
    inputs: ['Base de proveedores o categorias', 'Volumen de compra', 'Criticidad del suministro'],
    outputs: ['Matriz Kraljic', 'Segmentacion recomendada', 'Acciones por cuadrante'],
    isActive: true,
    accentColor: '#ea580c',
    icon: 'ShieldCheck',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  },
  {
    id: 'agent-supplier-performance',
    slug: 'medicion-desempeno-proveedores',
    name: 'Medicion del desempeno de proveedores',
    description:
      'Evalua el comportamiento del proveedor con base en indicadores, incidencias y compromisos de servicio.',
    longDescription:
      'Consolida indicadores de cumplimiento, tiempos, calidad y servicio para generar una evaluacion clara y accionable del desempeno del proveedor.',
    category: 'Proveedores',
    automationType: 'Monitoreo',
    useCase:
      'Seguimiento mensual, trimestral o por proyecto del desempeno de proveedores.',
    functionalities: [
      'Consolida KPIs de desempeno',
      'Resume fortalezas y brechas',
      'Sugiere acciones de mejora',
    ],
    benefits: [
      'Mejora visibilidad del servicio',
      'Estandariza evaluaciones',
      'Facilita planes de mejora',
    ],
    inputs: ['KPIs del proveedor', 'Incidencias relevantes', 'Periodo de evaluacion'],
    outputs: ['Scorecard del proveedor', 'Resumen de desempeno', 'Plan de mejora sugerido'],
    isActive: true,
    accentColor: '#dc2626',
    icon: 'TrendingUp',
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
  {
    id: 'agent-reporting-taylor-made',
    slug: 'reporteria-taylor-made',
    name: 'Reporteria Taylor Made',
    description:
      'Genera reportes personalizados para distintas necesidades ejecutivas, tacticas u operativas.',
    longDescription:
      'Transforma informacion de compras en reportes hechos a medida para comites, liderazgo, usuarios internos o seguimiento especializado de gestion.',
    category: 'Reporteria',
    automationType: 'Generacion',
    useCase:
      'Preparar reportes adaptados al publico, objetivo y necesidad de negocio.',
    functionalities: [
      'Estructura reportes segun audiencia',
      'Resume datos clave y hallazgos',
      'Sugiere narrativa ejecutiva y conclusiones',
    ],
    benefits: [
      'Ahorra tiempo de armado manual',
      'Mejora claridad del mensaje',
      'Permite reportes mas accionables',
    ],
    inputs: ['Datos base del reporte', 'Audiencia objetivo', 'Objetivo del reporte'],
    outputs: ['Reporte personalizado', 'Resumen ejecutivo', 'Recomendaciones accionables'],
    isActive: true,
    accentColor: '#be185d',
    icon: 'BrainCircuit',
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
  },
];

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
  const termsFormSchemaMutation = useTermsFormSchema();
  const termsGenerateMutation = useGenerateTermsOfReference();
  const termsPdfMutation = useDownloadTermsPdf();
  const [limitNotice, setLimitNotice] = useState('');

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents(),
  });

  const curatedAgentsById = useMemo(
    () => new Map(curatedAgents.map((agent) => [agent.id, agent])),
    [],
  );
  const curatedAgentsBySlug = useMemo(
    () => new Map(curatedAgents.map((agent) => [agent.slug, agent])),
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
    setFeedbackComment('');
    setFeedbackCorrection('');
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
    if (agentsFromApi.length) {
      return agentsFromApi
        .filter((agent) => agent.status !== 'hidden')
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    }
    const merged = curatedAgents.map((curatedAgent) => {
      const apiAgent = agentsFromApi.find((agent) => agent.id === curatedAgent.id);
      return apiAgent ? { ...apiAgent, ...curatedAgent } : curatedAgent;
    });
    return merged;
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

  const selectedAgent = routeCuratedAgent
    ? routeCuratedAgent
    : detailQuery.data
      ? {
          ...detailQuery.data,
          ...(curatedAgentsById.get(detailQuery.data.id) ?? {}),
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

  const getUsageKey = () => {
    const today = new Date().toISOString().slice(0, 10);
    return `nodus-ia-usage:${user?.id ?? 'guest'}:${today}`;
  };

  const canRunNodusIa = () => {
    const plan = user?.membership?.plan ?? 'free';
    const limit = aiPlanLimits[plan] ?? aiPlanLimits.free;

    if (!Number.isFinite(limit)) {
      setLimitNotice('');
      return true;
    }

    const used = Number(localStorage.getItem(getUsageKey()) ?? '0');
    if (used >= limit) {
      setLimitNotice('Has alcanzado el límite de tu plan. Cambia de plan para seguir usando Nodus IA.');
      return false;
    }

    setLimitNotice('');
    return true;
  };

  const registerNodusIaUsage = () => {
    const key = getUsageKey();
    const used = Number(localStorage.getItem(key) ?? '0');
    localStorage.setItem(key, String(used + 1));
  };

  const logAgentUsage = (agentId: string, operationName: string, result: Record<string, unknown>, pdfGenerated = false) => {
    const outputTokens = Math.max(1, Math.round(JSON.stringify(result).length / 4));
    void recordAgentUsage({
      agentId,
      operationName,
      model: 'AI Engine',
      outputTokens,
      totalTokens: outputTokens,
      pdfGenerated,
      outputData: {
        status: 'completed',
        summary: String(result.executive_summary ?? result.final_recommendation ?? 'Resultado generado'),
      },
    })
      .then((response) => {
        if (response.agentRunId) {
          setLoggedRunIds((current) => ({ ...current, [agentId]: response.agentRunId ?? '' }));
        }
      })
      .catch(() => undefined);
  };

  const handleRunAgent = () => {
    if (!selectedAgent) {
      return;
    }

    if (!canRunNodusIa()) {
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

    const inputData = selectedAgent.inputs.reduce<Record<string, string>>((acc, label) => {
      acc[label] = agentInputs[label]?.trim() ?? '';
      return acc;
    }, {});

    runMutation.mutate(
      {
        agentId: selectedAgent.id,
        inputData,
      },
      {
        onSuccess: () => registerNodusIaUsage(),
      },
    );
  };

  const handleComparisonFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setUploadedComparisonFiles(files);
  };

  const handleProposalComparison = () => {
    if (!selectedAgent) {
      return;
    }

    if (!canRunNodusIa()) {
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

    proposalComparisonMutation.mutate(
      {
        title: selectedAgent.name,
        service: comparisonService.trim(),
        objective: comparisonObjective.trim(),
        files: uploadedComparisonFiles,
      },
      {
        onSuccess: (result) => {
          registerNodusIaUsage();
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

  const handleGenerateTerms = () => {
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

    if (!canRunNodusIa()) {
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
          registerNodusIaUsage();
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

  const handleDownloadTermsPdf = () => {
    if (!termsGenerateMutation.data) {
      return;
    }

    termsPdfMutation.mutate(termsGenerateMutation.data, {
      onError: (error) => {
        toast({
          title: 'No se pudo descargar el PDF.',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        });
      },
    });
  };

  const handleDownloadProposalPdf = () => {
    if (!proposalComparisonResult) {
      return;
    }

    downloadAgentResultPdf({
      title: 'Comparativos de propuestas de proveedores',
      userName: user?.fullName,
      result: proposalComparisonResult,
      fileName: 'comparativo-propuestas-nodus-ia.pdf',
    });
  };

  const handleDownloadRunPdf = () => {
    if (!runMutation.data) {
      return;
    }

    downloadAgentResultPdf({
      title: selectedAgent?.name ?? 'Resultado Nodus IA',
      userName: user?.fullName,
      result: runMutation.data.execution.outputData,
      fileName: 'resultado-nodus-ia.pdf',
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
                        {!isQuoteComparator && !isTermsReference ? (
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
                        onClick={() => navigate('/perfil')}
                      >
                        Cambiar de plan
                      </Button>
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

                  {(proposalComparisonMutation.isPending || termsGenerateMutation.isPending || runMutation.isPending) ? (
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-primary">
                      Nodus IA está trabajando en tu solicitud…
                    </div>
                  ) : null}

                  {runMutation.data?.execution.agentId === selectedAgent.id ? (
                    <div className="rounded-[24px] border border-success/15 bg-success/15 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-medium text-success-foreground">Resultado mas reciente</p>
                        <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadRunPdf}>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar PDF
                        </Button>
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

                  {isQuoteComparator && proposalComparisonResult ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Resumen ejecutivo</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {proposalComparisonResult.executive_summary}
                          </p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-full" onClick={handleDownloadProposalPdf}>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar PDF
                        </Button>
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

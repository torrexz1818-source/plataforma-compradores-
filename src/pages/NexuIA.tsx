import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
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
  activateAgent,
  getAgentDetail,
  getAgents,
  getMyAgentExecutions,
  runAgent,
  runN8nComparativeWebhook,
} from '@/lib/api';
import type { Agent } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

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
      'Compara propuestas de distintos proveedores y entrega un resumen ejecutivo con recomendacion final.',
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
    outputs: ['PDF comparativo', 'Ranking recomendado', 'Resumen ejecutivo'],
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
  const { id: routeAgentId } = useParams();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedAutomationType, setSelectedAutomationType] = useState('Todos');
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [uploadedComparisonFiles, setUploadedComparisonFiles] = useState<File[]>([]);
  const [n8nComparativeResult, setN8nComparativeResult] = useState<Record<string, unknown> | null>(null);

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
    setAgentInputs({});
    setN8nComparativeResult(null);
  }, [routeAgentId]);

  const activateMutation = useMutation({
    mutationFn: activateAgent,
    onSuccess: ({ message }) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agents', selectedAgentId] });
      toast({
        title: 'Agente activado',
        description: message,
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo activar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

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

  const n8nComparativeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) {
        throw new Error('Selecciona un agente.');
      }

      if (!uploadedComparisonFiles.length) {
        throw new Error('Sube al menos un PDF, Excel, CSV o documento para enviar a n8n.');
      }

      return runN8nComparativeWebhook({
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        files: uploadedComparisonFiles,
      });
    },
    onSuccess: (result) => {
      setN8nComparativeResult(result);
      toast({
        title: 'Flujo n8n ejecutado',
        description: 'El comparativo fue generado y ya se muestra en esta vista.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo ejecutar n8n',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const catalogAgents = useMemo(() => {
    const agentsFromApi = agentsQuery.data ?? [];
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
  const selectedAgentExecutions = (executionsQuery.data ?? []).filter(
    (execution) => execution.agentId === selectedAgent?.id,
  );
  const isDetailView = Boolean(routeAgentId);
  const isQuoteComparator =
    selectedAgent?.id === 'agent-quote-comparator' ||
    selectedAgent?.slug === 'comparador-cotizaciones';

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

  const handleRunAgent = () => {
    if (!selectedAgent) {
      return;
    }

    const inputData = selectedAgent.inputs.reduce<Record<string, string>>((acc, label) => {
      acc[label] = agentInputs[label]?.trim() ?? '';
      return acc;
    }, {});

    runMutation.mutate({
      agentId: selectedAgent.id,
      inputData,
    });
  };

  const handleComparisonFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setUploadedComparisonFiles(files);
  };

  const comparativePdfUrl =
    typeof n8nComparativeResult?.pdfUrl === 'string' ? n8nComparativeResult.pdfUrl : '';
  const comparativePdfFileName =
    typeof n8nComparativeResult?.fileName === 'string'
      ? n8nComparativeResult.fileName
      : 'comparativo-cotizaciones.pdf';

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

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => navigate(`/nexu-ia/${agent.id}`)}
                    className={`rounded-[26px] border p-5 text-left transition-all ${
                      isSelected
                        ? 'border-primary/25 bg-[var(--gradient-soft)] shadow-md'
                        : 'border-primary/15 bg-white hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm'
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
                        {agent.category}
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
                        {agent.isActive ? 'Usar agente' : 'Activar'}
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
                      className={selectedAgent.isActive ? 'border-success/25 text-success-foreground' : 'border-destructive/20 text-destructive'}
                    >
                      {selectedAgent.isActive ? 'Activo' : 'Disponible para activar'}
                    </Badge>
                  </div>

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
                        {isQuoteComparator ? (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground/80">
                                Archivos de cotizaciones
                              </label>
                              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/35 hover:bg-primary/10">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    Subir PDF, Excel, CSV, Word u otros soportes
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground/70">
                                    Puedes cargar varios archivos a la vez para tu flujo de n8n.
                                  </p>
                                </div>
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg"
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
                        {!isQuoteComparator ? (
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

                  <div className="flex flex-wrap gap-3">
                    {isQuoteComparator ? (
                      <Button
                        type="button"
                        className="rounded-full bg-primary hover:bg-primary"
                        onClick={() => n8nComparativeMutation.mutate()}
                        disabled={n8nComparativeMutation.isPending}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {n8nComparativeMutation.isPending
                          ? 'Enviando a n8n...'
                          : 'Ejecutar'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant={selectedAgent.isActive ? 'outline' : 'default'}
                          className={selectedAgent.isActive ? 'rounded-full' : 'rounded-full bg-primary hover:bg-primary'}
                          onClick={() => activateMutation.mutate(selectedAgent.id)}
                          disabled={activateMutation.isPending}
                        >
                          {activateMutation.isPending ? 'Activando...' : selectedAgent.isActive ? 'Reactivar agente' : 'Activar'}
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full bg-primary hover:bg-primary"
                          onClick={handleRunAgent}
                          disabled={runMutation.isPending}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          {runMutation.isPending ? 'Ejecutando...' : 'Ejecutar agente'}
                        </Button>
                      </>
                    )}
                  </div>

                  {runMutation.data?.execution.agentId === selectedAgent.id ? (
                    <div className="rounded-[24px] border border-success/15 bg-success/15 p-4">
                      <p className="text-sm font-medium text-success-foreground">Resultado mas reciente</p>
                      <p className="mt-2 text-sm text-success-foreground">
                        {String(runMutation.data.execution.outputData.summary ?? 'Ejecucion completada')}
                      </p>
                      <p className="mt-2 text-xs text-success-foreground">
                        Ejecutado el {formatDateTime(runMutation.data.execution.executedAt)}
                      </p>
                    </div>
                  ) : null}

                  {isQuoteComparator && comparativePdfUrl ? (
                    <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-4">
                      <p className="text-sm font-medium text-foreground">PDF comparativo generado</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        El flujo generó el comparativo final en PDF.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={comparativePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary"
                        >
                          <FileText className="h-4 w-4" />
                          Ver PDF
                        </a>
                        <a
                          href={comparativePdfUrl}
                          download={comparativePdfFileName}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-primary/35 hover:text-foreground"
                        >
                          <ArrowRight className="h-4 w-4" />
                          Descargar PDF
                        </a>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground/70">
                  Elige un agente del catalogo para ver descripcion completa, beneficios e inputs.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/15 shadow-sm">
            <CardHeader>
              <CardDescription>Historial de ejecuciones</CardDescription>
              <CardTitle className="text-xl text-foreground">Automatizaciones recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {executionsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground/70">Cargando historial...</p>
              ) : selectedAgentExecutions.length ? (
                selectedAgentExecutions.slice(0, 4).map((execution) => (
                  <div key={execution.id} className="rounded-[22px] border border-primary/15 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{execution.agentName}</p>
                      <Badge variant="outline" className="border-primary/15 text-muted-foreground">
                        {formatDateTime(execution.executedAt)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {String(execution.outputData.summary ?? 'Ejecucion completada')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-primary/15 bg-primary/5 p-6 text-sm text-muted-foreground/70">
                  Aun no hay ejecuciones para este agente. Ejecutalo para generar el primer historial.
                </div>
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

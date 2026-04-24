import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
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
  Zap,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { activateAgent, getAgentDetail, getAgents, getMyAgentExecutions, runAgent } from '@/lib/api';
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

const NexuIA = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: routeAgentId } = useParams();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedAutomationType, setSelectedAutomationType] = useState('Todos');
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents(),
  });

  const selectedAgentId = routeAgentId || '';

  const detailQuery = useQuery({
    queryKey: ['agents', selectedAgentId],
    queryFn: () => getAgentDetail(selectedAgentId),
    enabled: Boolean(selectedAgentId),
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

  const categories = useMemo(() => {
    const items = new Set((agentsQuery.data ?? []).map((agent) => agent.category));
    return ['Todos', ...items];
  }, [agentsQuery.data]);

  const automationTypes = useMemo(() => {
    const items = new Set((agentsQuery.data ?? []).map((agent) => agent.automationType));
    return ['Todos', ...items];
  }, [agentsQuery.data]);

  const filteredAgents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (agentsQuery.data ?? []).filter((agent) => {
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
  }, [agentsQuery.data, search, selectedAutomationType, selectedCategory]);

  const selectedAgent = detailQuery.data;
  const selectedAgentExecutions = (executionsQuery.data ?? []).filter(
    (execution) => execution.agentId === selectedAgent?.id,
  );
  const isDetailView = Boolean(routeAgentId);

  const marketplaceStats = [
    {
      label: 'Agentes disponibles',
      value: String(agentsQuery.data?.length ?? 0),
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

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#f8fafc_0%,#ffffff_42%,#f7f7f5_100%)]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
              NEXU AI MARKETPLACE
            </Badge>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Tienda de agentes IA y automatizaciones para compras
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Explora agentes especializados, activa automatizaciones y ejecuta flujos de compras
              en un entorno simple, visual y escalable para sourcing, riesgo, logistica y
              negociacion.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700">
                <Bot className="h-4 w-4 text-slate-600" />
                Catalogo listo para usar
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700">
                <Zap className="h-4 w-4 text-slate-600" />
                Ejecucion bajo demanda
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {marketplaceStats.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.label} className="border-white/70 bg-white/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardDescription className="flex items-center gap-2 text-slate-500">
                      <Icon className="h-4 w-4 text-slate-600" />
                      {item.label}
                    </CardDescription>
                    <CardTitle className="text-3xl text-slate-900">{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {!isDetailView ? (
      <section className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">Marketplace de agentes IA</CardTitle>
            <CardDescription>
              Filtra por categoria o automatizacion y abre la ficha completa de cada agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, caso de uso o descripcion"
                className="h-11 rounded-2xl border-slate-200 pl-11"
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
                        ? 'border-slate-300 bg-[linear-gradient(145deg,#fafaf9_0%,#f3f4f6_100%)] shadow-md'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: '#111827' }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        {agent.category}
                      </Badge>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{agent.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{agent.description}</p>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Caso de uso
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{agent.useCase}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                        {agent.automationType}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                        {agent.isActive ? 'Usar agente' : 'Activar'}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {!filteredAgents.length ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
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
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Regresar
        </button>

        <div className="space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-[linear-gradient(145deg,#fafaf9_0%,#ffffff_100%)]">
              <CardDescription>Vista detalle del agente</CardDescription>
              <CardTitle className="text-xl text-slate-900">
                {selectedAgent ? selectedAgent.name : 'Selecciona un agente'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {detailQuery.isLoading ? (
                <p className="text-sm text-slate-500">Cargando detalle del agente...</p>
              ) : selectedAgent ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="border-slate-200 text-slate-600">
                      {selectedAgent.category}
                    </Badge>
                    <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                      {selectedAgent.automationType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={selectedAgent.isActive ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-700'}
                    >
                      {selectedAgent.isActive ? 'Activo' : 'Disponible para activar'}
                    </Badge>
                  </div>

                  <p className="text-sm leading-6 text-slate-600">{selectedAgent.longDescription}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Funcionalidades
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.functionalities.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Beneficios
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.benefits.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                            <Sparkles className="mt-0.5 h-4 w-4 text-slate-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Inputs requeridos
                      </p>
                      <div className="mt-3 space-y-3">
                        {selectedAgent.inputs.map((inputLabel) => (
                          <div key={inputLabel} className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">{inputLabel}</label>
                            <Input
                              value={agentInputs[inputLabel] ?? ''}
                              onChange={(event) =>
                                setAgentInputs((current) => ({
                                  ...current,
                                  [inputLabel]: event.target.value,
                                }))
                              }
                              placeholder={`Ingresa ${inputLabel.toLowerCase()}`}
                              className="rounded-xl border-slate-200"
                            />
                          </div>
                        ))}
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
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
                            className="min-h-[104px] rounded-2xl border-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Output esperado
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedAgent.outputs.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                            <ArrowRight className="mt-0.5 h-4 w-4 text-slate-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 rounded-[20px] bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Caso de uso principal
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{selectedAgent.useCase}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={selectedAgent.isActive ? 'outline' : 'default'}
                      className={selectedAgent.isActive ? 'rounded-full' : 'rounded-full bg-slate-900 hover:bg-slate-800'}
                      onClick={() => activateMutation.mutate(selectedAgent.id)}
                      disabled={activateMutation.isPending}
                    >
                      {activateMutation.isPending ? 'Activando...' : selectedAgent.isActive ? 'Reactivar agente' : 'Activar'}
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full bg-slate-900 hover:bg-slate-800"
                      onClick={handleRunAgent}
                      disabled={runMutation.isPending}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {runMutation.isPending ? 'Ejecutando...' : 'Ejecutar agente'}
                    </Button>
                  </div>

                  {runMutation.data?.execution.agentId === selectedAgent.id ? (
                    <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-sm font-semibold text-emerald-900">Resultado mas reciente</p>
                      <p className="mt-2 text-sm text-emerald-800">
                        {String(runMutation.data.execution.outputData.summary ?? 'Ejecucion completada')}
                      </p>
                      <p className="mt-2 text-xs text-emerald-700">
                        Ejecutado el {formatDateTime(runMutation.data.execution.executedAt)}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Elige un agente del catalogo para ver descripcion completa, beneficios e inputs.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardDescription>Historial de ejecuciones</CardDescription>
              <CardTitle className="text-xl text-slate-900">Automatizaciones recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {executionsQuery.isLoading ? (
                <p className="text-sm text-slate-500">Cargando historial...</p>
              ) : selectedAgentExecutions.length ? (
                selectedAgentExecutions.slice(0, 4).map((execution) => (
                  <div key={execution.id} className="rounded-[22px] border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{execution.agentName}</p>
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        {formatDateTime(execution.executedAt)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {String(execution.outputData.summary ?? 'Ejecucion completada')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
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

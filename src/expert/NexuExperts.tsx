import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Link2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  cancelExpertAppointment,
  createExpertAppointment,
  getExpertAvailability,
  getExpertProfile,
  getExperts,
  getMyExpertAvailabilitySettings,
  getMyExpertAppointments,
  getMyExpertCalendarConnection,
  rescheduleExpertAppointment,
  updateMyExpertAvailabilitySettings,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ExpertWeeklyAvailabilityItem } from '@/types';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getTomorrowInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

const TIME_OPTIONS = Array.from({ length: 15 }, (_, index) =>
  `${String(index + 6).padStart(2, '0')}:00`,
);
const EMPTY_WEEKLY_AVAILABILITY: ExpertWeeklyAvailabilityItem[] = [
  { day: 'Lunes', enabled: true, slots: [{ id: 'lunes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Martes', enabled: true, slots: [{ id: 'martes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Miercoles', enabled: true, slots: [{ id: 'miercoles-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Jueves', enabled: true, slots: [{ id: 'jueves-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Viernes', enabled: true, slots: [{ id: 'viernes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Sabado', enabled: false, slots: [{ id: 'sabado-1', startTime: '09:00', endTime: '13:00' }] },
  { day: 'Domingo', enabled: false, slots: [{ id: 'domingo-1', startTime: '09:00', endTime: '13:00' }] },
];

const NexuExperts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeExpertId } = useParams();
  const queryClient = useQueryClient();
  const { user, refreshMe } = useAuth();
  const scheduleCardRef = useRef<HTMLDivElement | null>(null);
  const [selectedExpertId, setSelectedExpertId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(getTomorrowInputValue);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState<string>('');
  const [weeklyAvailability, setWeeklyAvailability] = useState<ExpertWeeklyAvailabilityItem[]>(
    EMPTY_WEEKLY_AVAILABILITY,
  );
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isMeetingsOpen, setIsMeetingsOpen] = useState(true);
  const [rescheduleValues, setRescheduleValues] = useState<Record<string, string>>({});

  const expertsQuery = useQuery({
    queryKey: ['experts'],
    queryFn: getExperts,
  });

  const appointmentsQuery = useQuery({
    queryKey: ['experts', 'appointments', 'mine'],
    queryFn: getMyExpertAppointments,
  });
  const myCalendarConnectionQuery = useQuery({
    queryKey: ['experts', 'me', 'calendar'],
    queryFn: getMyExpertCalendarConnection,
    enabled: Boolean(user),
  });
  const myAvailabilityQuery = useQuery({
    queryKey: ['experts', 'me', 'availability'],
    queryFn: getMyExpertAvailabilitySettings,
    enabled: user?.role === 'expert',
  });

  const expertProfileQuery = useQuery({
    queryKey: ['experts', selectedExpertId],
    queryFn: () => getExpertProfile(selectedExpertId),
    enabled: Boolean(selectedExpertId),
  });

  const availabilityQuery = useQuery({
    queryKey: ['experts', selectedExpertId, 'availability', selectedDate],
    queryFn: () => getExpertAvailability(selectedExpertId, selectedDate),
    enabled: Boolean(selectedExpertId && selectedDate),
  });
  const selectedExpert = expertsQuery.data?.find((expert) => expert.id === selectedExpertId);
  const dashboardItems = useMemo(() => appointmentsQuery.data?.items ?? [], [appointmentsQuery.data]);
  const isBuyer = user?.role === 'buyer';
  const isExpert = user?.role === 'expert';
  const isDetailView = Boolean(routeExpertId);
  const calendarConnected = Boolean(myCalendarConnectionQuery.data?.connected);
  const orderedMeetings = useMemo(() => {
    if (!dashboardItems.length) {
      return [];
    }

    if (!lastCreatedId) {
      return dashboardItems;
    }

    const latestCreated = dashboardItems.find((item) => item.id === lastCreatedId);
    const remaining = dashboardItems.filter((item) => item.id !== lastCreatedId);
    return latestCreated ? [latestCreated, ...remaining] : dashboardItems;
  }, [dashboardItems, lastCreatedId]);

  useEffect(() => {
    if (routeExpertId) {
      setSelectedExpertId(routeExpertId);
      return;
    }

    if (!selectedExpertId && expertsQuery.data?.length) {
      setSelectedExpertId(expertsQuery.data[0].id);
    }
  }, [expertsQuery.data, routeExpertId, selectedExpertId]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedDate, selectedExpertId]);

  useEffect(() => {
    if (myAvailabilityQuery.data?.weeklyAvailability?.length) {
      setWeeklyAvailability(myAvailabilityQuery.data.weeklyAvailability);
    }
  }, [myAvailabilityQuery.data]);

  useEffect(() => {
    if (location.hash !== '#agendar' || !isDetailView || !isBuyer) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      scheduleCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [expertProfileQuery.data, isBuyer, isDetailView, location.hash]);

  const createAppointmentMutation = useMutation({
    mutationFn: createExpertAppointment,
    onSuccess: (result) => {
      setLastCreatedId(result.appointment.id);
      setTopic('');
      setSelectedSlot('');
      queryClient.invalidateQueries({ queryKey: ['experts', 'appointments', 'mine'] });
      queryClient.invalidateQueries({
        queryKey: ['experts', selectedExpertId, 'availability', selectedDate],
      });
      queryClient.invalidateQueries({ queryKey: ['experts'] });
      queryClient.invalidateQueries({ queryKey: ['experts', selectedExpertId] });

      toast({
        title: 'Cita confirmada',
        description: result.emailWarning
          ? `La cita se creo, pero hubo un problema con el correo: ${result.emailWarning}`
          : 'La reunion ya fue creada con Google Calendar y Google Meet.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo agendar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });
  const cancelAppointmentMutation = useMutation({
    mutationFn: cancelExpertAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experts', 'appointments', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['experts'] });
      queryClient.invalidateQueries({
        queryKey: ['experts', selectedExpertId, 'availability', selectedDate],
      });
      toast({
        title: 'Cita cancelada',
        description: 'La reserva fue cancelada y se sincronizo con Google Calendar cuando correspondia.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo cancelar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: ({ appointmentId, startsAt }: { appointmentId: string; startsAt: string }) =>
      rescheduleExpertAppointment(appointmentId, { startsAt }),
    onSuccess: (result) => {
      setRescheduleValues((current) => {
        const next = { ...current };
        delete next[result.appointment.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['experts', 'appointments', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['experts'] });
      queryClient.invalidateQueries({
        queryKey: ['experts', selectedExpertId, 'availability', selectedDate],
      });
      toast({
        title: 'Cita reprogramada',
        description: 'La nueva fecha se sincronizo con Google Calendar cuando correspondia.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo reprogramar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });
  const saveAvailabilityMutation = useMutation({
    mutationFn: updateMyExpertAvailabilitySettings,
    onSuccess: async (result) => {
      setWeeklyAvailability(result.weeklyAvailability);
      await refreshMe();
      queryClient.invalidateQueries({ queryKey: ['experts', 'me', 'availability'] });
      queryClient.invalidateQueries({ queryKey: ['experts'] });
      queryClient.invalidateQueries({ queryKey: ['experts', user?.id] });
      toast({
        title: 'Disponibilidad actualizada',
        description: 'Tus dias y horarios ya estan visibles para los compradores.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar la disponibilidad',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const handleAvailabilityChange = (
    day: string,
    key: 'enabled',
    value: boolean,
  ) => {
    setWeeklyAvailability((current) =>
      current.map((item) => (item.day === day ? { ...item, [key]: value } : item)),
    );
  };
  const handleSlotChange = (
    day: string,
    slotId: string,
    key: 'startTime' | 'endTime',
    value: string,
  ) => {
    setWeeklyAvailability((current) =>
      current.map((item) =>
        item.day === day
          ? {
              ...item,
              slots: item.slots.map((slot) =>
                slot.id === slotId ? { ...slot, [key]: value } : slot,
              ),
            }
          : item,
      ),
    );
  };
  const addSlot = (day: string) => {
    setWeeklyAvailability((current) =>
      current.map((item) =>
        item.day === day
          ? {
              ...item,
              enabled: true,
              slots: [
                ...item.slots,
                {
                  id: `${day.toLowerCase()}-${crypto.randomUUID()}`,
                  startTime: '09:00',
                  endTime: '13:00',
                },
              ],
            }
          : item,
      ),
    );
  };
  const removeSlot = (day: string, slotId: string) => {
    setWeeklyAvailability((current) =>
      current.map((item) =>
        item.day === day
          ? {
              ...item,
              slots:
                item.slots.length > 1
                  ? item.slots.filter((slot) => slot.id !== slotId)
                  : item.slots,
            }
          : item,
      ),
    );
  };
  const formatBuyerView = (item: ExpertWeeklyAvailabilityItem) => {
    if (!item.enabled || !item.slots.length) {
      return `${item.day}: no disponible`;
    }

    return `${item.day}: ${item.slots
      .map((slot) => `${slot.startTime} - ${slot.endTime}`)
      .join(' | ')}`;
  };

  return (
    <div className="space-y-6 pb-8">
        <section className="rounded-[28px] bg-[linear-gradient(110deg,#0E109E_0%,#2521B9_48%,#5A31D5_100%)] px-5 py-6 text-white shadow-[0_18px_44px_rgba(14,16,158,0.16)] sm:px-10 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white ring-1 ring-white/18">
              Nodus Experts
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">
              Conecta con expertos del sector
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/90">
              Descubre perfiles completos, valida disponibilidad en tiempo real y agenda tu cita con expertos del sector.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Card className="border-0 bg-[#6B49D8] text-white shadow-none">
              <CardHeader className="pb-3">
                <CardDescription className="text-white/78">Expertos activos</CardDescription>
                <CardTitle className="text-3xl text-white">
                  {expertsQuery.data?.length ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 bg-[#6B49D8] text-white shadow-none">
              <CardHeader className="pb-3">
                <CardDescription className="text-white/78">Tus citas programadas</CardDescription>
                <CardTitle className="text-3xl text-white">{dashboardItems.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <Card className="overflow-hidden border-secondary/15 bg-[var(--gradient-soft)] text-foreground shadow-sm">
          <CardHeader>
            <CardDescription className="text-muted-foreground">Sincronizacion</CardDescription>
            <CardTitle className="text-xl text-primary">Google Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-primary/20 bg-[var(--gradient-soft)] p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  {calendarConnected ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-secondary">
                      <Sparkles className="h-3.5 w-3.5" />
                      Sincronizacion activa
                    </div>
                  ) : null}
                  <div>
                    <p className="text-lg font-medium text-primary">
                      Reuniones conectadas con Google Calendar
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Cada cita crea el evento en Google Calendar y deja lista la sincronizacion para comprador y experto.
                    </p>
                  </div>
                </div>

                {isBuyer && !calendarConnected ? (
                  <button
                    type="button"
                    onClick={() => navigate('/calendar-setup')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary"
                  >
                    <Link2 className="h-4 w-4" />
                    Conecta tu Google calendario para poder agendar
                  </button>
                ) : null}
              </div>
            </div>

            {orderedMeetings.length ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                <button
                  type="button"
                  onClick={() => setIsMeetingsOpen((current) => !current)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                      <CheckCircle2 className="h-4 w-4" />
                      Mis reuniones
                    </div>
                    <p className="mt-1 text-sm text-primary">
                      {orderedMeetings.length} reuniones guardadas en la plataforma
                    </p>
                  </div>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 text-secondary transition-transform ${
                      isMeetingsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isMeetingsOpen ? (
                  <div className="mt-3 grid gap-3">
                    {orderedMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="rounded-2xl border border-primary/20 bg-white/80 p-4"
                      >
                        <div className="grid gap-2">
                          <p className="text-sm text-muted-foreground">Experto: {meeting.expertName}</p>
                          <p className="text-sm text-muted-foreground">Comprador: {meeting.buyerName}</p>
                          <p className="text-sm text-muted-foreground">
                            Fecha: {formatDateTime(meeting.startsAt)}
                          </p>
                          <p className="text-sm text-muted-foreground">Tema: {meeting.topic}</p>
                          <p className="text-sm text-muted-foreground">
                            Correo de confirmacion: {meeting.emailSent ? 'enviado' : 'pendiente'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Estado de Calendar:{' '}
                            {meeting.googleCalendarEventId
                              ? 'evento creado'
                              : 'pendiente de sincronizacion'}
                          </p>
                        </div>
                        {meeting.status === 'scheduled' ? (
                          <div className="mt-3 flex flex-wrap items-end gap-2">
                            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                              Nueva fecha y hora
                              <Input
                                type="datetime-local"
                                value={
                                  rescheduleValues[meeting.id] ??
                                  toDateTimeLocalValue(meeting.startsAt)
                                }
                                onChange={(event) =>
                                  setRescheduleValues((current) => ({
                                    ...current,
                                    [meeting.id]: event.target.value,
                                  }))
                                }
                                className="h-9 w-[220px] rounded-full border-primary/25 bg-white text-xs"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const nextValue =
                                  rescheduleValues[meeting.id] ??
                                  toDateTimeLocalValue(meeting.startsAt);
                                rescheduleAppointmentMutation.mutate({
                                  appointmentId: meeting.id,
                                  startsAt: new Date(nextValue).toISOString(),
                                });
                              }}
                              disabled={rescheduleAppointmentMutation.isPending}
                              className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/25 bg-white px-3 text-xs font-medium text-primary disabled:opacity-60"
                            >
                              <Clock3 className="h-3.5 w-3.5" />
                              Reprogramar
                            </button>
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {meeting.googleMeetLink ? (
                            <a
                              href={meeting.googleMeetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Enlace de la reunion
                            </a>
                          ) : null}
                          {meeting.buyerGoogleCalendarHtmlLink || meeting.googleCalendarHtmlLink ? (
                            <a
                              href={
                                meeting.buyerGoogleCalendarHtmlLink ||
                                meeting.googleCalendarHtmlLink
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-3 py-1.5 text-xs font-medium text-primary"
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              Ver en tu Calendar
                            </a>
                          ) : null}
                          {meeting.status === 'scheduled' ? (
                            <button
                              type="button"
                              onClick={() => cancelAppointmentMutation.mutate(meeting.id)}
                              disabled={cancelAppointmentMutation.isPending}
                              className="inline-flex items-center gap-2 rounded-full border border-destructive/25 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Cancelar cita
                            </button>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-muted bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                              Cancelada
                            </span>
                          )}
                        </div>
                        {!meeting.emailSent && meeting.emailError ? (
                          <p className="mt-3 text-xs text-destructive">{meeting.emailError}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cuando confirmes una cita, aqui veras el resumen de lo coordinado y la trazabilidad de la sincronizacion.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {isExpert ? (
        <section className="grid gap-6">
          <Card className="border-primary/15">
            <button
              type="button"
              onClick={() => setIsAvailabilityOpen((current) => !current)}
              className="flex w-full items-center justify-between px-6 py-5 text-left"
            >
              <div>
                <p className="text-xl font-medium text-foreground">
                  Configura tu disponibilidad semanal
                </p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Define que dias atiendes y agrega uno o varios horarios por dia.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-secondary/25 text-secondary">
                  {weeklyAvailability.filter((item) => item.enabled).length} dias activos
                </Badge>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground/70 transition-transform ${
                    isAvailabilityOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
            {isAvailabilityOpen ? (
              <CardContent className="space-y-4 pt-0">
                {myAvailabilityQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando configuracion...</p>
                ) : (
                  <>
                    <div className="grid gap-3">
                      {weeklyAvailability.map((item) => (
                        <div
                          key={item.day}
                          className="rounded-2xl border border-primary/15 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(event) =>
                                  handleAvailabilityChange(item.day, 'enabled', event.target.checked)
                                }
                                className="h-4 w-4 rounded border-primary/25 text-secondary"
                              />
                              <div>
                                <p className="text-sm font-medium text-foreground">{item.day}</p>
                                <p className="text-xs text-muted-foreground/70">
                                  {item.enabled ? 'Disponible para citas' : 'No disponible'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-primary/5 px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                                Vista comprador
                              </p>
                              <p className="mt-2 text-sm text-foreground/80">{formatBuyerView(item)}</p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {item.slots.map((slot) => (
                              <div
                                key={slot.id}
                                className="grid gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-3 md:grid-cols-[1fr_1fr_auto]"
                              >
                                <div>
                                  <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Desde
                                  </label>
                                  <select
                                    value={slot.startTime}
                                    disabled={!item.enabled}
                                    onChange={(event) =>
                                      handleSlotChange(item.day, slot.id, 'startTime', event.target.value)
                                    }
                                    className="h-10 w-full rounded-md border border-primary/15 bg-white px-3 text-sm text-foreground/80 disabled:bg-primary/10 disabled:text-muted-foreground/60"
                                  >
                                    {TIME_OPTIONS.map((time) => (
                                      <option key={time} value={time}>
                                        {time}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                                    Hasta
                                  </label>
                                  <select
                                    value={slot.endTime}
                                    disabled={!item.enabled}
                                    onChange={(event) =>
                                      handleSlotChange(item.day, slot.id, 'endTime', event.target.value)
                                    }
                                    className="h-10 w-full rounded-md border border-primary/15 bg-white px-3 text-sm text-foreground/80 disabled:bg-primary/10 disabled:text-muted-foreground/60"
                                  >
                                    {TIME_OPTIONS.map((time) => (
                                      <option key={time} value={time}>
                                        {time}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-end">
                                  <button
                                    type="button"
                                    disabled={item.slots.length === 1}
                                    onClick={() => removeSlot(item.day, slot.id)}
                                    className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/15 bg-white px-3 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Quitar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => addSlot(item.day)}
                              className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 px-4 py-2 text-sm font-medium text-secondary"
                            >
                              <Plus className="h-4 w-4" />
                              Agregar horario
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        className="bg-primary hover:bg-primary"
                        disabled={saveAvailabilityMutation.isPending}
                        onClick={() =>
                          saveAvailabilityMutation.mutate({
                            weeklyAvailability,
                          })
                        }
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {saveAvailabilityMutation.isPending
                          ? 'Guardando horarios...'
                          : 'Guardar disponibilidad'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6">
        {!isDetailView ? (
          <Card className="border-primary/15">
            <CardHeader id="experts-list">
              <CardTitle className="text-xl text-foreground">Listado de expertos</CardTitle>
              <CardDescription>
                Cards modernas con experiencia, especialidad y acceso directo a agenda.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {expertsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando expertos...</p>
              ) : (
                expertsQuery.data?.map((expert) => (
                  <button
                    key={expert.id}
                    type="button"
                    onClick={() => setSelectedExpertId(expert.id)}
                    className={`rounded-[24px] border p-4 text-left transition-all ${
                      selectedExpertId === expert.id
                        ? 'border-secondary/40 bg-secondary/10 shadow-md'
                        : 'border-primary/15 bg-white hover:border-secondary/20 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                    src={expert.photo || 'https://placehold.co/160x160?text=Nodus'}
                        alt={expert.fullName}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{expert.fullName}</p>
                        <p className="text-xs text-muted-foreground/70">{expert.specialty}</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">{expert.industry}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{expert.shortBio}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {expert.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="outline" className="border-primary/15 text-muted-foreground">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/70">{expert.experience}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/nexu-experts/${expert.id}#agendar`);
                        }}
                        className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white"
                      >
                        Agendar
                      </button>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {isDetailView ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => navigate('/nexu-experts')}
            className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-secondary/25 hover:text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </button>
          <Card ref={scheduleCardRef} className="border-primary/15">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">Perfil del experto</CardTitle>
              <CardDescription>Vista detallada con disponibilidad y propuesta de valor.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedExpertId || expertProfileQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando perfil...</p>
              ) : expertProfileQuery.data ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <img
                src={expertProfileQuery.data.photo || 'https://placehold.co/320x320?text=Nodus'}
                      alt={expertProfileQuery.data.fullName}
                      className="h-28 w-28 rounded-[24px] object-cover"
                    />
                    <div className="space-y-2">
                      <div>
                        <h2 className="text-2xl font-medium text-foreground">
                          {expertProfileQuery.data.fullName}
                        </h2>
                        <p className="text-sm text-muted-foreground/70">
                          {expertProfileQuery.data.professionalProfile}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="border border-primary/20 bg-primary/12 text-primary">
                          {expertProfileQuery.data.specialty}
                        </Badge>
                        <Badge variant="outline" className="border-secondary/20 text-secondary">
                          {expertProfileQuery.data.industry}
                        </Badge>
                        <Badge variant="outline" className="border-success/25 text-success-foreground">
                          {expertProfileQuery.data.upcomingMeetings} citas activas
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-primary/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                        Experiencia
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        {expertProfileQuery.data.experience}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-primary/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                        Disponibilidad
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground/80">
                        {expertProfileQuery.data.weeklyAvailability
                          .filter((item) => item.enabled)
                          .map(
                            (item) =>
                              `${item.day}: ${item.slots
                                .map((slot) => `${slot.startTime} - ${slot.endTime}`)
                                .join(' | ')}`,
                          )
                          .join(' | ') || 'Flexible'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Descripcion profesional</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {expertProfileQuery.data.biography || expertProfileQuery.data.description}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Empresas</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {expertProfileQuery.data.companies || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Educacion</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {expertProfileQuery.data.education || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Logros</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {expertProfileQuery.data.achievements || 'No especificado'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-secondary/10 bg-secondary/10 p-4">
                    <p className="text-sm font-medium text-foreground">Servicio ofrecido</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">
                      {expertProfileQuery.data.service || 'Servicio de consultoria y acompanamiento.'}
                    </p>
                  </div>

                  {isBuyer ? (
                    <div className="space-y-4 rounded-[24px] border border-primary/15 bg-white p-5">
                      <div>
                        <p className="text-xl font-medium text-foreground">Agendar cita</p>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                          Fecha, hora y descripcion del tema a tratar. Confirmacion automatica con Meet.
                        </p>
                        <div className="mt-3 rounded-2xl border border-secondary/15 bg-secondary/10 px-4 py-3 text-sm text-primary">
                          Las reuniones son grupales de hasta 3 personas por horario. Si deseas una sesion 1 a 1, esta disponible con membresia en la plataforma.
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground/80">Fecha</label>
                          <Input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                          />
                        </div>
                        <div className="rounded-2xl bg-primary/5 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                            Experto seleccionado
                          </p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {selectedExpert?.fullName || 'Selecciona un experto'}
                          </p>
                          <p className="text-sm text-muted-foreground/70">
                            {selectedExpert?.specialty || 'Sin especialidad'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground/80">Horarios disponibles</p>
                        {availabilityQuery.isLoading ? (
                          <p className="text-sm text-muted-foreground">Consultando disponibilidad...</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {availabilityQuery.data?.slots.map((slot) => (
                              <button
                                key={slot.startsAt}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => setSelectedSlot(slot.startsAt)}
                                className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                                  selectedSlot === slot.startsAt
                                    ? 'border-primary bg-primary text-white'
                                    : slot.available
                                      ? 'border-primary/15 bg-white text-foreground/80 hover:border-secondary/30'
                                      : 'cursor-not-allowed border-primary/15 bg-primary/10 text-muted-foreground/60'
                                }`}
                              >
                                {slot.label} · {slot.remainingSpots} cupos
                              </button>
                            ))}
                          </div>
                        )}
                        {availabilityQuery.data?.weekday ? (
                          <p className="mt-2 text-xs text-muted-foreground/70">
                            Disponibilidad consultada para {availabilityQuery.data.weekday}. Cada horario admite hasta 3 participantes.
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground/80">
                          Descripcion del tema a tratar
                        </label>
                        <Textarea
                          value={topic}
                          onChange={(event) => setTopic(event.target.value)}
                          rows={5}
                          placeholder="Describe el objetivo de la reunion, el contexto y las preguntas clave."
                        />
                      </div>

                      <Button
                        className="w-full bg-primary hover:bg-primary"
                        disabled={
                          !selectedExpertId ||
                          !selectedSlot ||
                          !topic.trim() ||
                          createAppointmentMutation.isPending
                        }
                        onClick={() =>
                          createAppointmentMutation.mutate({
                            expertId: selectedExpertId,
                            startsAt: selectedSlot,
                            topic: topic.trim(),
                          })
                        }
                      >
                        {createAppointmentMutation.isPending ? 'Confirmando cita...' : 'Confirmar cita'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona un experto para ver el detalle.</p>
              )}
            </CardContent>
          </Card>
        </div>
        ) : null}
      </section>

    </div>
  );
};

export default NexuExperts;

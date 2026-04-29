import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, BriefcaseBusiness, MapPin, Plus, Search, Users } from 'lucide-react';
import {
  applyToEmployabilityJob,
  createConversation,
  createEmployabilityJob,
  getEmployabilityFeed,
  sendConversationMessage,
  updateEmployabilityJob,
  upsertEmployabilityTalentProfile,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const Employability = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'jobs' | 'talent'>('jobs');
  const [search, setSearch] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);
  const [showTalentForm, setShowTalentForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [isEditingTalent, setIsEditingTalent] = useState(false);
  const jobFormRef = useRef<HTMLDivElement | null>(null);
  const talentFormRef = useRef<HTMLDivElement | null>(null);
  const jobsSectionRef = useRef<HTMLElement | null>(null);
  const talentSectionRef = useRef<HTMLElement | null>(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    skills: '',
    experience: '',
    location: '',
  });
  const [talentForm, setTalentForm] = useState({
    description: '',
    skills: '',
    experience: '',
    certifications: '',
    availability: '',
  });

  const feedQuery = useQuery({
    queryKey: ['employability-feed', search],
    queryFn: () => getEmployabilityFeed(search.trim() || undefined),
  });

  const createJobMutation = useMutation({
    mutationFn: createEmployabilityJob,
    onSuccess: () => {
      setJobForm({
        title: '',
        description: '',
        skills: '',
        experience: '',
        location: '',
      });
      setShowJobForm(false);
      queryClient.invalidateQueries({ queryKey: ['employability-feed'] });
      toast({
        title: 'Oferta publicada',
        description: 'La vacante ya aparece en la seccion de publicaciones laborales.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo publicar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: applyToEmployabilityJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employability-feed'] });
      toast({
        title: 'Postulacion enviada',
        description: 'Tu postulacion fue registrada correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo postular',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const talentMutation = useMutation({
    mutationFn: upsertEmployabilityTalentProfile,
    onSuccess: () => {
      setTalentForm({
        description: '',
        skills: '',
        experience: '',
        certifications: '',
        availability: '',
      });
      setIsEditingTalent(false);
      setShowTalentForm(false);
      queryClient.invalidateQueries({ queryKey: ['employability-feed'] });
      toast({
        title: isEditingTalent ? 'Perfil actualizado' : 'Perfil publicado',
        description: isEditingTalent
          ? 'Los cambios de tu perfil profesional ya se guardaron.'
          : 'Tu perfil ya se muestra en la seccion "Busco empleo".',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo publicar el perfil',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id || !user.role) {
        throw new Error('Debes iniciar sesion para contactar.');
      }

      const targetProfile = talentProfiles.find((profile) => profile.user.id === targetUserId);
      if (!targetProfile) {
        throw new Error('No se encontro el perfil seleccionado.');
      }

      if (targetProfile.user.id === user.id) {
        throw new Error('No puedes abrir una conversacion contigo mismo.');
      }

      const conversation = await createConversation({ toUserId: targetProfile.user.id });

      if (conversation.isNew) {
        await sendConversationMessage(conversation.id, {
          message: '',
          attachments: [
            {
              id: crypto.randomUUID(),
              kind: 'profile',
              name: targetProfile.user.fullName,
              profileId: targetProfile.id,
              label: targetProfile.headline,
              description: targetProfile.description,
            },
          ],
        });
      }

      return {
        conversation,
        targetProfile,
      };
    },
    onSuccess: ({ conversation, targetProfile }) => {
      const params = new URLSearchParams({
        conversationId: conversation.id,
        source: 'employability',
        targetName: targetProfile.user.fullName,
        targetHeadline: targetProfile.headline,
      });
      navigate(`/mensajes?${params.toString()}`);
    },
    onError: (error) => {
      toast({
        title: 'No se pudo contactar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ jobId, payload }: {
      jobId: string;
      payload: {
        title: string;
        description: string;
        skillsRequired: string[];
        experienceRequired: string;
        location?: string;
      };
    }) => updateEmployabilityJob(jobId, payload),
    onSuccess: () => {
      setJobForm({
        title: '',
        description: '',
        skills: '',
        experience: '',
        location: '',
      });
      setEditingJobId(null);
      setShowJobForm(false);
      queryClient.invalidateQueries({ queryKey: ['employability-feed'] });
      toast({
        title: 'Vacante actualizada',
        description: 'Los cambios de la publicacion laboral ya fueron guardados.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo actualizar',
        description: error instanceof Error ? error.message : 'Ocurrio un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  const jobs = feedQuery.data?.jobs ?? [];
  const talentProfiles = feedQuery.data?.talentProfiles ?? [];
  const canPublishJob = Boolean(user);
  const canContactProfile = (targetUserId: string) => {
    if (!user?.id) {
      return false;
    }

    return targetUserId !== user.id;
  };

  const handleCreateJob = () => {
    if (!jobForm.title || !jobForm.description || !jobForm.skills || !jobForm.experience) {
      toast({
        title: 'Completa la oferta',
        description: 'Ingresa titulo, descripcion, skills y experiencia requerida.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      title: jobForm.title,
      description: jobForm.description,
      skillsRequired: jobForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      experienceRequired: jobForm.experience,
      location: jobForm.location.trim() || undefined,
    };

    if (editingJobId) {
      updateJobMutation.mutate({
        jobId: editingJobId,
        payload,
      });
      return;
    }

    createJobMutation.mutate(payload);
  };

  const handleCreateTalentProfile = () => {
    if (!talentForm.description || !talentForm.skills || !talentForm.experience) {
      toast({
        title: 'Completa tu perfil',
        description: 'Agrega descripcion, skills y experiencia antes de publicar tu perfil.',
        variant: 'destructive',
      });
      return;
    }

    talentMutation.mutate({
      description: talentForm.description,
      skills: talentForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      experience: talentForm.experience,
      certifications: talentForm.certifications.split(',').map((item) => item.trim()).filter(Boolean),
      availability: talentForm.availability.trim() || undefined,
    });
  };

  const scrollToEditableCard = (section: 'jobs' | 'talent') => {
    window.setTimeout(() => {
      const targetRef = section === 'jobs' ? jobFormRef : talentFormRef;
      targetRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const scrollToSection = (section: 'jobs' | 'talent') => {
    window.setTimeout(() => {
      const targetRef = section === 'jobs' ? jobsSectionRef : talentSectionRef;
      targetRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const handleEditJob = (jobId: string) => {
    const job = jobs.find((item) => item.id === jobId && item.isOwner);
    if (!job) {
      return;
    }

    setActiveSection('jobs');
    setEditingJobId(job.id);
    setShowTalentForm(false);
    setJobForm({
      title: job.title,
      description: job.description,
      skills: job.skillsRequired.join(', '),
      experience: job.experienceRequired,
      location: job.location,
    });
    setShowJobForm(true);
    scrollToEditableCard('jobs');
  };

  const handleEditTalentProfile = () => {
    const profile = talentProfiles.find((item) => item.isOwner);
    if (!profile) {
      return;
    }

    setActiveSection('talent');
    setIsEditingTalent(true);
    setShowJobForm(false);
    setTalentForm({
      description: profile.description,
      skills: profile.skills.join(', '),
      experience: profile.experience,
      certifications: profile.certifications.join(', '),
      availability: profile.availability,
    });
    setShowTalentForm(true);
    scrollToEditableCard('talent');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(110deg,#1f20b7_0%,#3620b6_50%,#6235de_100%)] text-white shadow-[0_18px_44px_rgba(14,16,158,0.16)]">
        <div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-8 md:grid-cols-[1.3fr_0.95fr] md:px-10 md:py-9 lg:px-12">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              Modulo Empleabilidad
            </div>
            <h1 className="mt-5 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white md:text-[3.1rem] md:leading-[1.04]">
              Empleo, talento y crecimiento profesional en una sola vista.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/88">
              Publica vacantes, encuentra profesionales disponibles.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className={`rounded-2xl ${
                  activeSection === 'jobs'
                    ? 'border-white bg-white text-[#1f20b7] hover:bg-white/95'
                    : 'border-white/30 bg-white/10 text-white hover:bg-white/15'
                }`}
                onClick={() => {
                  setActiveSection('jobs');
                  setShowTalentForm(false);
                  setIsEditingTalent(false);
                  scrollToSection('jobs');
                }}
              >
                Publicaciones laborales
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`rounded-2xl ${
                  activeSection === 'talent'
                    ? 'border-white bg-white text-[#1f20b7] hover:bg-white/95'
                    : 'border-white/30 bg-white/10 text-white hover:bg-white/15'
                }`}
                onClick={() => {
                  setActiveSection('talent');
                  setShowJobForm(false);
                  setEditingJobId(null);
                  scrollToSection('talent');
                }}
              >
                Busco empleo
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <Card className="rounded-[26px] border-0 bg-[#6B49D8] text-white shadow-none">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/78">Vacantes activas</p>
                <p className="mt-3 text-4xl font-bold text-white">{feedQuery.data?.stats.jobs ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/78">Publicaciones listas para recibir postulaciones.</p>
              </CardContent>
            </Card>
            <Card className="rounded-[26px] border-0 bg-[#6B49D8] text-white shadow-none">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/78">Talento visible</p>
                <p className="mt-3 text-4xl font-bold text-white">{feedQuery.data?.stats.talentProfiles ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/78">Profesionales mostrando skills y experiencia.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Card className="rounded-[28px] border-secondary/15 bg-white shadow-sm">
        <CardContent className="p-5">
          {activeSection === 'jobs' ? (
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cargo, empresa o skill"
                className="h-11 rounded-2xl border-primary/15 bg-primary/5 pl-10"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Explora perfiles publicados y crea el tuyo dentro de esta sección.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[28px] border-secondary/15 bg-white shadow-sm">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-foreground">Mejora tus skills</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Accede a contenidos, recursos y materiales para fortalecer tus habilidades profesionales.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="w-full rounded-2xl bg-secondary/15 px-5 text-secondary hover:bg-secondary/20 sm:w-fit"
            onClick={() => navigate('/empleabilidad/mejorar-skill')}
          >
            Mejorar skill
          </Button>
        </CardContent>
      </Card>

      {showJobForm && canPublishJob && activeSection === 'jobs' && (
        <div ref={jobFormRef}>
        <Card className="rounded-[28px] border-primary/15 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{editingJobId ? 'Editar empleo' : 'Publicar empleo'}</CardTitle>
            <CardDescription>
              {editingJobId
                ? 'Actualiza tu vacante y manten la informacion al dia para nuevos candidatos.'
                : 'Crea una oferta laboral real y persistida en backend para atraer mejores postulaciones.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Titulo del puesto"
              value={jobForm.title}
              onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))}
              className="h-11 rounded-2xl"
            />
            <Input
              placeholder="Experiencia requerida"
              value={jobForm.experience}
              onChange={(event) => setJobForm((current) => ({ ...current, experience: event.target.value }))}
              className="h-11 rounded-2xl"
            />
            <div className="md:col-span-2">
              <Textarea
                placeholder="Describe el rol, objetivos y contexto de la vacante"
                value={jobForm.description}
                onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))}
                rows={5}
                className="rounded-2xl"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                placeholder="Skills requeridos separados por comas"
                value={jobForm.skills}
                onChange={(event) => setJobForm((current) => ({ ...current, skills: event.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                placeholder="Ubicacion o modalidad"
                value={jobForm.location}
                onChange={(event) => setJobForm((current) => ({ ...current, location: event.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleCreateJob}
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
                className="rounded-2xl px-5"
              >
                {createJobMutation.isPending || updateJobMutation.isPending
                  ? editingJobId
                    ? 'Guardando...'
                    : 'Publicando...'
                  : editingJobId
                    ? 'Guardar cambios'
                    : 'Publicar oferta'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowJobForm(false);
                  setEditingJobId(null);
                  setJobForm({
                    title: '',
                    description: '',
                    skills: '',
                    experience: '',
                    location: '',
                  });
                }}
                className="rounded-2xl"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {activeSection === 'jobs' && (
      <section id="publicaciones-laborales" ref={jobsSectionRef} className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">Vacantes</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Publicaciones laborales</h2>
            <p className="text-sm text-muted-foreground">
              Explora oportunidades abiertas y postula en un clic.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden rounded-full border-secondary/25 bg-secondary/10 px-3 py-1 text-secondary md:inline-flex">
              {jobs.length} resultados
            </Badge>
            {canPublishJob && (
              <Button
                type="button"
                className="rounded-2xl px-5"
                onClick={() => {
                  setEditingJobId(null);
                  setJobForm({
                    title: '',
                    description: '',
                    skills: '',
                    experience: '',
                    location: '',
                  });
                  setShowJobForm((current) => !current);
                  window.setTimeout(() => {
                    const nextVisible = !showJobForm;
                    if (nextVisible) {
                      scrollToEditableCard('jobs');
                    } else {
                      scrollToSection('jobs');
                    }
                  }, 0);
                }}
              >
                <Plus className="h-4 w-4" />
                Publicar empleo
              </Button>
            )}
          </div>
        </div>

        {feedQuery.isLoading && (
          <Card className="rounded-3xl border-dashed border-primary/25">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Cargando vacantes y talento disponible...
            </CardContent>
          </Card>
        )}

        {feedQuery.isError && (
          <Card className="rounded-3xl border-dashed border-destructive/20">
            <CardContent className="p-10 text-center text-sm text-destructive">
              No se pudo cargar el modulo de empleabilidad.
            </CardContent>
          </Card>
        )}

        {!feedQuery.isLoading && !feedQuery.isError && (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <Card key={job.id} className="rounded-[28px] border-primary/15 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-medium text-foreground">{job.title}</h3>
                          <Badge variant="outline" className="border-secondary/25 bg-secondary/10 text-secondary">
                            {job.applicants} postulaciones
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground/80">{job.company}</p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </div>
                      </div>

                      <p className="rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">{job.description}</p>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Requisitos (skills)</p>
                        <div className="flex flex-wrap gap-2">
                          {job.skillsRequired.map((skill) => (
                            <Badge key={skill} variant="secondary" className="bg-primary/10 text-foreground/80">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success-foreground">
                        <BriefcaseBusiness className="h-4 w-4" />
                        {job.experienceRequired}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-48">
                      {job.isOwner && (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => handleEditJob(job.id)}
                        >
                          Editar
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => applyMutation.mutate(job.id)}
                        disabled={job.hasApplied || applyMutation.isPending || job.author.id === user?.id}
                        className="rounded-2xl"
                      >
                        {job.author.id === user?.id
                          ? 'Tu publicacion'
                          : job.hasApplied
                            ? 'Ya postulaste'
                            : applyMutation.isPending
                              ? 'Postulando...'
                              : 'Postular'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {jobs.length === 0 && (
              <Card className="rounded-3xl border-dashed border-primary/25">
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  No encontramos vacantes con ese criterio de busqueda.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
      )}

      {activeSection === 'talent' && (
      <section id="busco-empleo" ref={talentSectionRef} className="space-y-5">
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">Talento</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Busco empleo</h2>
              <p className="text-sm text-muted-foreground">
                Profesionales mostrando experiencia, skills y certificaciones.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-secondary/25 bg-white px-5 text-primary hover:bg-secondary/10"
              onClick={() => {
                setIsEditingTalent(false);
                setTalentForm({
                  description: '',
                  skills: '',
                  experience: '',
                  certifications: '',
                  availability: '',
                });
                setShowTalentForm((current) => !current);
                window.setTimeout(() => {
                  const nextVisible = !showTalentForm;
                  if (nextVisible) {
                    scrollToEditableCard('talent');
                  } else {
                    scrollToSection('talent');
                  }
                }, 0);
              }}
            >
              <Users className="h-4 w-4" />
              Publicarme como talento
            </Button>
          </div>

          {showTalentForm && (
            <div ref={talentFormRef}>
            <Card className="rounded-[28px] border-primary/15 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">
                  {isEditingTalent ? 'Editar perfil profesional' : 'Publicarme como profesional'}
                </CardTitle>
                <CardDescription>
                  {isEditingTalent
                    ? 'Ajusta tu propuesta de valor y manten visible tu perfil profesional.'
                    : 'Comparte tu propuesta de valor y guardala de forma persistente en el backend.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Textarea
                  placeholder="Descripcion personal"
                  value={talentForm.description}
                  onChange={(event) => setTalentForm((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                  className="rounded-2xl"
                />
                <Input
                  placeholder="Skills separados por comas"
                  value={talentForm.skills}
                  onChange={(event) => setTalentForm((current) => ({ ...current, skills: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
                <Input
                  placeholder="Experiencia"
                  value={talentForm.experience}
                  onChange={(event) => setTalentForm((current) => ({ ...current, experience: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
                <Input
                  placeholder="Certificaciones separadas por comas"
                  value={talentForm.certifications}
                  onChange={(event) => setTalentForm((current) => ({ ...current, certifications: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
                <Input
                  placeholder="Disponibilidad"
                  value={talentForm.availability}
                  onChange={(event) => setTalentForm((current) => ({ ...current, availability: event.target.value }))}
                  className="h-11 rounded-2xl"
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleCreateTalentProfile} disabled={talentMutation.isPending} className="rounded-2xl px-5">
                    {talentMutation.isPending
                      ? isEditingTalent
                        ? 'Guardando...'
                        : 'Publicando...'
                      : isEditingTalent
                        ? 'Guardar cambios'
                        : 'Publicar perfil'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowTalentForm(false);
                      setIsEditingTalent(false);
                      setTalentForm({
                        description: '',
                        skills: '',
                        experience: '',
                        certifications: '',
                        availability: '',
                      });
                    }}
                    className="rounded-2xl"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {talentProfiles.map((profile) => (
              <Card key={profile.id} className="rounded-[28px] border-primary/15 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5">
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-medium text-foreground">{profile.user.fullName}</h3>
                          <Badge variant="outline" className="border-success/25 bg-success/15 text-success-foreground">
                            {profile.availability}
                          </Badge>
                          {profile.isOwner && (
                            <Badge variant="secondary" className="bg-secondary/15 text-secondary">
                              Tu perfil
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground/80">{profile.headline}</p>
                        <p className="text-xs text-muted-foreground/70">
                          {profile.user.position}
                          {profile.user.company ? ` · ${profile.user.company}` : ''}
                        </p>
                      </div>

                      <p className="rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">{profile.description}</p>

                      <div>
                        <p className="text-sm font-medium text-foreground">Skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {profile.skills.map((skill) => (
                            <Badge key={skill} variant="secondary" className="bg-primary/10 text-foreground/80">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-primary/5 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Experiencia</p>
                          <p className="mt-2 text-sm text-foreground/80">{profile.experience}</p>
                        </div>
                        <div className="rounded-2xl bg-primary/5 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Certificaciones</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {profile.certifications.length > 0 ? (
                              profile.certifications.map((certification) => (
                                <Badge key={certification} variant="outline">
                                  {certification}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">Sin certificaciones registradas</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      {profile.isOwner && (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={handleEditTalentProfile}
                        >
                          Editar
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => contactMutation.mutate(profile.user.id)}
                        disabled={
                          contactMutation.isPending ||
                          !canContactProfile(profile.user.id)
                        }
                      >
                        {profile.user.id === user?.id
                          ? 'Tu perfil'
                          : !canContactProfile(profile.user.id)
                            ? 'No disponible'
                            : contactMutation.isPending
                              ? 'Abriendo...'
                              : 'Contactar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!feedQuery.isLoading && !feedQuery.isError && talentProfiles.length === 0 && (
              <Card className="rounded-3xl border-dashed border-primary/25">
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Aun no hay perfiles profesionales publicados.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

export default Employability;

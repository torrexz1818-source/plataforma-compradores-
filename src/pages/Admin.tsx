import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Upload,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import {
  adminCreatePost,
  adminDeleteComment,
  adminDeletePost,
  getAdminMemberships,
  getAdminDashboard,
  getPlatformStats,
  uploadFile,
  uploadAdminVideoInChunks,
  updateMembershipByAdmin,
  updateUserStatus,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_LEARNING_ROUTE_ID,
  LEARNING_ROUTES,
  LearningRouteId,
  normalizeLearningRouteId,
} from '@/lib/learningRoutes';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PostResource, UserStatus } from '@/types';

const SKILL_CATEGORY_SLUG = 'mejorar-skill';
const MAX_ADMIN_VIDEO_DURATION_SECONDS = 15 * 60;
const MAX_ADMIN_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${Math.ceil(bytes / (1024 * 1024))} MB`;
};

const getVideoDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la duracion del video.'));
    };
    video.src = objectUrl;
  });

const sectorColors = [
  'bg-primary',
  'bg-secondary',
  'bg-primary/80',
  'bg-success',
  'bg-secondary/80',
  'bg-primary/70',
  'bg-success/90',
  'bg-secondary/70',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getAvatarClass(role: string) {
  if (role === 'supplier') return 'bg-success text-success-foreground';
  return 'bg-destructive text-white';
}

const Admin = () => {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    mediaType: 'video' as 'video' | 'image',
    categoryId: 'cat-7',
    learningRoute: DEFAULT_LEARNING_ROUTE_ID as LearningRouteId | '',
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [resourceDraft, setResourceDraft] = useState({
    type: 'link' as PostResource['type'],
    name: '',
    url: '',
  });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resources, setResources] = useState<PostResource[]>([]);
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [resourceUploadError, setResourceUploadError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [isPublishingContent, setIsPublishingContent] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: user?.role === 'admin',
  });
  const platformStatsQuery = useQuery({
    queryKey: ['admin-platform-stats'],
    queryFn: getPlatformStats,
    enabled: user?.role === 'admin',
  });

  const membershipsQuery = useQuery({
    queryKey: ['admin-memberships'],
    queryFn: getAdminMemberships,
    enabled: user?.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: adminCreatePost,
    onSuccess: () => {
      setForm({
        title: '',
        description: '',
        mediaType: 'video',
        categoryId: 'cat-7',
        learningRoute: DEFAULT_LEARNING_ROUTE_ID,
      });
      setThumbnailFile(null);
      setVideoFile(null);
      setThumbnailPreview('');
      setVideoPreview('');
      setResourceDraft({
        type: 'link',
        name: '',
        url: '',
      });
      setResourceFile(null);
      setResources([]);
      setVideoUploadProgress(0);
      setPublishError('');
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['educational-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['employability-skill-posts'] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: adminDeletePost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: adminDeleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      updateUserStatus(userId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const membershipMutation = useMutation({
    mutationFn: ({
      userId,
      status,
      adminApproved,
    }: {
      userId: string;
      status: 'pending' | 'active' | 'expired' | 'suspended';
      adminApproved: boolean;
    }) =>
      updateMembershipByAdmin(userId, { status, adminApproved }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-memberships'] });
    },
  });

  const summaryCards = useMemo(
    () =>
      data
        ? [
            {
              label: 'Total usuarios',
              value: platformStatsQuery.data?.totalUsers ?? data.overview.totalUsers,
              description: 'Usuarios registrados en la plataforma',
              icon: Users,
              iconClassName: 'bg-primary/10 text-primary',
              dividerClassName: 'bg-primary',
            },
            {
              label: 'Compradores',
              value: platformStatsQuery.data?.buyers ?? data.users.filter((item) => item.role === 'buyer').length,
              description: 'Empresas compradoras activas',
              icon: UserRound,
              iconClassName: 'bg-destructive/10 text-destructive',
              dividerClassName: 'bg-destructive',
            },
            {
              label: 'Proveedores',
              value: platformStatsQuery.data?.suppliers ?? data.users.filter((item) => item.role === 'supplier').length,
              description: 'Proveedores registrados',
              icon: Building2,
              iconClassName: 'bg-success/20 text-success-foreground',
              dividerClassName: 'bg-success',
            },
          ]
        : [],
    [data, platformStatsQuery.data?.buyers, platformStatsQuery.data?.suppliers, platformStatsQuery.data?.totalUsers],
  );
  const membershipsByUserId = useMemo(
    () => new Map((membershipsQuery.data ?? []).map((membership) => [membership.userId, membership])),
    [membershipsQuery.data],
  );
  const sectorBreakdown = platformStatsQuery.data?.sectorBreakdown ?? [];
  const latestUsers = (platformStatsQuery.data?.latestUsers ?? []).slice(0, 8);
  const totalSectorUsers = sectorBreakdown.reduce((acc, item) => acc + item.count, 0);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const selectedUser = (data?.users ?? []).find((item) => item.id === selectedUserId) ?? null;
  const buyerUsers = useMemo(
    () => (data?.users ?? []).filter((item) => item.role === 'buyer' && item.status === 'active'),
    [data?.users],
  );
  const supplierUsers = useMemo(
    () => (data?.users ?? []).filter((item) => item.role === 'supplier' && item.status === 'active'),
    [data?.users],
  );
  const postsById = useMemo(
    () => new Map((data?.posts ?? []).map((post) => [post.id, post])),
    [data?.posts],
  );
  const commentsBySelectedCategory = useMemo(() => {
    if (!data?.comments) {
      return [];
    }

    if (!selectedCategoryId) {
      return data.comments;
    }

    return data.comments.filter((comment) => postsById.get(comment.postId)?.category.id === selectedCategoryId);
  }, [data?.comments, postsById, selectedCategoryId]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const educationalCategory = categories.find((category) => category.slug === 'contenido-educativo') ?? null;
  const skillCategory = categories.find((category) => category.slug === SKILL_CATEGORY_SLUG) ?? null;
  const isSkillDestination = form.categoryId === skillCategory?.id || (!skillCategory && form.categoryId === 'cat-8');
  const isEducationalDestination =
    form.categoryId === educationalCategory?.id || (!educationalCategory && form.categoryId === 'cat-7');
  const requiresLearningRoute = isEducationalDestination;
  const categoryCommentCounts = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      commentsCount: (data?.comments ?? []).filter(
        (comment) => postsById.get(comment.postId)?.category.id === category.id,
      ).length,
    }));
  }, [categories, data?.comments, postsById]);

  useEffect(() => {
    if (!categories.length) return;

    setForm((current) => {
      if (current.categoryId && categories.some((category) => category.id === current.categoryId)) {
        return current;
      }

      return {
        ...current,
        categoryId: educationalCategory?.id ?? categories[0].id,
      };
    });
  }, [categories, educationalCategory]);

  const showLegacyUsersSection = false;

  if (!isAuthLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthLoading && user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6 sm:py-10">
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de administracion</h1>
          <p className="text-muted-foreground">
            Solo el administrador superior de la plataforma puede acceder a esta seccion.
          </p>
        </div>
      </MainLayout>
    );
  }

  const openCategoryComments = (categoryId: string) => {
    setSelectedCategoryId(categoryId);

    window.requestAnimationFrame(() => {
      document.getElementById('admin-category-comments')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const formatChoice = (value?: string) => {
    if (!value) return 'No registrado';

    const choiceMap: Record<string, string> = {
      yes: 'Si',
      no: 'No',
      in_progress: 'En proceso',
      evaluating: 'Evaluando',
      provider: 'Solo proveedor',
      distributor: 'Distribuidor',
      manufacturer: 'Fabricante',
    };

    return choiceMap[value] ?? value;
  };

  const renderDetailRow = (label: string, value?: string | string[]) => {
    const content = Array.isArray(value)
      ? value.length
        ? value.join(', ')
        : 'No registrado'
      : value?.trim() || 'No registrado';

    return (
      <p>
        <span className="font-medium text-foreground">{label}:</span> {content}
      </p>
    );
  };

  const renderManagedUsers = (users: typeof buyerUsers, roleLabel: string) => (
    <section className="bg-card rounded-lg border border-border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">{roleLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {roleLabel === 'Compradores'
              ? 'Datos completos del registro de compradores.'
              : 'Datos completos del registro de proveedores.'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {users.length} usuarios
        </Badge>
      </div>
      <div className="space-y-3">
        {users.map((managedUser) => {
          const isSelected = selectedUser?.id === managedUser.id;
          const membership = membershipsByUserId.get(managedUser.id);
          const isAuthorized = membership?.status === 'active' && membership.adminApproved;
          const digitalLinks = [
            managedUser.digitalPresence?.linkedin,
            managedUser.digitalPresence?.website,
            managedUser.digitalPresence?.whatsapp,
            managedUser.digitalPresence?.instagram,
          ].filter(Boolean) as string[];

          return (
            <div key={managedUser.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUserId((current) => (current === managedUser.id ? null : managedUser.id))
                    }
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {managedUser.fullName}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {managedUser.company} - {managedUser.role} - {managedUser.status}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Membresia: {membership ? `${membership.status}${membership.adminApproved ? ' (autorizada)' : ''}` : 'No activa'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant={managedUser.status === 'active' ? 'outline' : 'default'}
                    size="sm"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      void statusMutation.mutateAsync({
                        userId: managedUser.id,
                        status: managedUser.status === 'active' ? 'disabled' : 'active',
                      })
                    }
                  >
                    {managedUser.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={membershipMutation.isPending}
                    onClick={() =>
                      void membershipMutation.mutateAsync({
                        userId: managedUser.id,
                        status: isAuthorized ? 'suspended' : 'active',
                        adminApproved: !isAuthorized,
                      })
                    }
                  >
                    {isAuthorized ? 'Suspender membresia' : 'Autorizar membresia'}
                  </Button>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground grid sm:grid-cols-2 gap-2">
                  {renderDetailRow('Email', managedUser.email)}
                  {renderDetailRow('Razon social', managedUser.company)}
                  {renderDetailRow('Nombre comercial', managedUser.commercialName)}
                  {renderDetailRow('Cargo', managedUser.position)}
                  {renderDetailRow('Telefono', managedUser.phone)}
                  {renderDetailRow('RUC', managedUser.ruc)}
                  {renderDetailRow('Sector', managedUser.sector ?? 'General')}
                  {renderDetailRow('Numero de empleados', managedUser.employeeCount)}
                  {renderDetailRow('Ubicacion', managedUser.location)}
                  {renderDetailRow('Puntos', String(managedUser.points))}
                  {renderDetailRow('LinkedIn', managedUser.digitalPresence?.linkedin)}
                  {renderDetailRow('Pagina web', managedUser.digitalPresence?.website)}
                  {renderDetailRow('WhatsApp', managedUser.digitalPresence?.whatsapp)}
                  {renderDetailRow('Instagram', managedUser.digitalPresence?.instagram)}

                  {managedUser.role === 'buyer' && (
                    <>
                      {renderDetailRow('Categoria de interes', managedUser.buyerProfile?.interestCategories)}
                      {renderDetailRow('Volumen de compra', managedUser.buyerProfile?.purchaseVolume)}
                      {renderDetailRow('Tu empresa esta digitalizada?', formatChoice(managedUser.buyerProfile?.isCompanyDigitalized))}
                      {renderDetailRow('Usan IA generativa?', formatChoice(managedUser.buyerProfile?.usesGenerativeAI))}
                      {renderDetailRow('Presencia digital', digitalLinks)}
                    </>
                  )}

                  {managedUser.role === 'supplier' && (
                    <>
                      {renderDetailRow('Tipo de proveedor', formatChoice(managedUser.supplierProfile?.supplierType))}
                      {renderDetailRow('Paginas digitales', digitalLinks)}
                      {renderDetailRow('Productos o servicios', managedUser.supplierProfile?.productsOrServices)}
                      {renderDetailRow('Tiene catalogo digital', formatChoice(managedUser.supplierProfile?.hasDigitalCatalog))}
                      {renderDetailRow('Tu empresa esta digitalizada?', formatChoice(managedUser.supplierProfile?.isCompanyDigitalized))}
                      {renderDetailRow('Usan IA generativa?', formatChoice(managedUser.supplierProfile?.usesGenerativeAI))}
                      {renderDetailRow('Descripcion', managedUser.description)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!users.length && <p className="text-sm text-muted-foreground">No hay usuarios en esta categoria.</p>}
      </div>
    </section>
  );

  const handleMainMediaChange = async (file: File | null, mediaType: 'video' | 'image') => {
    setPublishError('');
    setPublishSuccess(false);

    if (mediaType === 'video') {
      if (!file) {
        setVideoFile(null);
        setVideoPreview('');
        return;
      }

      if (file.type && file.type !== 'video/mp4') {
        setVideoFile(null);
        setVideoPreview('');
        setPublishError('Selecciona un video en formato MP4.');
        return;
      }

      if (file.size > MAX_ADMIN_VIDEO_SIZE_BYTES) {
        setVideoFile(null);
        setVideoPreview('');
        setPublishError(`El video supera el maximo permitido de ${formatFileSize(MAX_ADMIN_VIDEO_SIZE_BYTES)}.`);
        return;
      }

      try {
        const duration = await getVideoDuration(file);

        if (duration > MAX_ADMIN_VIDEO_DURATION_SECONDS + 1) {
          setVideoFile(null);
          setVideoPreview('');
          setPublishError('El video no debe superar los 15 minutos.');
          return;
        }
      } catch (error) {
        setVideoFile(null);
        setVideoPreview('');
        setPublishError(error instanceof Error ? error.message : 'No se pudo validar el video seleccionado.');
        return;
      }

      setVideoFile(file);
      setVideoPreview(file ? URL.createObjectURL(file) : '');
      return;
    }

    setThumbnailFile(file);
    setThumbnailPreview(file ? URL.createObjectURL(file) : '');
  };

  const addResource = async () => {
    const name = resourceDraft.name.trim();
    let url = '';

    setResourceUploadError('');

    if (resourceDraft.type === 'link') {
      url = resourceDraft.url.trim();
    } else {
      if (!resourceFile) {
        setResourceUploadError('Selecciona un archivo local para adjuntarlo como recurso.');
        return;
      }

      setIsUploadingResource(true);

      try {
        const uploadedFile = await uploadFile(resourceFile, 'resources');
        url = uploadedFile.url;
      } catch (error) {
        setResourceUploadError(
          error instanceof Error ? error.message : 'No se pudo subir el recurso seleccionado.',
        );
        return;
      } finally {
        setIsUploadingResource(false);
      }
    }

    if (!name || !url) {
      return;
    }

    setResources((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: resourceDraft.type,
        name,
        url,
      },
    ]);
    setResourceDraft({
      type: 'link',
      name: '',
      url: '',
    });
    setResourceFile(null);
  };

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-5 space-y-8 overflow-x-hidden sm:px-6 sm:py-8 2xl:max-w-[1440px]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Panel administrativo</h1>
          <p className="mt-1 text-muted-foreground">Resumen general de la plataforma</p>
        </motion.div>

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.label} className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
                <CardContent className="flex min-w-0 items-center gap-4 p-5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconClassName}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className={`h-16 w-1 rounded-full ${card.dividerClassName}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-3xl font-bold leading-none text-foreground">{card.value}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="min-w-0 rounded-xl border-0 bg-white/90 shadow-[var(--shadow-card)]">
            <CardContent className="flex min-w-0 items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Posts</p>
                <p className="text-2xl font-bold leading-none text-foreground">{data?.overview.totalPosts ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-xl border-0 bg-white/90 shadow-[var(--shadow-card)]">
            <CardContent className="flex min-w-0 items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <Video className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Videos</p>
                <p className="text-2xl font-bold leading-none text-foreground">{data?.overview.educationalPosts ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-xl border-0 bg-white/90 shadow-[var(--shadow-card)]">
            <CardContent className="flex min-w-0 items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Comentarios</p>
                <p className="text-2xl font-bold leading-none text-foreground">{data?.overview.totalComments ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Usuarios por sector</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {platformStatsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando sectores...</p>
              )}
              {sectorBreakdown.map((item, index) => {
                const rawPercent = totalSectorUsers > 0 ? (item.count / totalSectorUsers) * 100 : 0;
                const widthPercent = rawPercent > 0 ? Math.max(rawPercent, 4) : 0;
                const roundedPercent = Math.round(rawPercent);

                return (
                  <div key={item.sector} className="grid min-w-0 grid-cols-[minmax(72px,0.85fr)_minmax(88px,1fr)_56px] items-center gap-2 sm:grid-cols-[120px_1fr_70px] sm:gap-3">
                    <span className="truncate text-sm text-foreground">{item.sector}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className={`h-full rounded-full ${sectorColors[index % sectorColors.length]}`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <span className="text-right text-sm text-muted-foreground">
                      {item.count} ({roundedPercent}%)
                    </span>
                  </div>
                );
              })}
              {!platformStatsQuery.isLoading && sectorBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay sectores registrados.</p>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ultimos registros</CardTitle>
            </CardHeader>
            <CardContent>
              {platformStatsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
              )}
              <div className="w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain pb-1 touch-pan-x [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[620px] w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-foreground">
                      <th className="w-[34%] py-2 pr-3 font-semibold">Nombre</th>
                      <th className="w-[28%] py-2 pr-3 font-semibold">Empresa</th>
                      <th className="w-[20%] py-2 pr-3 font-semibold">Sector</th>
                      <th className="w-[18%] py-2 pr-0 font-semibold">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestUsers.map((item) => (
                      <tr key={item.id} className="border-b border-border/60">
                        <td className="py-3 pr-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getAvatarClass(item.role)}`}
                            >
                              {getInitials(item.name)}
                            </span>
                            <span className="min-w-0 break-words leading-tight">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 align-middle break-words leading-tight">{item.company}</td>
                        <td className="py-3 pr-3 align-middle break-words leading-tight">{item.sector || 'General'}</td>
                        <td className="py-3 pr-0 align-middle">
                          <Badge className={getRoleBadgeClass(item.role)}>
                            {getRoleLabel(item.role)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!platformStatsQuery.isLoading && latestUsers.length === 0 && (
                  <p className="py-6 text-sm text-muted-foreground">No hay registros recientes.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
          <div className="min-w-0 overflow-hidden bg-card rounded-lg border border-border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-medium text-foreground">Crear contenido</h2>
              <p className="text-sm text-muted-foreground">
                Publica material educativo o recursos para mejorar skills con vista previa antes de subirlo.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Titulo</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ej. Masterclass de compras"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Formato principal</label>
                <select
                  value={form.mediaType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, mediaType: event.target.value as 'video' | 'image' }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="video">Video educativo</option>
                  <option value="image">Articulo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Destino</label>
                <select
                  value={isSkillDestination ? 'skill' : 'educational'}
                  onChange={(event) => {
                    const nextIsSkill = event.target.value === 'skill' && skillCategory;
                    setForm((current) => ({
                      ...current,
                      categoryId:
                        nextIsSkill
                          ? skillCategory.id
                          : educationalCategory?.id ?? categories[0]?.id ?? current.categoryId,
                      learningRoute: nextIsSkill
                        ? ''
                        : current.learningRoute || DEFAULT_LEARNING_ROUTE_ID,
                    }));
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="educational">Contenido Educativo</option>
                  <option value="skill" disabled={!skillCategory}>
                    Empleabilidad / Mejorar skill
                  </option>
                </select>
                {!skillCategory && (
                  <p className="text-xs text-muted-foreground">
                    La categoria Mejorar skill estara disponible al sincronizar las categorias del backend.
                  </p>
                )}
              </div>
              {requiresLearningRoute ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Ruta tematica</label>
                  <select
                    value={form.learningRoute || DEFAULT_LEARNING_ROUTE_ID}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        learningRoute: normalizeLearningRouteId(event.target.value) ?? DEFAULT_LEARNING_ROUTE_ID,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LEARNING_ROUTES.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.label} - {route.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Este destino no necesita ruta tematica; se publicara solo en Empleabilidad / Mejorar skill.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Descripcion</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe de que trata el contenido, para quien es y que aprendera el usuario."
                className="min-h-[140px]"
              />
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 sm:p-5 space-y-4 text-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {form.mediaType === 'video' ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <h3 className="text-[15px] font-medium">
                      {form.mediaType === 'video' ? 'Video y vista previa' : 'Articulo y vista previa'}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.mediaType === 'video'
                      ? `MP4 hasta 15 minutos y ${formatFileSize(MAX_ADMIN_VIDEO_SIZE_BYTES)}`
                      : 'PNG, JPG, WEBP, PDF y otros archivos'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.mediaType === 'video' && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                      <ImageIcon className="h-4 w-4" />
                      Imagen de portada
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleMainMediaChange(event.target.files?.[0] ?? null, 'image')}
                        className="hidden"
                      />
                    </label>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {form.mediaType === 'video' ? (videoFile ? 'Cambiar video' : 'Seleccionar video') : (thumbnailFile ? 'Cambiar articulo' : 'Seleccionar articulo')}
                    <input
                      type="file"
                      accept={form.mediaType === 'video' ? 'video/mp4,.mp4' : 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
                      onChange={(event) => void handleMainMediaChange(event.target.files?.[0] ?? null, form.mediaType)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex h-[260px] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background sm:h-[320px] lg:h-[360px]">
                {form.mediaType === 'video' && videoPreview ? (
                  <video
                    src={videoPreview}
                    controls
                    poster={thumbnailPreview || undefined}
                    className="h-full w-full max-w-full object-contain bg-background"
                  />
                ) : null}
                {form.mediaType === 'image' && thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Vista previa"
                    className="h-full w-full max-w-full object-contain bg-background"
                  />
                ) : null}
                {((form.mediaType === 'video' && !videoPreview) || (form.mediaType === 'image' && !thumbnailPreview)) && (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-muted-foreground">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {form.mediaType === 'video' ? <Video className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
                    </div>
                    <p className="text-sm">
                      La vista previa aparecera aqui antes de publicar.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">
                  {form.mediaType === 'video' ? <Video className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  <span className="truncate">
                    {form.mediaType === 'video'
                      ? videoFile
                        ? `${videoFile.name} (${formatFileSize(videoFile.size)})`
                        : 'Aun no seleccionaste un video.'
                      : thumbnailFile?.name || 'Aun no seleccionaste un articulo.'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este contenido se publicara en {isSkillDestination ? 'Empleabilidad / Mejorar skill' : 'Contenido Educativo'}.
                </p>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Recursos complementarios</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedes agregar imagenes, archivos o links URL para descargar o consultar despues.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {resources.length} recursos
                </Badge>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background/80 p-3 space-y-3">
                <div className="grid min-w-0 gap-3 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <select
                    value={resourceDraft.type}
                    onChange={(event) => {
                      setResourceUploadError('');
                      setResourceFile(null);
                      setResourceDraft((current) => ({
                        ...current,
                        type: event.target.value as PostResource['type'],
                        url: '',
                      }));
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="link">Link URL</option>
                    <option value="image">Imagen</option>
                    <option value="file">Archivo</option>
                  </select>
                  <Input
                    value={resourceDraft.name}
                    onChange={(event) => setResourceDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nombre del recurso"
                  />
                  {resourceDraft.type === 'link' ? (
                    <Input
                      value={resourceDraft.url}
                      onChange={(event) => setResourceDraft((current) => ({ ...current, url: event.target.value }))}
                      placeholder="https://... o enlace del archivo"
                    />
                  ) : (
                    <Input
                      type="file"
                      accept={resourceDraft.type === 'image' ? 'image/*' : '*'}
                      onChange={(event) => {
                        setResourceUploadError('');
                        setResourceFile(event.target.files?.[0] ?? null);
                      }}
                      className="h-10"
                    />
                  )}
                  <Button type="button" variant="outline" className="shrink-0" onClick={() => void addResource()} disabled={isUploadingResource}>
                    {isUploadingResource ? 'Subiendo...' : 'Agregar'}
                  </Button>
                </div>
                {resourceDraft.type !== 'link' && (
                  <p className="truncate text-xs text-muted-foreground">
                    {resourceFile ? `Archivo listo: ${resourceFile.name}` : 'Selecciona un archivo local para adjuntarlo como recurso.'}
                  </p>
                )}
                {resourceUploadError && (
                  <p className="text-xs text-destructive">{resourceUploadError}</p>
                )}
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background p-2">
                <div className="max-h-52 overflow-y-auto pr-1 space-y-2">
                  {resources.map((resource) => (
                    <div key={resource.id} className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                          {resource.type === 'link' ? <Link2 className="h-4 w-4 text-primary" /> : null}
                          {resource.type === 'image' ? <ImageIcon className="h-4 w-4 text-primary" /> : null}
                          {resource.type === 'file' ? <FileText className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="text-sm font-medium text-foreground truncate">{resource.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {resource.type === 'link' ? resource.url : resource.type === 'image' ? 'Imagen adjunta' : 'Archivo adjunto'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setResources((current) => current.filter((item) => item.id !== resource.id))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {!resources.length && (
                    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                      Todavia no agregaste recursos complementarios.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(publishError || createMutation.error) && (
              <p className="text-sm text-destructive">
                {publishError ||
                (createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'No se pudo crear el contenido')}
              </p>
            )}

            {publishSuccess && (
              <p className="rounded-xl border border-success/40 bg-success/20 px-3 py-2 text-sm font-medium text-success-foreground">
                Contenido publicado correctamente.
              </p>
            )}

            {form.mediaType === 'video' && videoUploadProgress > 0 && isPublishingContent && (
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-primary">
                  <span>
                    {videoUploadProgress >= 100 ? 'Procesando video...' : 'Subiendo video...'}
                  </span>
                  <span>{videoUploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-300"
                    style={{ width: `${videoUploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              disabled={
                isPublishingContent ||
                createMutation.isPending ||
                isUploadingResource ||
                !form.title.trim() ||
                !form.description.trim() ||
                !form.categoryId ||
                (requiresLearningRoute && !form.learningRoute) ||
                (form.mediaType === 'video' ? !videoFile : !thumbnailFile)
              }
              onClick={async () => {
                setIsPublishingContent(true);
                setPublishError('');
                setPublishSuccess(false);
                try {
                  if (form.mediaType === 'video' && videoFile) {
                    setVideoUploadProgress(1);
                    const uploadedVideoUrl = await uploadAdminVideoInChunks(videoFile, setVideoUploadProgress);
                    const formData = new FormData();

                    formData.set('title', form.title);
                    formData.set('description', form.description);
                    formData.set('categoryId', form.categoryId);
                    formData.set('type', 'educational');
                    if (requiresLearningRoute && form.learningRoute) {
                      formData.set('learningRoute', form.learningRoute);
                    }
                    formData.set('mediaType', form.mediaType);
                    formData.set('videoUrl', uploadedVideoUrl);
                    formData.set('resources', JSON.stringify(resources));

                    if (thumbnailFile) {
                      formData.append('thumbnail', thumbnailFile);
                    }

                    await createMutation.mutateAsync(formData);
                    setPublishSuccess(true);
                    return;
                  }

                  const formData = new FormData();
                  formData.set('title', form.title);
                  formData.set('description', form.description);
                  formData.set('categoryId', form.categoryId);
                  formData.set('type', 'educational');
                  if (requiresLearningRoute && form.learningRoute) {
                    formData.set('learningRoute', form.learningRoute);
                  }
                  formData.set('mediaType', form.mediaType);
                  formData.set('resources', JSON.stringify(resources));

                  if (form.mediaType === 'image' && thumbnailFile) {
                    formData.append('mainMedia', thumbnailFile);
                  }

                  await createMutation.mutateAsync(formData);
                  setPublishSuccess(true);
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'No se pudo publicar el contenido.';
                  setPublishError(
                    message.toLowerCase().includes('file too large')
                      ? 'El video es demasiado grande para el limite actual de subida. Intenta nuevamente cuando el backend desplegado tenga el ajuste de chunks.'
                      : message,
                  );
                } finally {
                  setIsPublishingContent(false);
                  setVideoUploadProgress(0);
                }
              }}
            >
              {isPublishingContent || createMutation.isPending
                ? form.mediaType === 'video' && videoUploadProgress > 0
                  ? videoUploadProgress >= 100
                    ? 'Procesando video...'
                    : `Subiendo video... ${videoUploadProgress}%`
                  : 'Publicando...'
                : isSkillDestination
                  ? 'Publicar en Mejorar skill'
                  : 'Publicar contenido educativo'}
            </Button>
          </div>

          <div className="min-w-0 overflow-hidden bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-medium text-foreground mb-3">Categorias activas</h2>
            <div className="space-y-2">
              {categoryCommentCounts.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => openCategoryComments(category.id)}
                  className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                    selectedCategoryId === category.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/40 hover:bg-muted/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.slug}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{category.commentsCount} comentarios</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Haz clic en una categoria para ver todos sus comentarios.
            </p>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-medium text-foreground mb-4">Publicaciones de proveedores</h2>
            {isLoading && <p className="text-sm text-muted-foreground">Cargando contenido...</p>}
            {isError && <p className="text-sm text-destructive">No se pudo cargar el panel.</p>}
            <div className="space-y-3">
              {(data?.posts ?? []).map((post) => (
                <div key={post.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.type === 'educational'
                          ? 'Video educativo'
                          : post.type === 'liquidation'
                            ? 'Liquidacion'
                            : 'Post comunitario'} -{' '}
                        {post.author.fullName}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletePostMutation.isPending}
                      onClick={() => void deletePostMutation.mutateAsync(post.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="admin-category-comments" className="bg-card rounded-lg border border-border p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  {selectedCategory ? `Comentarios en ${selectedCategory.name}` : 'Comunidad'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory
                    ? `Mostrando todos los comentarios asociados a ${selectedCategory.name.toLowerCase()}.`
                    : 'Mostrando todos los comentarios de la comunidad.'}
                </p>
              </div>
              {selectedCategoryId && (
                <Button variant="outline" size="sm" onClick={() => setSelectedCategoryId(null)}>
                  Ver todos
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {commentsBySelectedCategory.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{comment.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        En {comment.postTitle} - {postsById.get(comment.postId)?.category.name ?? 'Sin categoria'} -{' '}
                        {comment.repliesCount} respuestas
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteCommentMutation.isPending}
                      onClick={() => void deleteCommentMutation.mutateAsync(comment.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{comment.content}</p>
                </div>
              ))}
              {!commentsBySelectedCategory.length && (
                <p className="text-sm text-muted-foreground">
                  No hay comentarios en esta categoria todavia.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          {renderManagedUsers(buyerUsers, 'Compradores')}
          {renderManagedUsers(supplierUsers, 'Proveedores')}
        </section>

        {showLegacyUsersSection && <section className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-lg font-medium text-foreground mb-4">Usuarios</h2>
          <div className="space-y-3">
            {(data?.users ?? []).map((managedUser) => (
              <div key={managedUser.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedUserId((current) => (current === managedUser.id ? null : managedUser.id))
                      }
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {managedUser.fullName}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {managedUser.company} - {managedUser.role} - {managedUser.status}
                    </p>
                    {managedUser.role !== 'admin' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Membresía:{' '}
                        {(() => {
                          const membership = membershipsByUserId.get(managedUser.id);
                          if (!membership) return 'No activa';
                          return `${membership.status}${membership.adminApproved ? ' (autorizada)' : ''}`;
                        })()}
                      </p>
                    )}
                  </div>
                  {managedUser.role !== 'admin' && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant={managedUser.status === 'active' ? 'outline' : 'default'}
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          void statusMutation.mutateAsync({
                            userId: managedUser.id,
                            status: managedUser.status === 'active' ? 'disabled' : 'active',
                          })
                        }
                      >
                        {managedUser.status === 'active' ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={membershipMutation.isPending}
                        onClick={() => {
                          const membership = membershipsByUserId.get(managedUser.id);
                          const isAuthorized =
                            membership?.status === 'active' && membership.adminApproved;

                          void membershipMutation.mutateAsync({
                            userId: managedUser.id,
                            status: isAuthorized ? 'suspended' : 'active',
                            adminApproved: !isAuthorized,
                          });
                        }}
                      >
                        {(() => {
                          const membership = membershipsByUserId.get(managedUser.id);
                          const isAuthorized =
                            membership?.status === 'active' && membership.adminApproved;
                          return isAuthorized ? 'Suspender membresía' : 'Autorizar membresía';
                        })()}
                      </Button>
                    </div>
                  )}
                </div>

                {selectedUser?.id === managedUser.id && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground grid sm:grid-cols-2 gap-2">
                    <p><span className="font-medium text-foreground">Email:</span> {selectedUser.email}</p>
                    <p><span className="font-medium text-foreground">Empresa:</span> {selectedUser.company}</p>
                    <p><span className="font-medium text-foreground">Cargo:</span> {selectedUser.position}</p>
                    <p><span className="font-medium text-foreground">Sector:</span> {selectedUser.sector ?? 'General'}</p>
                    <p><span className="font-medium text-foreground">Ubicación:</span> {selectedUser.location ?? 'Sin ubicación'}</p>
                    <p><span className="font-medium text-foreground">Puntos:</span> {selectedUser.points}</p>
                    <p className="sm:col-span-2"><span className="font-medium text-foreground">Descripción:</span> {selectedUser.description ?? 'Sin descripción'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>}
      </div>
    </MainLayout>
  );
};

export default Admin;

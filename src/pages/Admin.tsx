import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Archive,
  BookOpen,
  Bot,
  Building2,
  Download,
  Edit,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Save,
  Upload,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import {
  adminCreatePost,
  adminArchivePost,
  adminDeleteComment,
  adminDeletePost,
  adminUpdatePost,
  getAdminMemberships,
  getAdminAgentUsage,
  getAdminAiAgents,
  getAdminAgentFeedback,
  getAdminAgentMetrics,
  getAdminDashboard,
  getAdminModuleActivations,
  getAdminUserPdfBranding,
  getPlatformStats,
  uploadFile,
  uploadAdminVideoInChunks,
  updateMembershipByAdmin,
  updateAdminAgentStatus,
  updateAdminModuleActivation,
  updateAdminUserPdfBranding,
  updateUserStatus,
} from '@/lib/api';
import { moduleActivationCatalog } from '@/lib/moduleActivation';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ModuleActivationSetting, Post, PostResource, UserPdfBrandingSettings, UserStatus } from '@/types';

const SKILL_CATEGORY_SLUG = 'mejorar-skill';
const PROFESSIONAL_ROUTE_ID: LearningRouteId = 'ruta-5';
const MAX_ADMIN_VIDEO_DURATION_SECONDS = 15 * 60;
const MAX_ADMIN_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_TYPE_COLOR = '#f3313f';
const ARTICLE_TYPE_COLOR = '#b2eb4a';

type ContentStatus = 'draft' | 'published' | 'archived';
type AccessType = 'free' | 'professional' | 'premium';
type MembershipPlan = 'free' | 'professional' | 'premium';

const membershipPlans: Array<{
  id: MembershipPlan;
  label: string;
  description: string;
}> = [
  {
    id: 'free',
    label: 'Plan gratuito',
    description: '1 agente y 1 publicación por día. Información limitada.',
  },
  {
    id: 'professional',
    label: 'Plan profesional',
    description: '3 automatizaciones por día, notificaciones sectoriales y reuniones grupales.',
  },
  {
    id: 'premium',
    label: 'Plan premium',
    description: 'Automatizaciones, publicaciones y reuniones ilimitadas.',
  },
];

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${Math.ceil(bytes / (1024 * 1024))} MB`;
};

function formatDateTime(value?: string) {
  if (!value) return 'No registrado';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No registrado';
  }

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

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
  const location = useLocation();
  const [form, setForm] = useState({
    title: '',
    description: '',
    contentBody: '',
    mediaType: 'video' as 'video' | 'image',
    categoryId: 'cat-7',
    learningRoute: DEFAULT_LEARNING_ROUTE_ID as LearningRouteId | '',
    status: 'published' as ContentStatus,
    accessType: 'free' as AccessType,
    isFeatured: false,
    expertName: '',
  });
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
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
  const [agentAuthorizerOpen, setAgentAuthorizerOpen] = useState(false);
  const [moduleActivationNotice, setModuleActivationNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
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
        contentBody: '',
        mediaType: 'video',
        categoryId: 'cat-7',
        learningRoute: DEFAULT_LEARNING_ROUTE_ID,
        status: 'published',
        accessType: 'free',
        isFeatured: false,
        expertName: '',
      });
      setEditingPostId(null);
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

  const adminAgentsQuery = useQuery({
    queryKey: ['admin-ai-agents'],
    queryFn: getAdminAiAgents,
    enabled: user?.role === 'admin',
  });
  const agentUsageQuery = useQuery({
    queryKey: ['admin-agent-usage'],
    queryFn: getAdminAgentUsage,
    enabled: user?.role === 'admin',
  });
  const agentMetricsQuery = useQuery({
    queryKey: ['admin-agent-metrics'],
    queryFn: getAdminAgentMetrics,
    enabled: user?.role === 'admin',
  });
  const agentFeedbackQuery = useQuery({
    queryKey: ['admin-agent-feedback'],
    queryFn: getAdminAgentFeedback,
    enabled: user?.role === 'admin',
  });
  const moduleActivationsQuery = useQuery({
    queryKey: ['admin-module-activations'],
    queryFn: getAdminModuleActivations,
    enabled: user?.role === 'admin',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const agentStatusMutation = useMutation({
    mutationFn: ({ agentKey, status }: { agentKey: string; status: 'active' | 'coming_soon' | 'disabled' | 'hidden' }) =>
      updateAdminAgentStatus(agentKey, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-agent-metrics'] });
    },
  });
  const userPdfBrandingMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Partial<UserPdfBrandingSettings> }) =>
      updateAdminUserPdfBranding(userId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-user-pdf-branding', variables.userId] });
    },
  });
  const moduleActivationMutation = useMutation({
    mutationFn: ({ role, moduleKey, enabled }: { role: ModuleActivationSetting['role']; moduleKey: string; enabled: boolean }) =>
      updateAdminModuleActivation(role, moduleKey, enabled),
    onMutate: async (variables) => {
      setModuleActivationNotice(null);
      await queryClient.cancelQueries({ queryKey: ['admin-module-activations'] });
      await queryClient.cancelQueries({ queryKey: ['module-activations'] });
      const previous = queryClient.getQueryData<ModuleActivationSetting[]>(['admin-module-activations']);
      const previousUserModules = queryClient.getQueriesData<{ role: string; modules: ModuleActivationSetting[] }>({
        queryKey: ['module-activations'],
      });
      const now = new Date().toISOString();

      queryClient.setQueryData<ModuleActivationSetting[]>(['admin-module-activations'], (current = []) => {
        const nextSetting: ModuleActivationSetting = {
          id: `${variables.role}-${variables.moduleKey}`,
          role: variables.role,
          moduleKey: variables.moduleKey,
          enabled: variables.enabled,
          createdAt: now,
          updatedAt: now,
        };
        const exists = current.some(
          (item) => item.role === nextSetting.role && item.moduleKey === nextSetting.moduleKey,
        );

        return exists
          ? current.map((item) =>
              item.role === nextSetting.role && item.moduleKey === nextSetting.moduleKey
                ? { ...item, enabled: variables.enabled, updatedAt: now }
                : item,
            )
          : [...current, nextSetting];
      });
      queryClient.setQueriesData<{ role: string; modules: ModuleActivationSetting[] }>(
        { queryKey: ['module-activations'] },
        (current) => {
          if (!current?.modules) return current;
          const exists = current.modules.some(
            (item) => item.role === variables.role && item.moduleKey === variables.moduleKey,
          );
          const modules = exists
            ? current.modules.map((item) =>
                item.role === variables.role && item.moduleKey === variables.moduleKey
                  ? { ...item, enabled: variables.enabled, updatedAt: now }
                  : item,
              )
            : [
                ...current.modules,
                {
                  id: `${variables.role}-${variables.moduleKey}`,
                  role: variables.role,
                  moduleKey: variables.moduleKey,
                  enabled: variables.enabled,
                  createdAt: now,
                  updatedAt: now,
                },
              ];

          return { ...current, modules };
        },
      );

      return { previous, previousUserModules };
    },
    onSuccess: (updatedSetting, variables) => {
      queryClient.setQueryData<ModuleActivationSetting[]>(['admin-module-activations'], (current = []) => {
        const exists = current.some(
          (item) => item.role === updatedSetting.role && item.moduleKey === updatedSetting.moduleKey,
        );

        return exists
          ? current.map((item) =>
              item.role === updatedSetting.role && item.moduleKey === updatedSetting.moduleKey ? updatedSetting : item,
            )
          : [...current, updatedSetting];
      });
      queryClient.setQueriesData<{ role: string; modules: ModuleActivationSetting[] }>(
        { queryKey: ['module-activations'] },
        (current) => {
          if (!current?.modules) return current;
          const exists = current.modules.some(
            (item) => item.role === updatedSetting.role && item.moduleKey === updatedSetting.moduleKey,
          );
          const modules = exists
            ? current.modules.map((item) =>
                item.role === updatedSetting.role && item.moduleKey === updatedSetting.moduleKey ? updatedSetting : item,
              )
            : [...current.modules, updatedSetting];

          return { ...current, modules };
        },
      );
      const roleLabel =
        variables.role === 'buyer' ? 'compradores' : variables.role === 'supplier' ? 'proveedores' : 'expertos';
      setModuleActivationNotice({
        type: 'success',
        message: `${variables.enabled ? 'Activado' : 'Desactivado'} para usuarios ${roleLabel}.`,
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-module-activations'], context.previous);
      }
      context?.previousUserModules?.forEach(([queryKey, value]) => {
        queryClient.setQueryData(queryKey, value);
      });
      setModuleActivationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo guardar el cambio del modulo.',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-module-activations'] });
      void queryClient.invalidateQueries({ queryKey: ['module-activations'] });
      void queryClient.refetchQueries({ queryKey: ['admin-module-activations'] });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: FormData }) =>
      adminUpdatePost(postId, payload),
    onSuccess: () => {
      setEditingPostId(null);
      setThumbnailFile(null);
      setVideoFile(null);
      setThumbnailPreview('');
      setVideoPreview('');
      setResources([]);
      setPublishError('');
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['educational-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['employability-skill-posts'] });
    },
  });

  const archivePostMutation = useMutation({
    mutationFn: adminArchivePost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['educational-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['employability-skill-posts'] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: adminDeletePost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['educational-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['employability-skill-posts'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: adminDeleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-memberships'] });
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
      plan,
    }: {
      userId: string;
      status: 'pending' | 'active' | 'expired' | 'suspended';
      adminApproved: boolean;
      plan?: MembershipPlan;
    }) =>
      updateMembershipByAdmin(userId, { status, adminApproved, plan }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-memberships'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const summaryCards = useMemo(
    () =>
      data
        ? [
            {
              label: 'Total usuarios',
              value: platformStatsQuery.data?.totalUsers ?? data.overview.totalUsers,
              description: 'Usuarios registrados en el ecosistema',
              icon: Users,
              iconClassName: 'bg-primary/10 text-primary',
              dividerClassName: 'bg-primary',
            },
          ]
        : [],
    [data, platformStatsQuery.data?.totalUsers],
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
    () => (data?.users ?? []).filter((item) => item.role === 'supplier'),
    [data?.users],
  );
  const pendingSupplierUsers = useMemo(
    () => supplierUsers.filter((item) => item.status === 'pending'),
    [supplierUsers],
  );
  const postsById = useMemo(
    () => new Map((data?.posts ?? []).map((post) => [post.id, post])),
    [data?.posts],
  );
  const feedbackByRunId = useMemo(
    () => new Map((agentFeedbackQuery.data ?? []).map((feedback) => [feedback.agentRunId, feedback])),
    [agentFeedbackQuery.data],
  );
  const agentNamesByKey = useMemo(
    () => new Map((adminAgentsQuery.data ?? []).map((agent) => [agent.agentKey ?? agent.id, agent.name])),
    [adminAgentsQuery.data],
  );
  const commentsBySelectedCategory = useMemo(() => {
    if (!data?.comments) {
      return [];
    }

    if (!selectedCategoryId) {
      return data.comments;
    }

    return data.comments.filter((comment) => postsById.get(comment.postId)?.category?.id === selectedCategoryId);
  }, [data?.comments, postsById, selectedCategoryId]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const educationalCategory = categories.find((category) => category.slug === 'contenido-educativo') ?? null;
  const skillCategory = categories.find((category) => category.slug === SKILL_CATEGORY_SLUG) ?? null;
  const isSkillDestination = form.categoryId === skillCategory?.id || (!skillCategory && form.categoryId === 'cat-8');
  const isEducationalDestination =
    form.categoryId === educationalCategory?.id || (!educationalCategory && form.categoryId === 'cat-7');
  const requiresLearningRoute = isEducationalDestination || isSkillDestination;
  const effectiveLearningRoute =
    normalizeLearningRouteId(form.learningRoute || undefined) ??
    (isSkillDestination ? PROFESSIONAL_ROUTE_ID : undefined);
  const hasRequiredLearningRoute = !requiresLearningRoute || Boolean(effectiveLearningRoute);
  const educationalContentPosts = useMemo(
    () => (data?.posts ?? []).filter((post) => post.type === 'educational'),
    [data?.posts],
  );
  const categoryCommentCounts = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      commentsCount: (data?.comments ?? []).filter(
        (comment) => postsById.get(comment.postId)?.category?.id === category.id,
      ).length,
    }));
  }, [categories, data?.comments, postsById]);
  const selectedUserPdfBrandingQuery = useQuery({
    queryKey: ['admin-user-pdf-branding', selectedUserId],
    queryFn: () => getAdminUserPdfBranding(selectedUserId ?? ''),
    enabled: user?.role === 'admin' && Boolean(selectedUserId),
  });
  const handleOpenAgentAuthorizer = () => {
    setAgentAuthorizerOpen((current) => {
      const next = !current;

      if (!current) {
        window.setTimeout(() => {
          document.getElementById('admin-ai-agents')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 80);
      }

      return next;
    });
  };

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
  const isUsersAdminView = location.pathname === '/admin/users';
  const isContentAdminView = location.pathname === '/admin/content';
  const isAgentsAdminView = location.pathname === '/admin/agents';
  const isModulesAdminView = location.pathname === '/admin/modules';
  const isDedicatedAdminView = isContentAdminView || isAgentsAdminView || isModulesAdminView;

  if (!isAuthLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthLoading && user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6 sm:py-10">
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de administracion</h1>
          <p className="text-muted-foreground">
            Solo el administrador superior del ecosistema puede acceder a esta seccion.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (isUsersAdminView) {
    const userAdminCards = [
      {
        title: 'Comprador',
        description: 'Administra usuarios compradores registrados en la plataforma.',
        action: 'Gestionar compradores',
        icon: UserRound,
        targetId: 'admin-buyers',
        iconClassName: 'bg-destructive/10 text-destructive',
      },
      {
        title: 'Proveedor',
        description: 'Administra usuarios proveedores registrados en la plataforma.',
        action: 'Gestionar proveedores',
        icon: Building2,
        targetId: 'admin-suppliers',
        iconClassName: 'bg-success/20 text-success-foreground',
      },
      {
        title: 'Verificación de proveedores',
        description: 'Revisa y aprueba proveedores pendientes de validación.',
        action: 'Revisar verificaciones',
        icon: Users,
        targetId: 'admin-provider-verification',
        iconClassName: 'bg-primary/10 text-primary',
      },
    ];

    return (
      <MainLayout>
        <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-5 space-y-8 overflow-x-hidden sm:px-6 sm:py-8 2xl:max-w-[1440px]">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Administrador de usuarios</h1>
            <p className="mt-1 text-muted-foreground">
              Gestiona compradores, proveedores y verificaciones dentro de la plataforma.
            </p>
          </motion.div>

          <section className="grid min-w-0 gap-4 md:grid-cols-3">
            {userAdminCards.map((card) => {
              const Icon = card.icon;

              return (
                <Card key={card.title} className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
                  <CardContent className="flex h-full min-w-0 flex-col gap-4 p-5">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconClassName}`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-auto justify-start"
                      onClick={() =>
                        document.getElementById(card.targetId)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                    >
                      {card.action}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {renderSupplierVerification()}

          <section className="grid lg:grid-cols-2 gap-6">
            {renderManagedUsers(buyerUsers, 'Compradores', 'admin-buyers')}
            {renderManagedUsers(supplierUsers, 'Proveedores', 'admin-suppliers')}
          </section>
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

  function formatChoice(value?: string) {
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
  }

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

  const getStatusLabel = (status?: Post['status']) => {
    if (status === 'draft') return 'Borrador';
    if (status === 'archived') return 'Archivado';
    return 'Publicado';
  };

  const getAccessLabel = (accessType?: Post['accessType']) => {
    if (accessType === 'professional') return 'Profesional';
    if (accessType === 'premium') return 'Premium';
    return 'Gratuito';
  };

  const getAgentStatusLabel = (status?: string) => {
    if (status === 'active') return 'Activo';
    if (status === 'coming_soon') return 'Proximamente';
    if (status === 'disabled') return 'En mantenimiento';
    if (status === 'hidden') return 'Oculto';
    return 'Proximamente';
  };

  const getAgentStatusBadgeClass = (status?: string) => {
    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'disabled') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'hidden') return 'border-slate-200 bg-slate-100 text-slate-600';
    return 'border-primary/20 bg-primary/5 text-primary';
  };

  const isVideoPost = (post: Pick<Post, 'mediaType' | 'videoUrl'>) => post.mediaType === 'video' || Boolean(post.videoUrl);

  const getMediaTypeLabel = (post: Pick<Post, 'mediaType' | 'videoUrl'>) => (isVideoPost(post) ? 'Video' : 'Articulo');

  const getMediaTypeBadgeStyle = (isVideo: boolean) => ({
    backgroundColor: isVideo ? VIDEO_TYPE_COLOR : ARTICLE_TYPE_COLOR,
    borderColor: isVideo ? VIDEO_TYPE_COLOR : ARTICLE_TYPE_COLOR,
    color: '#ffffff',
  });

  const getPublishErrorMessage = () => {
    const rawMessage =
      publishError ||
      (createMutation.error instanceof Error
        ? createMutation.error.message
        : updatePostMutation.error instanceof Error
          ? updatePostMutation.error.message
          : '');

    if (
      hasRequiredLearningRoute &&
      /selecciona una ruta|ruta tematica|ruta temática/i.test(rawMessage)
    ) {
      return '';
    }

    return rawMessage;
  };

  function renderManagedUsers(users: typeof buyerUsers, roleLabel: string, sectionId?: string) {
    return (
      <section id={sectionId} className="scroll-mt-6 bg-card rounded-lg border border-border p-5">
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
                  {managedUser.role === 'supplier' && managedUser.status === 'pending' ? (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          void statusMutation.mutateAsync({
                            userId: managedUser.id,
                            status: 'active',
                          })
                        }
                      >
                        Aprobar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          void statusMutation.mutateAsync({
                            userId: managedUser.id,
                            status: 'rejected',
                          })
                        }
                      >
                        Rechazar
                      </Button>
                    </>
                  ) : null}
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
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {membershipPlans.map((plan) => {
                  const isCurrentPlan =
                    membership?.plan === plan.id &&
                    membership.status === 'active' &&
                    membership.adminApproved;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={membershipMutation.isPending}
                      onClick={() =>
                        void membershipMutation.mutateAsync({
                          userId: managedUser.id,
                          plan: plan.id,
                          status: 'active',
                          adminApproved: true,
                        })
                      }
                      className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                        isCurrentPlan
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span className="block font-semibold text-foreground">{plan.label}</span>
                      <span className="mt-1 block leading-5">{plan.description}</span>
                    </button>
                  );
                })}
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

                  {selectedUserPdfBrandingQuery.data && (
                    <div className="sm:col-span-2 mt-3 rounded-lg border border-border bg-background p-4">
                      <div className="mb-3 flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">Permisos PDF de agentes</p>
                        <p className="text-xs text-muted-foreground">Activa formatos premium por usuario. El PDF estándar queda habilitado por defecto.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            checked={selectedUserPdfBrandingQuery.data.standardPdfEnabled}
                            onChange={(event) =>
                              userPdfBrandingMutation.mutate({
                                userId: managedUser.id,
                                payload: { standardPdfEnabled: event.target.checked },
                              })
                            }
                          />
                          PDF estándar
                        </label>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            checked={selectedUserPdfBrandingQuery.data.whiteLabelPdfEnabled}
                            onChange={(event) =>
                              userPdfBrandingMutation.mutate({
                                userId: managedUser.id,
                                payload: { whiteLabelPdfEnabled: event.target.checked, premiumPdfStatus: 'active' },
                              })
                            }
                          />
                          PDF sin logo
                        </label>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            checked={selectedUserPdfBrandingQuery.data.customBrandPdfEnabled}
                            onChange={(event) =>
                              userPdfBrandingMutation.mutate({
                                userId: managedUser.id,
                                payload: { customBrandPdfEnabled: event.target.checked, premiumPdfStatus: 'active' },
                              })
                            }
                          />
                          PDF con logo propio
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Input
                          defaultValue={selectedUserPdfBrandingQuery.data.customBrandName ?? managedUser.commercialName ?? managedUser.company}
                          placeholder="Nombre comercial para PDF"
                          onBlur={(event) =>
                            userPdfBrandingMutation.mutate({
                              userId: managedUser.id,
                              payload: { customBrandName: event.target.value },
                            })
                          }
                        />
                        <Input
                          defaultValue={selectedUserPdfBrandingQuery.data.customLogoUrl ?? managedUser.avatarUrl ?? ''}
                          placeholder="URL de logo personalizado"
                          onBlur={(event) =>
                            userPdfBrandingMutation.mutate({
                              userId: managedUser.id,
                              payload: { customLogoUrl: event.target.value },
                            })
                          }
                        />
                        <Input
                          defaultValue={selectedUserPdfBrandingQuery.data.customPrimaryColor ?? '#1d4ed8'}
                          placeholder="#1d4ed8"
                          onBlur={(event) =>
                            userPdfBrandingMutation.mutate({
                              userId: managedUser.id,
                              payload: { customPrimaryColor: event.target.value },
                            })
                          }
                        />
                        <Input
                          defaultValue={selectedUserPdfBrandingQuery.data.adminNotes ?? ''}
                          placeholder="Nota interna"
                          onBlur={(event) =>
                            userPdfBrandingMutation.mutate({
                              userId: managedUser.id,
                              payload: { adminNotes: event.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
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
  }

  function renderSupplierVerification() {
    return (
      <section id="admin-provider-verification" className="scroll-mt-6 bg-card rounded-lg border border-border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Verificación de proveedores</h2>
          <p className="text-sm text-muted-foreground">
            Solicitudes pendientes antes de habilitar acceso al ecosistema.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {pendingSupplierUsers.length} pendientes
        </Badge>
      </div>
      {pendingSupplierUsers.length ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Sector</th>
                <th className="px-4 py-3 font-medium">Registro</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingSupplierUsers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{supplier.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.sector ?? 'General'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(supplier.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() => void statusMutation.mutateAsync({ userId: supplier.id, status: 'active' })}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() => void statusMutation.mutateAsync({ userId: supplier.id, status: 'rejected' })}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay proveedores pendientes de aprobación.</p>
      )}
      </section>
    );
  }

  function renderCommentManagement() {
    return (
      <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
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

        <div id="admin-category-comments" className="scroll-mt-6 bg-card rounded-lg border border-border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-foreground">
                {selectedCategory ? `Comentarios en ${selectedCategory.name}` : 'Inteligencia colectiva'}
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
                      En {comment.postTitle} - {postsById.get(comment.postId)?.category?.name ?? 'Sin categoria'} -{' '}
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
    );
  }

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

  const resetContentForm = () => {
    setForm({
      title: '',
      description: '',
      contentBody: '',
      mediaType: 'video',
      categoryId: educationalCategory?.id ?? 'cat-7',
      learningRoute: DEFAULT_LEARNING_ROUTE_ID,
      status: 'published',
      accessType: 'free',
      isFeatured: false,
      expertName: '',
    });
    setEditingPostId(null);
    setThumbnailFile(null);
    setVideoFile(null);
    setThumbnailPreview('');
    setVideoPreview('');
    setResources([]);
    setResourceDraft({ type: 'link', name: '', url: '' });
    setResourceFile(null);
    setPublishError('');
    setPublishSuccess(false);
  };

  const handleLearningRouteChange = (value: string) => {
    const nextRoute = normalizeLearningRouteId(value) ?? DEFAULT_LEARNING_ROUTE_ID;

    createMutation.reset();
    updatePostMutation.reset();
    setPublishError('');
    setPublishSuccess(false);
    setForm((current) => ({
      ...current,
      learningRoute: nextRoute,
      categoryId:
        nextRoute === PROFESSIONAL_ROUTE_ID && skillCategory
          ? skillCategory.id
          : nextRoute !== PROFESSIONAL_ROUTE_ID
            ? educationalCategory?.id ?? current.categoryId
            : current.categoryId,
    }));
  };

  const handleEditPost = (post: Post) => {
    const postRoute = normalizeLearningRouteId(post.learningRoute) ?? DEFAULT_LEARNING_ROUTE_ID;
    setEditingPostId(post.id);
    setForm({
      title: post.title,
      description: post.description,
      contentBody: post.contentBody ?? '',
      mediaType: post.mediaType ?? (post.videoUrl ? 'video' : 'image'),
      categoryId: post.category?.id ?? educationalCategory?.id ?? categories[0]?.id ?? 'cat-7',
      learningRoute: postRoute,
      status: post.status ?? 'published',
      accessType: post.accessType ?? 'free',
      isFeatured: Boolean(post.isFeatured),
      expertName: post.expertName ?? post.author?.fullName ?? '',
    });
    setThumbnailFile(null);
    setVideoFile(null);
    setThumbnailPreview(post.thumbnailUrl ?? '');
    setVideoPreview(post.videoUrl ?? '');
    setResources(post.resources ?? []);
    setPublishSuccess(false);
    setPublishError('');
    window.requestAnimationFrame(() => {
      document.getElementById('admin-content-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const buildContentFormData = async () => {
    const formData = new FormData();
    const normalizedRoute =
      normalizeLearningRouteId(form.learningRoute || undefined) ??
      (isSkillDestination ? PROFESSIONAL_ROUTE_ID : undefined);
    const isProfessionalRoute = normalizedRoute === PROFESSIONAL_ROUTE_ID;

    formData.set('title', form.title);
    formData.set('description', form.description);
    formData.set('contentBody', form.contentBody);
    formData.set('categoryId', isProfessionalRoute && skillCategory ? skillCategory.id : form.categoryId);
    formData.set('type', 'educational');
    if (requiresLearningRoute && normalizedRoute) {
      formData.set('learningRoute', normalizedRoute);
    }
    formData.set('mediaType', form.mediaType);
    formData.set('resources', JSON.stringify(resources));
    formData.set('status', form.status);
    formData.set('accessType', form.accessType);
    formData.set('isFeatured', String(form.isFeatured));
    formData.set('expertName', form.expertName);

    if (form.mediaType === 'video' && videoFile) {
      setVideoUploadProgress(1);
      formData.set('videoUrl', await uploadAdminVideoInChunks(videoFile, setVideoUploadProgress));
    } else if (form.mediaType === 'video' && videoPreview && !videoPreview.startsWith('blob:')) {
      formData.set('videoUrl', videoPreview);
    }

    if (form.mediaType === 'image' && thumbnailFile) {
      formData.append('mainMedia', thumbnailFile);
    } else if (form.mediaType === 'image' && thumbnailPreview && !thumbnailPreview.startsWith('blob:')) {
      formData.set('thumbnailUrl', thumbnailPreview);
    }

    if (form.mediaType === 'video' && thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    } else if (form.mediaType === 'video' && thumbnailPreview && !thumbnailPreview.startsWith('blob:')) {
      formData.set('thumbnailUrl', thumbnailPreview);
    }

    return formData;
  };

  const handleSaveContent = async () => {
    setIsPublishingContent(true);
    createMutation.reset();
    updatePostMutation.reset();
    setPublishError('');
    setPublishSuccess(false);

    try {
      const formData = await buildContentFormData();

      if (editingPostId) {
        await updatePostMutation.mutateAsync({ postId: editingPostId, payload: formData });
        setPublishSuccess(true);
        resetContentForm();
        return;
      }

      await createMutation.mutateAsync(formData);
      setPublishSuccess(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el contenido.';
      setPublishError(
        message.toLowerCase().includes('file too large')
          ? 'El video es demasiado grande para el limite actual de subida. Intenta nuevamente cuando el backend desplegado tenga el ajuste de chunks.'
          : message,
      );
    } finally {
      setIsPublishingContent(false);
      setVideoUploadProgress(0);
    }
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isContentAdminView
              ? 'Administrador de contenido educativo'
              : isAgentsAdminView
                ? 'Administrador de agentes IA'
                : isModulesAdminView
                  ? 'Activador de módulos'
                : 'Panel administrativo'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isContentAdminView
              ? 'Gestiona, crea y organiza los contenidos educativos publicados dentro de la plataforma.'
              : isAgentsAdminView
                ? 'Gestiona, configura y supervisa los agentes de inteligencia artificial disponibles en la plataforma.'
                : isModulesAdminView
                  ? 'Activa o desactiva los módulos disponibles para cada tipo de usuario durante el lanzamiento de la plataforma.'
              : 'Resumen general del ecosistema'}
          </p>
        </motion.div>

        {!isDedicatedAdminView && <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        </section>}

        {!isDedicatedAdminView && <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        </section>}

        {!isDedicatedAdminView && <section className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
        </section>}

        {!isDedicatedAdminView && renderCommentManagement()}

        {isContentAdminView && (
          <>
            <section className="grid min-w-0 gap-4 md:grid-cols-2">
              {[
                {
                  title: 'Gestión de Contenido Educativo',
                  description: 'Administra recursos, publicaciones, videos y materiales educativos disponibles para los usuarios.',
                  action: 'Gestionar contenido',
                  icon: BookOpen,
                  targetId: 'admin-educational-content',
                  iconClassName: 'bg-primary/10 text-primary',
                },
                {
                  title: 'Crear contenido',
                  description: 'Crea nuevos recursos educativos para compradores, proveedores o comunidad.',
                  action: 'Crear nuevo contenido',
                  icon: FileText,
                  targetId: 'admin-content-form',
                  iconClassName: 'bg-secondary/15 text-secondary',
                },
              ].map((card) => {
                const Icon = card.icon;

                return (
                  <Card key={card.title} className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
                    <CardContent className="flex h-full min-w-0 flex-col gap-4 p-5">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconClassName}`}>
                          <Icon className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-auto justify-start"
                        onClick={() =>
                          document.getElementById(card.targetId)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                      >
                        {card.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

        <section className="grid min-w-0 gap-6">
          <div id="admin-content-form" className="min-w-0 overflow-hidden bg-card rounded-lg border border-border p-5 space-y-4 scroll-mt-6">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-medium text-foreground">
                  {editingPostId ? 'Editar contenido' : 'Crear contenido'}
                </h2>
                {editingPostId && (
                  <Button type="button" variant="outline" size="sm" onClick={resetContentForm}>
                    Cancelar edicion
                  </Button>
                )}
              </div>
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
                <label className="text-sm font-medium text-foreground">Descripcion corta</label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Resumen breve visible en las tarjetas."
                  className="min-h-[96px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cuerpo / contenido</label>
                <Textarea
                  value={form.contentBody}
                  onChange={(event) => setForm((current) => ({ ...current, contentBody: event.target.value }))}
                  placeholder="Desarrolla el contenido, pasos clave o contexto para el comprador."
                  className="min-h-[140px]"
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
                    createMutation.reset();
                    updatePostMutation.reset();
                    setPublishError('');
                    setPublishSuccess(false);
                    setForm((current) => ({
                      ...current,
                      categoryId:
                        nextIsSkill
                          ? skillCategory.id
                          : educationalCategory?.id ?? categories[0]?.id ?? current.categoryId,
                      learningRoute: nextIsSkill
                        ? PROFESSIONAL_ROUTE_ID
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
                  <label className="text-sm font-medium text-foreground">Ruta educativa</label>
                  <select
                    value={effectiveLearningRoute ?? DEFAULT_LEARNING_ROUTE_ID}
                    onChange={(event) => handleLearningRouteChange(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LEARNING_ROUTES.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.label} - {route.title}
                      </option>
                    ))}
                  </select>
                  {form.learningRoute === PROFESSIONAL_ROUTE_ID && (
                    <p className="text-xs text-muted-foreground">
                      Esta ruta se guarda como contenido de progreso profesional y se muestra en Empleabilidad / Mejorar skill.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Este destino no necesita ruta tematica; se publicara solo en Empleabilidad / Mejorar skill.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Estado</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ContentStatus }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tipo de acceso</label>
                  <select
                    value={form.accessType}
                    onChange={(event) => setForm((current) => ({ ...current, accessType: event.target.value as AccessType }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="free">Gratuito</option>
                    <option value="professional">Profesional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Autor o experto</label>
                  <Input
                    value={form.expertName}
                    onChange={(event) => setForm((current) => ({ ...current, expertName: event.target.value }))}
                    placeholder="Nombre del autor, experto o mentor"
                  />
                </div>
                <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  Destacado
                </label>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 sm:p-5 space-y-4 text-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {form.mediaType === 'video' ? (
                      <Video className="h-4 w-4" style={{ color: VIDEO_TYPE_COLOR }} />
                    ) : (
                      <FileText className="h-4 w-4" style={{ color: ARTICLE_TYPE_COLOR }} />
                    )}
                    <h3 className="text-[15px] font-medium">
                      {form.mediaType === 'video' ? 'Video y vista previa' : 'Articulo y vista previa'}
                    </h3>
                    <span
                      className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                      style={getMediaTypeBadgeStyle(form.mediaType === 'video')}
                    >
                      {form.mediaType === 'video' ? 'Video' : 'Articulo'}
                    </span>
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

              <div className="grid gap-3 sm:grid-cols-2">
                {form.mediaType === 'video' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">URL de video opcional</label>
                    <Input
                      value={videoPreview.startsWith('blob:') ? '' : videoPreview}
                      onChange={(event) => {
                        setVideoFile(null);
                        setVideoPreview(event.target.value);
                      }}
                      placeholder="https://..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {form.mediaType === 'video' ? 'URL de miniatura opcional' : 'URL de imagen opcional'}
                  </label>
                  <Input
                    value={thumbnailPreview.startsWith('blob:') ? '' : thumbnailPreview}
                    onChange={(event) => {
                      setThumbnailFile(null);
                      setThumbnailPreview(event.target.value);
                    }}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={getMediaTypeBadgeStyle(form.mediaType === 'video')}
                >
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

            {getPublishErrorMessage() && (
              <p className="text-sm text-destructive">
                {getPublishErrorMessage()}
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
                updatePostMutation.isPending ||
                isUploadingResource ||
                !form.title.trim() ||
                !form.description.trim() ||
                !form.categoryId ||
                !hasRequiredLearningRoute
              }
              onClick={() => void handleSaveContent()}
            >
              {isPublishingContent || createMutation.isPending || updatePostMutation.isPending
                ? form.mediaType === 'video' && videoUploadProgress > 0
                  ? videoUploadProgress >= 100
                    ? 'Procesando video...'
                    : `Subiendo video... ${videoUploadProgress}%`
                  : 'Guardando...'
                : isSkillDestination
                  ? editingPostId ? 'Guardar en Mejorar skill' : 'Publicar en Mejorar skill'
                  : editingPostId ? 'Guardar cambios' : 'Publicar contenido educativo'}
            </Button>
          </div>

        </section>

        <section className="grid min-w-0 gap-6">
          <div id="admin-educational-content" className="scroll-mt-6 bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-medium text-foreground mb-4">Gestion de Contenido Educativo</h2>
            {isLoading && <p className="text-sm text-muted-foreground">Cargando contenido...</p>}
            {isError && <p className="text-sm text-destructive">No se pudo cargar el panel.</p>}
            <div className="w-full overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Contenido</th>
                    <th className="py-2 pr-3 font-medium">Ruta</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Acceso</th>
                    <th className="py-2 pr-3 font-medium">Metricas</th>
                    <th className="py-2 pr-0 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {educationalContentPosts.map((post) => {
                    const route = LEARNING_ROUTES.find((item) => item.id === normalizeLearningRouteId(post.learningRoute));

                    return (
                      <tr key={post.id} className="border-b border-border/70 align-top">
                        <td className="py-3 pr-3">
                          <div className="flex gap-3">
                            <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
                              {post.thumbnailUrl ? (
                                <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{post.title}</p>
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={getMediaTypeBadgeStyle(isVideoPost(post))}
                                >
                                  {getMediaTypeLabel(post)}
                                </Badge>
                                {post.isFeatured && (
                                  <Badge className="bg-secondary/15 text-secondary hover:bg-secondary/15">
                                    Destacado
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.description}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{post.expertName || post.author?.fullName || 'Sin autor'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{route?.title ?? 'Sin ruta'}</td>
                        <td className="py-3 pr-3">
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(post.status)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{getAccessLabel(post.accessType)}</td>
                        <td className="py-3 pr-3">
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{post.metrics?.views ?? 0}</span>
                            <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{post.metrics?.downloads ?? 0}</span>
                            <span className="inline-flex items-center gap-1"><Save className="h-3 w-3" />{post.metrics?.saves ?? 0}</span>
                            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.metrics?.comments ?? post.comments ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-0">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleEditPost(post)}>
                              <Edit className="h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={archivePostMutation.isPending || post.status === 'archived'}
                              onClick={() => void archivePostMutation.mutateAsync(post.id)}
                            >
                              <Archive className="h-4 w-4" />
                              Archivar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={deletePostMutation.isPending}
                              onClick={() => void deletePostMutation.mutateAsync(post.id)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!educationalContentPosts.length && (
                <p className="py-6 text-sm text-muted-foreground">Todavia no hay contenidos educativos registrados.</p>
              )}
            </div>
          </div>

        </section>
          </>
        )}

        {isModulesAdminView && (
          <section className="space-y-4">
            {moduleActivationsQuery.isLoading && (
              <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                Cargando configuracion real de modulos...
              </p>
            )}
            {moduleActivationsQuery.isError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                No se pudo cargar el activador de modulos desde el servidor. Los cambios quedan bloqueados hasta que la
                configuracion responda correctamente.
              </p>
            )}
            {moduleActivationNotice && (
              <p
                className={`rounded-lg border px-4 py-3 text-sm ${
                  moduleActivationNotice.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-destructive/20 bg-destructive/5 text-destructive'
                }`}
              >
                {moduleActivationNotice.message}
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              {(['buyer', 'supplier', 'expert'] as const).map((role) => {
                const modules = moduleActivationCatalog[role];
                if (!modules.length) return null;
                const title = role === 'buyer' ? 'Comprador' : role === 'supplier' ? 'Proveedor' : 'Experto';
                const controlsDisabled =
                  moduleActivationMutation.isPending ||
                  moduleActivationsQuery.isLoading ||
                  moduleActivationsQuery.isError ||
                  !moduleActivationsQuery.data;

                return (
                  <Card key={role} className="rounded-xl shadow-[var(--shadow-card)]">
                    <CardHeader>
                      <CardTitle className="text-lg">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {modules.map((module) => {
                        const setting = moduleActivationsQuery.data?.find(
                          (item) => item.role === role && item.moduleKey === module.key,
                        );
                        const enabled = setting?.enabled ?? module.defaultEnabled;

                        return (
                          <div
                            key={module.key}
                            className={`flex items-center justify-between gap-4 rounded-lg border bg-background p-3 transition-colors ${
                              enabled ? 'border-primary/45' : 'border-slate-200'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{module.label}</p>
                              <p className={`text-xs ${enabled ? 'text-primary' : 'text-slate-500'}`}>
                                {enabled ? 'Activo' : 'Inactivo'}
                              </p>
                            </div>
                            <Switch
                              checked={enabled}
                              disabled={controlsDisabled}
                              aria-label={`${enabled ? 'Desactivar' : 'Activar'} ${module.label}`}
                              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-300"
                              onCheckedChange={(checked) =>
                                moduleActivationMutation.mutate({
                                  role,
                                  moduleKey: module.key,
                                  enabled: checked,
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {isAgentsAdminView && (
          <section className="grid min-w-0 gap-4 md:grid-cols-1">
            <Card className="min-w-0 rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full min-w-0 flex-col gap-4 p-5">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Bot className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">Autorizador de agentes IA</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Autoriza la visibilidad, funcionamiento y PDF premium de cada agente en la plataforma.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-auto w-fit justify-start"
                  onClick={handleOpenAgentAuthorizer}
                >
                  {agentAuthorizerOpen ? 'Ocultar autorizador' : 'Autorizar'}
                  <ArrowRight className={`ml-2 h-4 w-4 transition-transform ${agentAuthorizerOpen ? 'rotate-90' : ''}`} />
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {isAgentsAdminView && agentAuthorizerOpen && <section id="admin-ai-agents" className="scroll-mt-6 bg-card rounded-lg border border-border p-5">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-foreground">Autorizador de agentes IA</h2>
            <p className="text-sm text-muted-foreground">
              Autoriza si cada agente esta activo, proximamente, en mantenimiento u oculto para compradores.
            </p>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(adminAgentsQuery.data ?? []).map((agent) => {
              const agentKey = agent.agentKey ?? agent.id;
              return (
                <div key={agentKey} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.category}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${getAgentStatusBadgeClass(agent.status)}`}>
                      {getAgentStatusLabel(agent.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{agent.description}</p>
                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor={`agent-status-${agentKey}`}>
                      Estado del agente
                    </label>
                    <select
                      id={`agent-status-${agentKey}`}
                      value={agent.status ?? 'coming_soon'}
                      onChange={(event) =>
                        void agentStatusMutation.mutateAsync({
                          agentKey,
                          status: event.target.value as 'active' | 'coming_soon' | 'disabled' | 'hidden',
                        })
                      }
                      disabled={agentStatusMutation.isPending}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                    >
                      <option value="active">Activo</option>
                      <option value="coming_soon">Proximamente</option>
                      <option value="disabled">En mantenimiento</option>
                      <option value="hidden">Oculto</option>
                    </select>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Visible para comprador</span>
                    <span className="font-medium text-foreground">{agent.status === 'hidden' ? 'No' : 'Si'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {isAgentsAdminView && (
          <section className="space-y-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agentMetricsQuery.data ? (
              [
                ['Ejecuciones totales', agentMetricsQuery.data.totalExecutions],
                ['Costo total', `US$ ${agentMetricsQuery.data.totalTokenCost.toFixed(6)}`],
                ['Tokens input', agentMetricsQuery.data.tokensInputTotal],
                ['Tokens output', agentMetricsQuery.data.tokensOutputTotal],
                ['Tiempo promedio', `${agentMetricsQuery.data.averageLatencyMs} ms`],
                ['Calificacion promedio', agentMetricsQuery.data.averageStars || 'Sin datos'],
                ['Feedback pendiente', agentMetricsQuery.data.pendingNegativeFeedback],
                ['Agente mas usado', agentMetricsQuery.data.mostUsedAgent],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Cargando resumen tecnico de agentes...</p>
            )}
          </div>

          <Card className="mb-5 rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-lg">Resumen tecnico por agente</CardTitle>
              <p className="text-sm text-muted-foreground">
                Promedios y acumulados por agente calculados desde las ejecuciones registradas.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1500px] text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Agente</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Visible comprador</th>
                      <th className="px-4 py-3 font-medium">Ejecuciones</th>
                      <th className="px-4 py-3 font-medium">Tokens input</th>
                      <th className="px-4 py-3 font-medium">Tokens output</th>
                      <th className="px-4 py-3 font-medium">Costo input</th>
                      <th className="px-4 py-3 font-medium">Costo output</th>
                      <th className="px-4 py-3 font-medium">Costo total</th>
                      <th className="px-4 py-3 font-medium">Costo promedio</th>
                      <th className="px-4 py-3 font-medium">Tiempo promedio</th>
                      <th className="px-4 py-3 font-medium">Calificacion</th>
                      <th className="px-4 py-3 font-medium">Feedbacks pendientes</th>
                      <th className="px-4 py-3 font-medium">PDFs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminAgentsQuery.data ?? []).map((agent) => {
                      const metrics = agent.metrics;
                      const executions = metrics?.executions ?? 0;
                      const averageCost = executions ? (metrics?.costTotal ?? 0) / executions : 0;

                      return (
                        <tr key={agent.agentKey ?? agent.id} className="border-t border-border align-top">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{agent.category}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{getAgentStatusLabel(agent.status)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{agent.status === 'hidden' ? 'No' : 'Si'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{executions}</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.tokensInput ?? 0}</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.tokensOutput ?? 0}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(metrics?.costInput ?? 0).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(metrics?.costOutput ?? 0).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(metrics?.costTotal ?? 0).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {averageCost.toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.averageLatencyMs ?? 0} ms</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.averageStars || 'Sin datos'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.pendingFeedback ?? 0}</td>
                          <td className="px-4 py-3 text-muted-foreground">{metrics?.pdfGenerated ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!adminAgentsQuery.isLoading && !(adminAgentsQuery.data ?? []).length ? (
                <p className="mt-3 text-sm text-muted-foreground">Todavia no hay agentes registrados.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-lg">Uso real de agentes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cada fila aparece cuando un usuario ejecuta un agente e incluye usuario, tokens, costos, modelo y fecha.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Agente</th>
                      <th className="px-4 py-3 font-medium">Operacion</th>
                      <th className="px-4 py-3 font-medium">Fecha/hora</th>
                      <th className="px-4 py-3 font-medium">Modelo</th>
                      <th className="px-4 py-3 font-medium">Tokens input</th>
                      <th className="px-4 py-3 font-medium">Tokens output</th>
                      <th className="px-4 py-3 font-medium">Tokens total</th>
                      <th className="px-4 py-3 font-medium">Costo input</th>
                      <th className="px-4 py-3 font-medium">Costo output</th>
                      <th className="px-4 py-3 font-medium">Costo total</th>
                      <th className="px-4 py-3 font-medium">Tiempo</th>
                      <th className="px-4 py-3 font-medium">PDF</th>
                      <th className="px-4 py-3 font-medium">Calificacion</th>
                      <th className="px-4 py-3 font-medium">Comentario</th>
                      <th className="px-4 py-3 font-medium">Recomendacion para prompt</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agentUsageQuery.data ?? []).map((usage) => {
                      const feedback = feedbackByRunId.get(usage.agentRunId ?? '');
                      const promptRecommendation =
                        feedback?.improvementSuggestion ?? feedback?.correctedVersion ?? 'Sin recomendacion';

                      return (
                        <tr key={usage.id} className="border-t border-border align-top">
                          <td className="px-4 py-3 font-medium text-foreground">{usage.userName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getRoleLabel(usage.userRole)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.agentName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.operationName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(usage.createdAt)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.model ?? 'No especificado'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.inputTokens}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.outputTokens}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.totalTokens}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(usage.costInput ?? 0).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(usage.costOutput ?? 0).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">US$ {(usage.costTotal ?? usage.costAmount).toFixed(6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.latencyMs ?? 0} ms</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.pdfGenerated ? 'Si' : 'No'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{feedback ? `${feedback.stars}/5` : 'Sin calificar'}</td>
                          <td className="max-w-[260px] px-4 py-3 text-muted-foreground">{feedback?.comment ?? 'Sin comentario'}</td>
                          <td className="max-w-[320px] px-4 py-3 text-muted-foreground">{promptRecommendation}</td>
                          <td className="px-4 py-3 text-muted-foreground">{usage.status ?? 'completed'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!agentUsageQuery.isLoading && !(agentUsageQuery.data ?? []).length ? (
                <p className="mt-3 text-sm text-muted-foreground">Aun no hay usos registrados. Cuando alguien use un agente, aparecera aqui.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-lg">Calificaciones y mejoras de prompt</CardTitle>
              <p className="text-sm text-muted-foreground">
                Comentarios de usuarios y recomendaciones que sirven para ajustar o mejorar el prompt de cada agente.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Agente</th>
                      <th className="px-4 py-3 font-medium">Calificacion</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Comentario</th>
                      <th className="px-4 py-3 font-medium">Correccion sugerida</th>
                      <th className="px-4 py-3 font-medium">Recomendacion para prompt</th>
                      <th className="px-4 py-3 font-medium">Estado admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agentFeedbackQuery.data ?? []).map((feedback) => (
                      <tr key={feedback.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(feedback.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{feedback.userName ?? 'Usuario'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {agentNamesByKey.get(feedback.agentKey) ?? feedback.agentKey}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{feedback.stars}/5</td>
                        <td className="px-4 py-3 text-muted-foreground">{feedback.feedbackType}</td>
                        <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                          {feedback.comment || 'Sin comentario'}
                        </td>
                        <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                          {feedback.correctedVersion || 'Sin correccion'}
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-muted-foreground">
                          {feedback.improvementSuggestion || feedback.correctedVersion || 'Sin recomendacion'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{feedback.adminStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!agentFeedbackQuery.isLoading && !(agentFeedbackQuery.data ?? []).length ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Aun no hay calificaciones ni comentarios. Cuando un usuario califique un agente, aparecera aqui.
                </p>
              ) : null}
            </CardContent>
          </Card>

          </section>
        )}
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


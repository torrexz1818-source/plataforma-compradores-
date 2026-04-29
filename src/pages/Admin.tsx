import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, Image as ImageIcon, Link2, Upload, Video, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PostResource, UserStatus } from '@/types';

const Admin = () => {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    mediaType: 'video' as 'video' | 'image',
    categoryId: 'cat-1',
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
        categoryId: 'cat-1',
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
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
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
            { label: 'Usuarios', value: data.overview.totalUsers },
            { label: 'Usuarios activos', value: data.overview.activeUsers },
            { label: 'Posts', value: data.overview.totalPosts },
            { label: 'Videos', value: data.overview.educationalPosts },
            { label: 'Comentarios', value: data.overview.totalComments },
          ]
        : [],
    [data],
  );
  const membershipsByUserId = useMemo(
    () => new Map((membershipsQuery.data ?? []).map((membership) => [membership.userId, membership])),
    [membershipsQuery.data],
  );
  const sectorBreakdown = platformStatsQuery.data?.sectorBreakdown ?? [];
  const latestUsers = (platformStatsQuery.data?.latestUsers ?? []).slice(0, 8);
  const maxSectorCount = useMemo(
    () => Math.max(...sectorBreakdown.map((item) => item.count), 1),
    [sectorBreakdown],
  );

  if (!isAuthLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthLoading && user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de administracion</h1>
          <p className="text-muted-foreground">
            Solo el administrador superior de la plataforma puede acceder a esta seccion.
          </p>
        </div>
      </MainLayout>
    );
  }

  const categories = data?.categories ?? [];
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
        categoryId: categories[0].id,
      };
    });
  }, [categories]);

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
              <div className="flex items-start justify-between gap-3">
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
                <div className="flex gap-2">
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

  const handleMainMediaChange = (file: File | null, mediaType: 'video' | 'image') => {
    if (mediaType === 'video') {
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
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de administracion</h1>
          <p className="text-muted-foreground">
            Gestiona el unico administrador global, los videos educativos, publicaciones, comentarios y usuarios.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usuarios por sector</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            {platformStatsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando sectores...</p>
            )}
            <div className="space-y-4">
              {sectorBreakdown.map((item) => (
                <div key={item.sector} className="grid grid-cols-[130px_1fr_42px] items-center gap-3">
                  <span className="text-sm text-foreground">{item.sector}</span>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max((item.count / maxSectorCount) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="text-sm text-foreground text-right">{item.count}</span>
                </div>
              ))}
            </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ultimos registros</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
            {platformStatsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
            )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-medium text-foreground">Nombre</th>
                    <th className="py-2 pr-4 text-left font-medium text-foreground">Empresa</th>
                    <th className="py-2 pr-4 text-left font-medium text-foreground">Sector</th>
                    <th className="py-2 text-left font-medium text-foreground">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {latestUsers.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="py-3 pr-4 text-foreground">{item.name}</td>
                      <td className="py-3 pr-4 text-foreground">{item.company}</td>
                      <td className="py-3 pr-4 text-foreground">{item.sector || 'General'}</td>
                      <td className="py-4">
                        <Badge
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            item.role === 'supplier'
                              ? 'bg-success/25 text-success-foreground hover:bg-success/25'
                              : 'bg-primary/15 text-primary hover:bg-primary/15'
                          }`}
                        >
                          {item.role === 'supplier' ? 'Proveedor' : 'Comprador'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-medium text-foreground">Crear contenido</h2>
              <p className="text-sm text-muted-foreground">
                Publica material educativo con vista previa antes de subirlo y agrega recursos complementarios.
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

            <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 space-y-4 text-foreground">
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
                    {form.mediaType === 'video' ? 'MP4, MOV, WEBM' : 'PNG, JPG, WEBP, PDF y otros archivos'}
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
                        onChange={(event) => handleMainMediaChange(event.target.files?.[0] ?? null, 'image')}
                        className="hidden"
                      />
                    </label>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    {form.mediaType === 'video' ? (videoFile ? 'Cambiar video' : 'Seleccionar video') : (thumbnailFile ? 'Cambiar articulo' : 'Seleccionar articulo')}
                    <input
                      type="file"
                      accept={form.mediaType === 'video' ? 'video/*' : 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
                      onChange={(event) => handleMainMediaChange(event.target.files?.[0] ?? null, form.mediaType)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl bg-background border border-border overflow-hidden min-h-[280px] flex items-center justify-center">
                {form.mediaType === 'video' && videoPreview ? (
                  <video
                    src={videoPreview}
                    controls
                    poster={thumbnailPreview || undefined}
                    className="h-full max-h-[420px] w-full object-contain bg-background"
                  />
                ) : null}
                {form.mediaType === 'image' && thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Vista previa"
                    className="h-full max-h-[420px] w-full object-contain bg-background"
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
                      ? videoFile?.name || 'Aun no seleccionaste un video.'
                      : thumbnailFile?.name || 'Aun no seleccionaste un articulo.'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este contenido se publicara solo en el modulo de contenido educativo.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
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

              <div className="rounded-xl border border-border bg-background/80 p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-[150px_1fr_1fr_auto]">
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
                  <Button type="button" variant="outline" onClick={() => void addResource()} disabled={isUploadingResource}>
                    {isUploadingResource ? 'Subiendo...' : 'Agregar'}
                  </Button>
                </div>
                {resourceDraft.type !== 'link' && (
                  <p className="text-xs text-muted-foreground">
                    {resourceFile ? `Archivo listo: ${resourceFile.name}` : 'Selecciona un archivo local para adjuntarlo como recurso.'}
                  </p>
                )}
                {resourceUploadError && (
                  <p className="text-xs text-destructive">{resourceUploadError}</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background p-2">
                <div className="max-h-52 overflow-y-auto pr-1 space-y-2">
                  {resources.map((resource) => (
                    <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                          {resource.type === 'link' ? <Link2 className="h-4 w-4 text-primary" /> : null}
                          {resource.type === 'image' ? <ImageIcon className="h-4 w-4 text-primary" /> : null}
                          {resource.type === 'file' ? <FileText className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <div className="min-w-0">
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

            {createMutation.error && (
              <p className="text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'No se pudo crear el contenido'}
              </p>
            )}

            {form.mediaType === 'video' && videoUploadProgress > 0 && createMutation.isPending && (
              <p className="text-sm text-muted-foreground">
                Subiendo video por partes: {videoUploadProgress}%
              </p>
            )}

            <Button
              disabled={
                createMutation.isPending ||
                !form.title.trim() ||
                !form.description.trim() ||
                !form.categoryId ||
                (form.mediaType === 'video' ? !videoFile : !thumbnailFile)
              }
              onClick={async () => {
                try {
                  if (form.mediaType === 'video' && videoFile) {
                    setVideoUploadProgress(1);
                    const uploadedVideoUrl = await uploadAdminVideoInChunks(videoFile, setVideoUploadProgress);
                    const formData = new FormData();

                    formData.set('title', form.title);
                    formData.set('description', form.description);
                    formData.set('categoryId', form.categoryId);
                    formData.set('type', 'educational');
                    formData.set('mediaType', form.mediaType);
                    formData.set('videoUrl', uploadedVideoUrl);
                    formData.set('resources', JSON.stringify(resources));

                    if (thumbnailFile) {
                      formData.append('thumbnail', thumbnailFile);
                    }

                    await createMutation.mutateAsync(formData);
                    return;
                  }

                  const formData = new FormData();
                  formData.set('title', form.title);
                  formData.set('description', form.description);
                  formData.set('categoryId', form.categoryId);
                  formData.set('type', 'educational');
                  formData.set('mediaType', form.mediaType);
                  formData.set('resources', JSON.stringify(resources));

                  if (form.mediaType === 'image' && thumbnailFile) {
                    formData.append('mainMedia', thumbnailFile);
                  }

                  await createMutation.mutateAsync(formData);
                } finally {
                  setVideoUploadProgress(0);
                }
              }}
            >
              {createMutation.isPending
                ? form.mediaType === 'video' && videoUploadProgress > 0
                  ? `Subiendo video... ${videoUploadProgress}%`
                  : 'Guardando...'
                : 'Publicar contenido educativo'}
            </Button>
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
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
                  <div className="flex items-start justify-between gap-3">
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
                  <div className="flex items-start justify-between gap-3">
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

        {false && <section className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-lg font-medium text-foreground mb-4">Usuarios</h2>
          <div className="space-y-3">
            {(data?.users ?? []).map((managedUser) => (
              <div key={managedUser.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
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
                    <div className="flex gap-2">
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

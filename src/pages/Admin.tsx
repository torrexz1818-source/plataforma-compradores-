import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import {
  adminCreatePost,
  adminDeleteComment,
  adminDeletePost,
  getAdminMemberships,
  getAdminDashboard,
  getPlatformStats,
  updateMembershipByAdmin,
  updateUserStatus,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserStatus } from '@/types';

const Admin = () => {
  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });

  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
      });
      setThumbnailFile(null);
      setVideoFile(null);
      setThumbnailPreview('');
      setVideoPreview('');
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
            <div key={card.label} className="bg-card rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-3xl font-bold text-foreground mb-8">Usuarios por sector</h2>
            {platformStatsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando sectores...</p>
            )}
            <div className="space-y-6">
              {sectorBreakdown.map((item) => (
                <div key={item.sector} className="grid grid-cols-[140px_1fr_28px] items-center gap-4">
                  <span className="text-2xl text-foreground">{item.sector}</span>
                  <div className="h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.max((item.count / maxSectorCount) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="text-2xl text-foreground text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-3xl font-bold text-foreground mb-8">Ultimos registros</h2>
            {platformStatsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 text-left text-2xl font-semibold text-foreground">Nombre</th>
                    <th className="py-3 text-left text-2xl font-semibold text-foreground">Empresa</th>
                    <th className="py-3 text-left text-2xl font-semibold text-foreground">Sector</th>
                    <th className="py-3 text-left text-2xl font-semibold text-foreground">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {latestUsers.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="py-4 text-2xl text-foreground">{item.name}</td>
                      <td className="py-4 text-2xl text-foreground">{item.company}</td>
                      <td className="py-4 text-2xl text-foreground">{item.sector || 'General'}</td>
                      <td className="py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xl font-semibold ${
                            item.role === 'supplier'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item.role === 'supplier' ? 'Proveedor' : 'Comprador'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Crear contenido</h2>
              <p className="text-sm text-muted-foreground">
                Aqui solo puedes publicar contenido para el modulo educativo.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo"
              />
              <Input value="Video educativo" disabled className="h-10" />
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setThumbnailFile(file);
                  setThumbnailPreview(file ? URL.createObjectURL(file) : '');
                }}
                className="h-10"
              />
            </div>

            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descripcion"
              className="min-h-[120px]"
            />

            <Input
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setVideoFile(file);
                setVideoPreview(file ? URL.createObjectURL(file) : '');
              }}
              className="h-10"
            />

            {thumbnailPreview && (
              <div className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground mb-2">Vista previa imagen</p>
                <img src={thumbnailPreview} alt="Preview imagen" className="max-h-44 rounded-md object-contain w-full" />
              </div>
            )}

            {videoPreview && (
              <div className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground mb-2">Vista previa video</p>
                <video src={videoPreview} controls className="max-h-56 rounded-md w-full" />
              </div>
            )}

            {createMutation.error && (
              <p className="text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'No se pudo crear el contenido'}
              </p>
            )}

            <Button
              disabled={
                createMutation.isPending ||
                !form.title.trim() ||
                !form.description.trim() ||
                !videoFile
              }
              onClick={async () => {
                const defaultCategoryId = categories[0]?.id ?? 'cat-1';
                const videoUrl = videoFile ? await toDataUrl(videoFile) : undefined;
                const thumbnailUrl = thumbnailFile ? await toDataUrl(thumbnailFile) : undefined;
                void createMutation.mutateAsync({
                  title: form.title,
                  description: form.description,
                  categoryId: defaultCategoryId,
                  type: 'educational',
                  videoUrl,
                  thumbnailUrl,
                });
              }}
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear contenido educativo'}
            </Button>
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground mb-3">Categorias activas</h2>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.slug}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Publicaciones de proveedores</h2>
            {isLoading && <p className="text-sm text-muted-foreground">Cargando contenido...</p>}
            {isError && <p className="text-sm text-destructive">No se pudo cargar el panel.</p>}
            <div className="space-y-3">
              {(data?.posts ?? []).map((post) => (
                <div key={post.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.type === 'educational' ? 'Video educativo' : 'Post comunitario'} -{' '}
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

          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Comunidad</h2>
            <div className="space-y-3">
              {(data?.comments ?? []).map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{comment.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        En {comment.postTitle} - {comment.repliesCount} respuestas
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
            </div>
          </div>
        </section>

        <section className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Usuarios</h2>
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
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
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
                          if (!membership) return 'pending';
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
        </section>
      </div>
    </MainLayout>
  );
};

export default Admin;

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import {
  adminCreatePost,
  adminDeleteComment,
  adminDeletePost,
  getAdminDashboard,
  updateUserStatus,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserStatus } from '@/types';

const Admin = () => {
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    type: 'educational' as 'educational' | 'community',
    videoUrl: '',
    thumbnailUrl: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: user?.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: adminCreatePost,
    onSuccess: () => {
      setForm({
        title: '',
        description: '',
        categoryId: '',
        type: 'educational',
        videoUrl: '',
        thumbnailUrl: '',
      });
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

        <section className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Crear contenido</h2>
              <p className="text-sm text-muted-foreground">
                Aqui puedes publicar videos educativos o posts comunitarios.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo"
              />
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as 'educational' | 'community',
                  }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="educational">Video educativo</option>
                <option value="community">Post comunitario</option>
              </select>
              <select
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Input
                value={form.thumbnailUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))
                }
                placeholder="Thumbnail URL (opcional)"
              />
            </div>

            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descripcion"
              className="min-h-[120px]"
            />

            <Input
              value={form.videoUrl}
              onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))}
              placeholder="Video URL (obligatorio para contenido educativo)"
            />

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
                !form.categoryId ||
                (form.type === 'educational' && !form.videoUrl.trim())
              }
              onClick={() =>
                void createMutation.mutateAsync({
                  title: form.title,
                  description: form.description,
                  categoryId: form.categoryId,
                  type: form.type,
                  videoUrl: form.videoUrl || undefined,
                  thumbnailUrl: form.thumbnailUrl || undefined,
                })
              }
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear contenido'}
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
            <h2 className="text-lg font-semibold text-foreground mb-4">Publicaciones y videos</h2>
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
            <h2 className="text-lg font-semibold text-foreground mb-4">Comentarios</h2>
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
                    <p className="text-sm font-semibold text-foreground">{managedUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {managedUser.company} - {managedUser.role} - {managedUser.status}
                    </p>
                  </div>
                  {managedUser.role !== 'admin' && (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default Admin;

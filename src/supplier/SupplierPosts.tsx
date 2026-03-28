import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPost, getPosts } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SupplierPosts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState('');

  const postsQuery = useQuery({
    queryKey: ['supplier-posts', user?.id],
    queryFn: () => getPosts({ type: 'community' }),
  });

  const myPosts = useMemo(
    () => (postsQuery.data ?? []).filter((post) => post.author.id === user?.id),
    [postsQuery.data, user?.id],
  );

  const createMutation = useMutation({
    mutationFn: async () =>
      createPost({
        title: title.trim(),
        description: description.trim(),
        categoryId: 'cat-3',
        type: 'community',
      }),
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setSubmitError('');
      await queryClient.invalidateQueries({ queryKey: ['supplier-posts', user?.id] });
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Publicaciones del proveedor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea actualizaciones para que los compradores conozcan tus novedades.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl p-5 space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo de la publicacion"
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe tu promocion, servicio o novedad"
          className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center rounded-md bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold"
        >
          {createMutation.isPending ? 'Publicando...' : 'Publicar'}
        </button>
        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      </form>

      {postsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando publicaciones...</p>
      )}

      <div className="space-y-3">
        {myPosts.map((post) => (
          <article key={post.id} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">{post.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{post.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(post.createdAt).toLocaleString()}
            </p>
          </article>
        ))}
        {!postsQuery.isLoading && !myPosts.length && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes publicaciones creadas.
          </p>
        )}
      </div>
    </div>
  );
};

export default SupplierPosts;

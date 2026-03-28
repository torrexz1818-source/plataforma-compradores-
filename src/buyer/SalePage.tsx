import { useMemo, useState } from 'react';
import { Search, Heart, MessageCircle, Share2, Building2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts, sendMessage, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';

const SalePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [contactOpenFor, setContactOpenFor] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['sale-feed-posts'],
    queryFn: () => getPosts({ type: 'community' }),
  });

  const filtered = useMemo(
    () =>
      posts.filter(
        (post) =>
          post.author.role === 'supplier' &&
          (post.author.company.toLowerCase().includes(search.toLowerCase()) ||
            post.description.toLowerCase().includes(search.toLowerCase()) ||
            post.title.toLowerCase().includes(search.toLowerCase())),
      ),
    [posts, search],
  );

  const likeMutation = useMutation({
    mutationFn: (postId: string) => togglePostLike(postId),
    onSuccess: async (_res, postId) => {
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (payload: { supplierId: string; postId: string; message: string }) =>
      sendMessage({
        supplierId: payload.supplierId,
        postId: payload.postId,
        message: payload.message,
      }),
    onSuccess: () => {
      setFeedback('Mensaje enviado correctamente al proveedor.');
      setMessageText('');
      setContactOpenFor(null);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const handleShare = async (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Enlace copiado al portapapeles.');
    } catch {
      setFeedback('No se pudo copiar el enlace.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Estel</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Feed de proveedores - descubre novedades y oportunidades.
        </p>
      </motion.div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar publicaciones..."
          className="pl-10"
        />
      </div>

      {feedback && (
        <p className="mb-4 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
          {feedback}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Cargando publicaciones...</p>}
      {isError && <p className="text-destructive text-sm">No se pudo cargar el feed de proveedores.</p>}

      <div className="space-y-4">
        {filtered.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg shadow-smooth overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{post.author.company}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-3">{post.description}</p>
              {post.videoUrl && (
                <div className="bg-muted rounded-md h-48 mb-3 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Contenido multimedia del proveedor</span>
                </div>
              )}
            </div>
            <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => likeMutation.mutate(post.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  post.isLiked
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-primary' : ''}`} /> {post.likes}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> {post.comments}
              </button>
              <button
                type="button"
                onClick={() => handleShare(post.id)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
              <button
                type="button"
                onClick={() => setContactOpenFor(post.id)}
                className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 transition-colors font-medium"
              >
                <Send className="w-4 h-4" /> Contactar
              </button>
            </div>

            {contactOpenFor === post.id && (
              <div className="border-t border-border px-5 py-4 bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-2">
                  Enviar mensaje a {post.author.company}
                </p>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20"
                  placeholder="Escribe tu mensaje..."
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user?.id || !messageText.trim()) {
                        return;
                      }
                      contactMutation.mutate({
                        supplierId: post.author.id,
                        postId: post.id,
                        message: messageText.trim(),
                      });
                    }}
                    disabled={contactMutation.isPending || !messageText.trim()}
                    className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {contactMutation.isPending ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactOpenFor(null);
                      setMessageText('');
                    }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">No se encontraron publicaciones.</p>
      )}
    </div>
  );
};

export default SalePage;

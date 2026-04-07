import { useMemo, useState } from 'react';
import { Search, Heart, Share2, Building2, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPosts, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/^www\./, '').replace(/\/$/, '');
  } catch {
    return url;
  }
}

const SalePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
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
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const handleShare = async (postId: string) => {
    const url = `${window.location.origin}/buyer/sale/${postId}`;
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
        <h1 className="text-2xl font-bold text-foreground mb-1">Liquidaciones</h1>
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
                  <button
                    type="button"
                    onClick={() => navigate(`/buyer/user/supplier/${post.author.id}`)}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {post.author.company}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {post.thumbnailUrl && (
              <div
                className="w-full max-h-[220px] border-y border-border overflow-hidden bg-[#f8f8f7] flex items-center justify-center"
              >
                <img
                  src={post.thumbnailUrl}
                  alt={`Imagen de ${post.title}`}
                  loading="lazy"
                  className="w-full max-h-[220px] object-contain"
                />
              </div>
            )}

            <div className="p-5">
              <h3 className="text-base font-semibold text-foreground mb-1">{post.title}</h3>
              <p
                className="text-sm text-foreground leading-relaxed mb-3"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.description}
              </p>
              {post.videoUrl && (
                <a
                  href={post.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-block mb-1 max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={post.videoUrl}
                >
                  {cleanUrl(post.videoUrl)}
                </a>
              )}
            </div>

            <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => {
                  if (user?.role !== 'buyer') {
                    setFeedback('Solo compradores pueden dar like en Liquidaciones.');
                    return;
                  }
                  if (post.isLiked) {
                    setFeedback('Ya diste like a esta publicacion.');
                    return;
                  }
                  likeMutation.mutate(post.id);
                }}
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
                onClick={() => handleShare(post.id)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
              <button
                type="button"
                onClick={() => navigate(`/buyer/sale/${post.id}`)}
                className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 transition-colors font-medium"
              >
                <Info className="w-4 h-4" /> Mas informacion
              </button>
            </div>
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

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, Heart, Share2, Building2, Info, ImagePlus, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPost, getPosts, resolveApiAssetUrl, togglePostLike, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { isBuyerLikeRole } from '@/lib/roles';

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/^www\./, '').replace(/\/$/, '');
  } catch {
    return url;
  }
}

function isLiquidationPost(title: string, description: string, categorySlug: string) {
  if (categorySlug === 'liquidaciones') {
    return true;
  }

  const haystack = `${title} ${description}`.toLowerCase();
  return [
    'liquidacion',
    'venta de',
    'stock',
    'ultimas',
    'ultimos',
    'unidades',
    'palet',
    'palets',
    'pallet',
    'pallets',
    'dispensador',
    'dispensadores',
  ].some((keyword) => haystack.includes(keyword));
}

const SalePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const canPublishLiquidation = isBuyerLikeRole(user?.role) || user?.role === 'supplier';

  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['sale-feed-posts'],
    queryFn: () => getPosts({ type: 'liquidation' }),
  });

  const filtered = useMemo(
    () =>
      posts.filter(
        (post) =>
          isLiquidationPost(post.title, post.description, post.category.slug) &&
          (post.author.company.toLowerCase().includes(search.toLowerCase()) ||
            post.description.toLowerCase().includes(search.toLowerCase()) ||
            post.title.toLowerCase().includes(search.toLowerCase())),
      ),
    [posts, search],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const uploadedImage = imagen ? await uploadFile(imagen, 'posts') : null;

      return createPost({
        title: titulo.trim() || 'Liquidacion',
        description: descripcion.trim() || 'Sin descripcion.',
        categoryId: 'cat-6',
        type: 'liquidation',
        videoUrl: url.trim() || undefined,
        thumbnailUrl: uploadedImage?.url,
      });
    },
    onSuccess: async () => {
      setFeedback('Liquidacion publicada exitosamente.');
      setTitulo('');
      setDescripcion('');
      setUrl('');
      setImagen(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

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
    const basePath = user?.role === 'supplier' ? '/supplier/sale' : '/buyer/sale';
    const url = `${window.location.origin}${basePath}/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Enlace copiado al portapapeles.');
    } catch {
      setFeedback('No se pudo copiar el enlace.');
    }
  };

  const handleImagen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      setImagen(file);
      setPreview(URL.createObjectURL(file));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la imagen.');
    }
  };

  const handlePublicar = () => {
    if (!titulo.trim() && !descripcion.trim()) {
      return;
    }

    createMutation.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-brand relative mb-6 overflow-hidden rounded-[28px] p-5 shadow-[var(--shadow-purple)] sm:p-8"
        style={{ background: 'var(--gradient-brand)' }}
      >
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-24 bottom-[-42px] h-32 w-32 rounded-full bg-secondary/10 blur-2xl" />
        <div className="hero-radial-light pointer-events-none absolute inset-y-0 right-0 w-[42%]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/85">
              Oportunidades stock
            </div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl lg:text-4xl">
              Liquidaciones de inventario
            </h1>
            <p className="max-w-xl text-sm leading-6 text-primary-foreground/85 sm:text-base sm:leading-7 lg:text-lg">
              Publica oportunidades de stock y encuentra oportunidades activas en una vista clara.
            </p>
          </div>

          <a
            href="#liquidation-feed"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2 text-center text-sm font-medium text-[#0E109E] shadow-sm transition-colors hover:bg-white/95 sm:px-8"
          >
            Explorar oportunidades <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </motion.section>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar publicaciones..."
          className="pl-10"
        />
      </div>

      {canPublishLiquidation && (
        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="mb-1 text-lg font-medium text-foreground">Publicar liquidacion</h2>
            <p className="text-sm text-muted-foreground">
            Comparte una oportunidad disponible manteniendo la misma estructura del feed.
            </p>
          </div>

          <Input
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Titulo de la liquidacion"
            className="mb-3 h-11 rounded-xl"
          />

          <Textarea
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Describe el stock, condiciones, cantidades o vigencia"
            rows={4}
            className="mb-3 resize-none rounded-xl"
          />

          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="URL del producto o sitio (opcional)"
            className="mb-4 h-11 rounded-xl"
          />

          {preview && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-muted/30">
              <img src={preview} alt="Preview" className="mx-auto max-h-64 w-full object-contain" />
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="group inline-flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/10 sm:w-fit">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {imagen ? <CheckCircle2 className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
              </span>
              <span className="flex flex-col">
                <span>{imagen ? 'Imagen seleccionada' : 'Agregar imagen'}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {imagen ? imagen.name : 'PNG, JPG o WEBP para destacar la publicacion'}
                </span>
              </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImagen} />
            </label>

            <Button
              onClick={handlePublicar}
              disabled={createMutation.isPending || (!titulo.trim() && !descripcion.trim())}
              size="sm"
              className="h-11 w-full rounded-xl px-5 sm:w-auto"
            >
              {createMutation.isPending ? 'Publicando...' : 'Publicar liquidacion'}
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p className="mb-4 text-sm rounded-md border border-success/25 bg-success/15 text-success-foreground px-3 py-2">
          {feedback}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Cargando publicaciones...</p>}
      {isError && <p className="text-destructive text-sm">No se pudo cargar el feed de oportunidades de stock.</p>}

      <div id="liquidation-feed" className="space-y-4">
        {filtered.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl shadow-sm overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/perfil/${post.author.role}/${post.author.id}`)}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
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
                className="w-full max-h-[220px] border-y border-border overflow-hidden bg-primary/5 flex items-center justify-center"
              >
                <img
                  src={resolveApiAssetUrl(post.thumbnailUrl)}
                  alt={`Imagen de ${post.title}`}
                  loading="lazy"
                  className="w-full max-h-[220px] object-contain"
                />
              </div>
            )}

            <div className="p-5">
              <h3 className="text-base font-medium text-foreground mb-1">{post.title}</h3>
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
                  if (!isBuyerLikeRole(user?.role)) {
                    setFeedback('Solo compradores o expertos pueden dar like en Oportunidades de stock.');
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
                    ? 'text-red-600 font-medium'
                    : 'text-muted-foreground hover:text-red-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-red-600' : ''}`} /> {post.likes}
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
                onClick={() =>
                  navigate(user?.role === 'supplier' ? `/supplier/sale/${post.id}` : `/buyer/sale/${post.id}`)
                }
                className="flex items-center gap-1.5 text-sm text-success-foreground hover:text-success-foreground transition-colors font-medium"
              >
                <Info className="w-4 h-4" /> Mas informacion
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">No se encontraron oportunidades de stock activas.</p>
      )}
    </div>
  );
};

export default SalePage;

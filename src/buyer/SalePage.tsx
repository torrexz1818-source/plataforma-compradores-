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

type SaleSegment = 'offer' | 'requirement';

const saleSegments: Array<{
  id: SaleSegment;
  label: string;
  title: string;
  description: string;
  publishTitle: string;
  publishButton: string;
  emptyMessage: string;
  accent: string;
  softAccent: string;
}> = [
  {
    id: 'offer',
    label: 'Publicaciones de ofertas',
    title: 'Ofertas',
    description: 'Publicaciones de ofertas y oportunidades de stock. Compradores y proveedores pueden publicar y comentar.',
    publishTitle: 'Publicar oferta',
    publishButton: 'Publicar oferta',
    emptyMessage: 'No se encontraron ofertas activas.',
    accent: '#0E109E',
    softAccent: '#E6ECFF',
  },
  {
    id: 'requirement',
    label: 'Requerimientos',
    title: 'Requerimientos',
    description: 'Solicitudes publicadas por compradores. Los proveedores pueden comentar y responder con alternativas.',
    publishTitle: 'Publicar requerimiento',
    publishButton: 'Publicar requerimiento',
    emptyMessage: 'No se encontraron requerimientos activos.',
    accent: '#5A31D5',
    softAccent: '#EEE8FF',
  },
];

const saleModuleTitle = 'Ofertas y requerimientos';
const saleModuleDescription = 'Convierte tu inventario inmovilizado en oportunidades de venta y publica tus requerimientos.';

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
  const [activeSegment, setActiveSegment] = useState<SaleSegment>('offer');
  const activeSegmentConfig = saleSegments.find((segment) => segment.id === activeSegment) ?? saleSegments[0];
  const activePostType = activeSegment === 'requirement' ? 'requirement' : 'liquidation';
  const canPublish = activeSegment === 'requirement'
    ? isBuyerLikeRole(user?.role)
    : isBuyerLikeRole(user?.role) || user?.role === 'supplier';

  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['sale-feed-posts', activePostType],
    queryFn: () => getPosts({ type: activePostType }),
  });

  const filtered = useMemo(
    () =>
      posts.filter(
        (post) =>
          (activeSegment === 'requirement' || isLiquidationPost(post.title, post.description, post.category.slug)) &&
          (post.author.company.toLowerCase().includes(search.toLowerCase()) ||
            post.description.toLowerCase().includes(search.toLowerCase()) ||
            post.title.toLowerCase().includes(search.toLowerCase())),
      ),
    [activeSegment, posts, search],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const uploadedImage = imagen ? await uploadFile(imagen, 'posts') : null;

      return createPost({
        title: titulo.trim() || (activeSegment === 'requirement' ? 'Requerimiento' : 'Oferta'),
        description: descripcion.trim() || 'Sin descripcion.',
        categoryId: 'cat-6',
        type: activePostType,
        videoUrl: url.trim() || undefined,
        thumbnailUrl: uploadedImage?.url,
      });
    },
    onSuccess: async () => {
      setFeedback(activeSegment === 'requirement' ? 'Requerimiento publicado exitosamente.' : 'Oferta publicada exitosamente.');
      setTitulo('');
      setDescripcion('');
      setUrl('');
      setImagen(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts', activePostType] });
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
    const url = `${window.location.origin}${basePath}/${postId}?segment=${activeSegment}`;
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
              {saleModuleTitle}
            </div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl lg:text-4xl">
              Economía circular
            </h1>
            <p className="max-w-xl text-sm leading-6 text-primary-foreground/85 sm:text-base sm:leading-7 lg:text-lg">
              {saleModuleDescription}
            </p>
          </div>

          <a
            href="#liquidation-feed"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2 text-center text-sm font-medium text-[#0E109E] shadow-sm transition-colors hover:bg-white/95 sm:px-8"
          >
            Explorar publicaciones <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </motion.section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {saleSegments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => {
              setActiveSegment(segment.id);
              setFeedback('');
            }}
            className={`rounded-2xl border p-4 text-left transition-all ${
              activeSegment === segment.id
                ? 'border-transparent text-primary-foreground shadow-[0_18px_42px_rgba(14,16,158,0.18)]'
                : 'border-primary/10 bg-white/85 text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_16px_34px_rgba(14,16,158,0.10)]'
            }`}
            style={activeSegment === segment.id ? { backgroundColor: segment.accent } : undefined}
          >
            <span
              className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                activeSegment === segment.id ? 'bg-white/15 text-white' : 'text-primary'
              }`}
              style={activeSegment === segment.id ? undefined : { backgroundColor: segment.softAccent }}
            >
              {segment.id === 'offer' ? 'Oferta' : 'Requerimiento'}
            </span>
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{segment.label}</span>
            <span className="mt-2 block text-lg font-semibold">{segment.title}</span>
            <span className={`mt-1 block text-sm leading-6 ${activeSegment === segment.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {segment.description}
            </span>
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/55" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar publicaciones..."
          className="h-12 rounded-2xl border-primary/10 bg-white/90 pl-11 shadow-sm transition-all focus-visible:ring-primary/20"
        />
      </div>

      {canPublish && (
        <div className="mb-6 rounded-3xl bg-white/95 p-5 shadow-[0_18px_52px_rgba(14,16,158,0.08)] ring-1 ring-primary/10">
          <div className="mb-4">
            <h2 className="mb-1 text-lg font-medium text-foreground">{activeSegmentConfig.publishTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {activeSegment === 'requirement'
                ? 'Describe lo que necesita tu empresa para que los proveedores puedan comentar.'
                : 'Comparte una oferta disponible manteniendo la misma estructura del feed.'}
            </p>
          </div>

          <Input
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder={activeSegment === 'requirement' ? 'Titulo del requerimiento' : 'Titulo de la oferta'}
            className="mb-3 h-11 rounded-xl border-primary/15 bg-[#F8FAFF] focus-visible:ring-primary/20"
          />

          <Textarea
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder={activeSegment === 'requirement' ? 'Describe necesidad, cantidades, plazos o criterios de compra' : 'Describe el stock, condiciones, cantidades o vigencia'}
            rows={4}
            className="mb-3 resize-none rounded-xl border-primary/15 bg-[#F8FAFF] focus-visible:ring-primary/20"
          />

          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="URL del producto o sitio (opcional)"
            className="mb-4 h-11 rounded-xl border-primary/15 bg-[#F8FAFF] focus-visible:ring-primary/20"
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
              className="h-11 w-full rounded-xl bg-primary px-5 text-primary-foreground shadow-[0_12px_24px_rgba(14,16,158,0.16)] transition-all hover:-translate-y-0.5 hover:bg-primary/95 active:translate-y-0 sm:w-auto"
            >
              {createMutation.isPending ? 'Publicando...' : activeSegmentConfig.publishButton}
            </Button>
          </div>
        </div>
      )}

      {!canPublish && (
        <p className="mb-6 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary">
          Los requerimientos solo pueden ser publicados por compradores. Como proveedor puedes comentarlos desde el detalle.
        </p>
      )}

      {feedback && (
        <p className="mb-4 text-sm rounded-md border border-success/25 bg-success/15 text-success-foreground px-3 py-2">
          {feedback}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Cargando publicaciones...</p>}
      {isError && <p className="text-destructive text-sm">No se pudo cargar el feed de ofertas.</p>}

      <div id="liquidation-feed" className="space-y-4">
        {filtered.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="overflow-hidden rounded-[26px] bg-white/95 shadow-[0_18px_52px_rgba(14,16,158,0.09)] ring-1 ring-white/75 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(14,16,158,0.13)]"
          >
            <div className="p-5 pb-4 sm:p-6 sm:pb-5">
              <div className="mb-5 flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2620bf,#5a31d5)] text-sm font-semibold text-white shadow-[0_12px_26px_rgba(14,16,158,0.20)] ring-4 ring-[rgba(14,16,158,0.07)]">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/perfil/${post.author.role}/${post.author.id}`)}
                    className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {post.author.company}
                  </button>
                  <p className="text-xs text-[rgba(14,16,158,0.58)]">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {post.thumbnailUrl && (
              <div
                className="flex h-72 w-full items-center justify-center overflow-hidden bg-primary/5 sm:h-80"
              >
                <img
                  src={resolveApiAssetUrl(post.thumbnailUrl)}
                  alt={`Imagen de ${post.title}`}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            <div className="px-5 py-4 sm:px-6">
              <h3 className="mb-2 text-xl font-bold leading-snug tracking-tight text-foreground">{post.title}</h3>
              <p
                className="mb-3 text-sm leading-7 text-foreground/80 sm:text-[15px]"
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
                  className="mb-1 inline-block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  title={post.videoUrl}
                >
                  {cleanUrl(post.videoUrl)}
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-[rgba(14,16,158,0.025)] p-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  if (!isBuyerLikeRole(user?.role)) {
                    setFeedback('Solo compradores o expertos pueden dar like en ofertas.');
                    return;
                  }
                  if (post.isLiked) {
                    setFeedback('Ya diste like a esta publicacion.');
                    return;
                  }
                  likeMutation.mutate(post.id);
                }}
                className={`flex items-center gap-1.5 rounded-2xl bg-white/85 px-3 py-2.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                  post.isLiked
                    ? 'text-red-600'
                    : 'text-[#0E109E] hover:bg-[rgba(247,42,58,0.12)] hover:text-red-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-red-600' : ''}`} /> {post.likes}
              </button>
              <button
                type="button"
                onClick={() => handleShare(post.id)}
                className="flex items-center gap-1.5 rounded-2xl bg-white/85 px-3 py-2.5 text-sm font-medium text-[#1D1AAE] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#E6ECFF] hover:text-[#1512A8] active:translate-y-0"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`${user?.role === 'supplier' ? `/supplier/sale/${post.id}` : `/buyer/sale/${post.id}`}?segment=${activeSegment}`)
                }
                className="flex items-center gap-1.5 rounded-2xl bg-[#B2EB4A] px-3 py-2.5 text-sm font-semibold text-[#0E109E] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#c4f56c] active:translate-y-0"
              >
                <Info className="w-4 h-4" /> Mas informacion
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">{activeSegmentConfig.emptyMessage}</p>
      )}
    </div>
  );
};

export default SalePage;

import { useMemo, useState } from 'react';
import { Heart, MapPin, Star, Send, ExternalLink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import BackButton from '@/components/BackButton';
import CommentSection from '@/components/CommentSection';
import {
  createConversation,
  getBuyerById,
  getConversationByPair,
  getPostDetail,
  getPosts,
  getSupplierById,
  resolveApiAssetUrl,
  sendConversationMessage,
  togglePostLike,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isBuyerLikeRole } from '@/lib/roles';

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

const SaleDetailPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState('');
  const requestedSegment = searchParams.get('segment') === 'requirement'
    ? 'requirement'
    : searchParams.get('segment') === 'offer'
      ? 'offer'
      : null;

  const { data: posts = [] } = useQuery({
    queryKey: ['sale-feed-posts', 'all-segments'],
    queryFn: async () => {
      const [offers, requirements] = await Promise.all([
        getPosts({ type: 'liquidation' }),
        getPosts({ type: 'requirement' }),
      ]);
      return [...offers, ...requirements];
    },
  });

  const salePosts = useMemo(
    () =>
      posts.filter((post) => post.type === 'requirement' || isLiquidationPost(post.title, post.description, post.category.slug)),
    [posts],
  );

  const selectedPost = useMemo(
    () => {
      const postById = salePosts.find((post) => post.id === id);
      if (postById) return postById;

      if (requestedSegment === 'requirement') {
        return salePosts.find((post) => post.type === 'requirement') ?? null;
      }

      if (requestedSegment === 'offer') {
        return salePosts.find((post) => post.type !== 'requirement') ?? null;
      }

      return salePosts[0] ?? null;
    },
    [salePosts, id, requestedSegment],
  );

  const saleListPath = user?.role === 'supplier' ? '/supplier/sale' : '/buyer/sale';
  const isSupplierAuthor = selectedPost?.author.role === 'supplier';

  const postDetailQuery = useQuery({
    queryKey: ['post-detail', selectedPost?.id],
    queryFn: () => getPostDetail(selectedPost?.id ?? ''),
    enabled: Boolean(selectedPost?.id),
  });

  const authorProfileQuery = useQuery({
    queryKey: ['sale-author-profile', selectedPost?.author.role, selectedPost?.author.id],
    queryFn: () =>
      isSupplierAuthor
        ? getSupplierById(selectedPost?.author.id ?? '')
        : getBuyerById(selectedPost?.author.id ?? ''),
    enabled: Boolean(selectedPost?.author.id),
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => togglePostLike(postId),
    onSuccess: async (_res, postId) => {
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPost || !mensaje.trim()) {
        return;
      }
      if (!user?.id) {
        throw new Error('Sesion no disponible');
      }
      if (user.role === selectedPost.author.role) {
        throw new Error('Solo puedes contactar publicaciones del perfil opuesto.');
      }

      const buyerId = selectedPost.author.role === 'buyer' ? selectedPost.author.id : user.id;
      const supplierId = selectedPost.author.role === 'supplier' ? selectedPost.author.id : user.id;
      const existing = await getConversationByPair(buyerId, supplierId, selectedPost.id);
      const conversation = existing ?? await createConversation({
        toUserId: selectedPost.author.id,
        publicationId: selectedPost.id,
      });

      await sendConversationMessage(conversation.id, {
        message: mensaje.trim(),
        attachments: [
          {
            id: crypto.randomUUID(),
            kind: 'publication',
            name: selectedPost.title,
            publicationId: selectedPost.id,
            description: selectedPost.description,
            thumbnailUrl: selectedPost.thumbnailUrl,
          },
        ],
      });
      return conversation;
    },
    onSuccess: (conversation) => {
      setMensaje('');
      setFeedback('');
      navigate(`/mensajes?conversationId=${conversation.id}`);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  if (!selectedPost) {
    return <p className="text-sm text-muted-foreground px-6 py-8">No hay ofertas o requerimientos activos.</p>;
  }

  const authorProfile = authorProfileQuery.data;
  const comments = postDetailQuery.data?.comments ?? [];
  const authorRoleLabel = isSupplierAuthor ? 'proveedor' : 'comprador';
  const canContact = user?.role !== selectedPost.author.role && user?.role !== 'admin';
  const isRequirement = selectedPost.type === 'requirement';
  const currentSegment = isRequirement ? 'requirement' : 'offer';
  const visiblePosts = salePosts.filter((post) =>
    isRequirement
      ? post.type === 'requirement'
      : post.type !== 'requirement',
  );
  const pageTitle = isRequirement ? 'Requerimientos' : 'Ofertas';
  const canComment = isRequirement
    ? user?.role === 'supplier'
    : (isBuyerLikeRole(user?.role) || user?.role === 'supplier');
  const segmentLabel = isRequirement ? 'Requerimiento' : 'Oferta';
  const segmentAccentClass = isRequirement
    ? 'bg-[#5A31D5] text-white ring-[#5A31D5]/25'
    : 'bg-[#B2EB4A] text-[#0E109E] ring-[#B2EB4A]/40';
  const segmentSoftClass = isRequirement
    ? 'bg-[#EEE8FF] text-[#5A31D5] ring-[#5A31D5]/15'
    : 'bg-[#E6ECFF] text-primary ring-primary/15';

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <BackButton fallback={saleListPath} className="mb-4" />
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{pageTitle}</h1>
        </div>
        <Badge className={`w-fit rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 ${segmentSoftClass}`}>
          {visiblePosts.length} publicaciones activas
        </Badge>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-[22px] bg-white/80 p-2 shadow-[0_14px_32px_rgba(14,16,158,0.07)] ring-1 ring-primary/10 [scrollbar-width:thin]">
        {visiblePosts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(`${user?.role === 'supplier' ? `/supplier/sale/${post.id}` : `/buyer/sale/${post.id}`}?segment=${currentSegment}`)}
            className={`flex min-w-[132px] flex-shrink-0 items-center rounded-2xl px-3 py-2 text-left text-sm font-medium transition-all ${
              selectedPost.id === post.id
                ? `${isRequirement ? 'bg-[#5A31D5]' : 'bg-primary'} text-white shadow-[0_12px_24px_rgba(14,16,158,0.18)]`
                : `${isRequirement ? 'text-[#5A31D5] ring-[#5A31D5]/15 hover:bg-[#EEE8FF]' : 'text-primary ring-primary/10 hover:bg-primary/5'} bg-white ring-1 hover:-translate-y-0.5`
            }`}
          >
            <span className="truncate text-sm font-semibold">{post.author.company}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[0.95fr_1.25fr_1.15fr]">
        <div className="group flex min-h-[420px] h-full items-center justify-center overflow-hidden rounded-[24px] bg-card shadow-[0_18px_52px_rgba(14,16,158,0.08)] ring-1 ring-white/70 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(14,16,158,0.12)]">
          {selectedPost.thumbnailUrl ? (
            <img
              src={resolveApiAssetUrl(selectedPost.thumbnailUrl)}
              alt="Publicacion"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#EEF3FF,#F8FAFF)]">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${segmentSoftClass}`}>
                {segmentLabel}
              </span>
              <span className="text-sm font-medium text-primary/60">Sin imagen</span>
            </div>
          )}
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-[24px] bg-card shadow-[0_18px_52px_rgba(14,16,158,0.08)] ring-1 ring-white/70 transition-all hover:shadow-[0_24px_64px_rgba(14,16,158,0.11)]">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-1 ${segmentSoftClass}`}>
              {selectedPost.author.company.charAt(0)}
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate(`/perfil/${selectedPost.author.role}/${selectedPost.author.id}`)}
                className="text-sm font-semibold text-foreground leading-tight hover:text-primary"
              >
                {selectedPost.author.company}
              </button>
              <p className="text-xs text-muted-foreground">{authorProfile?.location ?? 'Sin ubicacion'}</p>
            </div>
          </div>

          <div className="px-5 py-3 flex-1">
            <Badge variant="secondary" className={`mb-3 rounded-full px-3 text-xs font-semibold ring-1 ${segmentAccentClass}`}>
              {segmentLabel}
            </Badge>
            <h2 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-foreground">{selectedPost.title}</h2>
            <p className="rounded-2xl bg-[#F8FAFF] px-4 py-3 text-sm leading-7 text-foreground/85 ring-1 ring-primary/10">
              {selectedPost.description}
            </p>
            {selectedPost.videoUrl && (
              <a
                href={selectedPost.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/10 transition-all hover:-translate-y-0.5 hover:bg-primary/5"
              >
                Ver enlace de la publicacion <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="px-5 pb-4 pt-3">
            <p className="text-xs font-medium text-primary mb-2">
              {canContact ? `Contactar ${authorRoleLabel}` : `Publicacion del ${authorRoleLabel}`}
            </p>
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={`Escribe tu mensaje para contactar al ${authorRoleLabel}...`}
              className="mb-3 resize-none rounded-2xl border-primary/15 bg-[#F8FAFF] text-sm shadow-none focus-visible:ring-primary/25"
              rows={3}
            />
            <Button
              size="sm"
              className="w-full rounded-full bg-[#B2EB4A] font-semibold text-[#0E109E] shadow-[0_10px_22px_rgba(178,235,74,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#c4f56c] active:translate-y-0 disabled:opacity-60"
              onClick={() => {
                if (!canContact) {
                  setFeedback(`Solo el perfil opuesto puede contactar a este ${authorRoleLabel}.`);
                  return;
                }
                contactMutation.mutate();
              }}
              disabled={!mensaje.trim() || contactMutation.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {contactMutation.isPending ? 'Enviando...' : `Contactar ${authorRoleLabel}`}
            </Button>
          </div>

          <div className="px-5 pb-5 pt-1 flex items-center gap-2">
            <button
              onClick={() => {
                if (user?.role !== 'buyer') {
                  setFeedback('Solo compradores pueden dar like en ofertas.');
                  return;
                }
                if (selectedPost.isLiked) {
                  setFeedback('Ya diste like a esta publicacion.');
                  return;
                }
                likeMutation.mutate(selectedPost.id);
              }}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 active:translate-y-0"
            >
              <Heart
                className={`w-4 h-4 ${
                  selectedPost.isLiked ? 'fill-red-600 text-red-600' : ''
                }`}
              />
              <span className={`font-medium ${selectedPost.isLiked ? 'text-red-600' : 'text-foreground'}`}>
                {selectedPost.likes.toLocaleString()} Me gusta
              </span>
            </button>
            <span className="text-xs text-muted-foreground">
              - {new Date(selectedPost.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex h-full flex-col gap-4">
          <div className="rounded-[24px] bg-card p-4 shadow-[0_18px_52px_rgba(14,16,158,0.08)] ring-1 ring-white/70 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(14,16,158,0.11)]">
            <button
              type="button"
              onClick={() => navigate(`/perfil/${selectedPost.author.role}/${selectedPost.author.id}`)}
              className="font-semibold text-foreground mb-1 hover:text-primary"
            >
              {selectedPost.author.company}
            </button>
            <p className="text-xs text-muted-foreground mb-3">
              {authorProfile?.description ?? 'Sin descripcion registrada.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
              {authorProfile?.location ?? 'Sin ubicacion'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className={`rounded-full px-3 text-xs ring-1 ${segmentSoftClass}`}>
                {authorProfile?.sector ?? selectedPost.author.sector ?? 'General'}
              </Badge>
              {isSupplierAuthor && authorProfile && 'averageRating' in authorProfile && 'reviewsCount' in authorProfile && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3.5 h-3.5 fill-destructive text-destructive" />
                  <span className="font-medium text-foreground">{authorProfile.averageRating ?? 0}</span>
                  <span>({authorProfile.reviewsCount ?? 0})</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 rounded-[24px] bg-card p-4 shadow-[0_18px_52px_rgba(14,16,158,0.08)] ring-1 ring-white/70 transition-all hover:shadow-[0_24px_64px_rgba(14,16,158,0.11)]">
            <CommentSection
              postId={selectedPost.id}
              comments={comments}
              title={isRequirement ? 'Comentarios de proveedores' : 'Comentarios'}
              emptyMessage={isRequirement ? 'Aun no hay respuestas de proveedores.' : 'Aun no hay comentarios para esta oferta.'}
              composerPlaceholder={isRequirement ? 'Comenta tu propuesta, disponibilidad o alternativa...' : 'Escribe un comentario sobre esta oferta...'}
              canComment={canComment}
              commentDisabledMessage={
                isRequirement
                  ? 'Solo los proveedores pueden comentar en requerimientos.'
                  : 'Solo compradores, expertos y proveedores pueden comentar en ofertas.'
              }
              onCommentAdded={() => {
                void queryClient.invalidateQueries({ queryKey: ['post-detail', selectedPost.id] });
              }}
            />
          </div>
        </div>
      </div>

      {!!feedback && (
        <p className="mt-4 text-sm rounded-md border border-success/25 bg-success/15 text-success-foreground px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default SaleDetailPage;

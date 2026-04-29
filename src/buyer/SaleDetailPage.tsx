import { useMemo, useState } from 'react';
import { Heart, MapPin, Star, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import BackButton from '@/components/BackButton';
import {
  createConversation,
  getBuyerById,
  getConversationByPair,
  getPostDetail,
  getPosts,
  getSupplierById,
  getSupplierReviews,
  resolveApiAssetUrl,
  sendConversationMessage,
  togglePostLike,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data: posts = [] } = useQuery({
    queryKey: ['sale-feed-posts'],
    queryFn: () => getPosts({ type: 'liquidation' }),
  });

  const liquidationPosts = useMemo(
    () =>
      posts.filter((post) => isLiquidationPost(post.title, post.description, post.category.slug)),
    [posts],
  );

  const selectedPost = useMemo(
    () => liquidationPosts.find((post) => post.id === id) ?? liquidationPosts[0] ?? null,
    [liquidationPosts, id],
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

  const supplierReviewsQuery = useQuery({
    queryKey: ['supplier-reviews', selectedPost?.author.id],
    queryFn: () => getSupplierReviews(selectedPost?.author.id ?? ''),
    enabled: Boolean(selectedPost?.author.id && isSupplierAuthor),
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
    return <p className="text-sm text-muted-foreground px-6 py-8">No hay oportunidades de stock activas.</p>;
  }

  const authorProfile = authorProfileQuery.data;
  const supplierReviews = supplierReviewsQuery.data ?? [];
  const comments = postDetailQuery.data?.comments ?? [];
  const authorRoleLabel = isSupplierAuthor ? 'proveedor' : 'comprador';
  const canContact = user?.role !== selectedPost.author.role && user?.role !== 'admin';

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <BackButton fallback={saleListPath} className="mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-6">Oportunidades de stock</h1>

      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {liquidationPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(user?.role === 'supplier' ? `/supplier/sale/${post.id}` : `/buyer/sale/${post.id}`)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selectedPost.id === post.id
                ? 'border-primary/25 bg-primary/10 text-primary shadow-[0_8px_18px_rgba(14,16,158,0.08)] hover:bg-primary/15 active:bg-primary/20'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {post.author.company}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-4 items-start">
        <div className="bg-card rounded-xl overflow-hidden min-h-[420px] flex items-center justify-center">
          {selectedPost.thumbnailUrl ? (
            <img
              src={resolveApiAssetUrl(selectedPost.thumbnailUrl)}
              alt="Publicacion"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[420px] bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Sin imagen</span>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
              {selectedPost.author.company.charAt(0)}
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate(`/perfil/${selectedPost.author.role}/${selectedPost.author.id}`)}
                className="text-sm font-medium text-foreground leading-tight hover:text-primary"
              >
                {selectedPost.author.company}
              </button>
              <p className="text-xs text-muted-foreground">{authorProfile?.location ?? 'Sin ubicacion'}</p>
            </div>
          </div>

          <div className="px-4 py-4 flex-1">
            <p className="text-sm text-foreground leading-relaxed">
              {selectedPost.description}
            </p>
            {selectedPost.videoUrl && (
              <a
                href={selectedPost.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline inline-block mt-3"
              >
                Ver enlace de la publicacion
              </a>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {canContact ? `Contactar ${authorRoleLabel}` : `Publicacion del ${authorRoleLabel}`}
            </p>
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={`Escribe tu mensaje para contactar al ${authorRoleLabel}...`}
              className="text-sm resize-none mb-2"
              rows={3}
            />
            <Button
              size="sm"
              className="w-full"
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

          <div className="px-4 py-3 border-t border-border flex items-center gap-2">
            <button
              onClick={() => {
                if (user?.role !== 'buyer') {
                  setFeedback('Solo compradores pueden dar like en Oportunidades de stock.');
                  return;
                }
                if (selectedPost.isLiked) {
                  setFeedback('Ya diste like a esta publicacion.');
                  return;
                }
                likeMutation.mutate(selectedPost.id);
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors"
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
              · {new Date(selectedPost.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card rounded-xl p-4">
            <button
              type="button"
              onClick={() => navigate(`/perfil/${selectedPost.author.role}/${selectedPost.author.id}`)}
              className="font-medium text-foreground mb-1 hover:text-primary"
            >
              {selectedPost.author.company}
            </button>
            <p className="text-xs text-muted-foreground mb-3">
              {authorProfile?.description ?? 'Sin descripcion registrada.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {authorProfile?.location ?? 'Sin ubicacion'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
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

          <div className="bg-card rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">
              {isSupplierAuthor ? 'Comentarios de compradores' : 'Comentarios de la publicacion'}
            </p>
            <div className="flex flex-col gap-3">
              {isSupplierAuthor && supplierReviews.length > 0
                ? supplierReviews.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                        {c.buyer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {c.buyer.name}
                          </p>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Star className="w-3 h-3 fill-destructive text-destructive" />
                            <span className="text-xs text-muted-foreground">{c.rating}.0</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/perfil/buyer/${c.buyer.id}`)}
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          {c.buyer.company}
                        </button>
                        <p className="text-xs text-foreground mt-0.5">{c.comment}</p>
                      </div>
                    </div>
                  ))
                : comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                        {c.user.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (c.user.role === 'buyer' || c.user.role === 'supplier') {
                              navigate(`/perfil/${c.user.role}/${c.user.id}`);
                            }
                          }}
                          className="text-xs font-medium text-foreground truncate hover:text-primary"
                        >
                          {c.user.fullName}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (c.user.role === 'buyer' || c.user.role === 'supplier') {
                              navigate(`/perfil/${c.user.role}/${c.user.id}`);
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          {c.user.company}
                        </button>
                        <p className="text-xs text-foreground mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
              {!isSupplierAuthor && comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aun no hay comentarios para esta publicacion.
                </p>
              )}
              {isSupplierAuthor && supplierReviews.length === 0 && comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aun no hay comentarios para este proveedor.
                </p>
              )}
            </div>
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

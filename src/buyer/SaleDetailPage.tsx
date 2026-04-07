import { useMemo, useState } from 'react';
import { Heart, MapPin, Star, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  getPostDetail,
  getPosts,
  getSupplierById,
  getSupplierReviews,
  sendMessage,
  togglePostLike,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SaleDetailPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { id = '' } = useParams();
  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data: posts = [] } = useQuery({
    queryKey: ['sale-feed-posts'],
    queryFn: () => getPosts({ type: 'community' }),
  });

  const supplierPosts = useMemo(
    () => posts.filter((post) => post.author.role === 'supplier'),
    [posts],
  );

  const selectedPost = useMemo(
    () => supplierPosts.find((post) => post.id === id) ?? supplierPosts[0] ?? null,
    [supplierPosts, id],
  );

  const postDetailQuery = useQuery({
    queryKey: ['post-detail', selectedPost?.id],
    queryFn: () => getPostDetail(selectedPost?.id ?? ''),
    enabled: Boolean(selectedPost?.id),
  });

  const supplierProfileQuery = useQuery({
    queryKey: ['supplier-profile', selectedPost?.author.id],
    queryFn: () => getSupplierById(selectedPost?.author.id ?? ''),
    enabled: Boolean(selectedPost?.author.id),
  });

  const supplierReviewsQuery = useQuery({
    queryKey: ['supplier-reviews', selectedPost?.author.id],
    queryFn: () => getSupplierReviews(selectedPost?.author.id ?? ''),
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
      return sendMessage({
        supplierId: selectedPost.author.id,
        publicationId: selectedPost.id,
        message: mensaje.trim(),
      });
    },
    onSuccess: () => {
      setFeedback('Mensaje enviado al proveedor.');
      setMensaje('');
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  if (!selectedPost) {
    return <p className="text-sm text-muted-foreground px-6 py-8">No hay publicaciones de proveedores.</p>;
  }

  const supplier = supplierProfileQuery.data;
  const supplierReviews = supplierReviewsQuery.data ?? [];
  const comments = postDetailQuery.data?.comments ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Liquidaciones</h1>

      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {supplierPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(`/buyer/sale/${post.id}`)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selectedPost.id === post.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {post.author.company}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-4 items-start">
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[420px] flex items-center justify-center">
          {selectedPost.thumbnailUrl ? (
            <img
              src={selectedPost.thumbnailUrl}
              alt="Publicacion"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[420px] bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Sin imagen</span>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
              {selectedPost.author.company.charAt(0)}
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate(`/buyer/user/supplier/${selectedPost.author.id}`)}
                className="text-sm font-semibold text-foreground leading-tight hover:text-primary"
              >
                {selectedPost.author.company}
              </button>
              <p className="text-xs text-muted-foreground">{supplier?.location ?? 'Sin ubicacion'}</p>
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
                Ver enlace del proveedor
              </a>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Contactar proveedor
            </p>
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe tu mensaje para contactar al proveedor..."
              className="text-sm resize-none mb-2"
              rows={3}
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (user?.role !== 'buyer') {
                  setFeedback('Solo compradores pueden contactar en Liquidaciones.');
                  return;
                }
                contactMutation.mutate();
              }}
              disabled={!mensaje.trim() || contactMutation.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {contactMutation.isPending ? 'Enviando...' : 'Contactar'}
            </Button>
          </div>

          <div className="px-4 py-3 border-t border-border flex items-center gap-2">
            <button
              onClick={() => {
                if (user?.role !== 'buyer') {
                  setFeedback('Solo compradores pueden dar like en Liquidaciones.');
                  return;
                }
                if (selectedPost.isLiked) {
                  setFeedback('Ya diste like a esta publicacion.');
                  return;
                }
                likeMutation.mutate(selectedPost.id);
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${
                  selectedPost.isLiked ? 'fill-red-500 text-red-500' : ''
                }`}
              />
              <span className="font-medium text-foreground">
                {selectedPost.likes.toLocaleString()} Me gusta
              </span>
            </button>
            <span className="text-xs text-muted-foreground">
              · {new Date(selectedPost.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <button
              type="button"
              onClick={() => navigate(`/buyer/user/supplier/${selectedPost.author.id}`)}
              className="font-semibold text-foreground mb-1 hover:text-primary"
            >
              {selectedPost.author.company}
            </button>
            <p className="text-xs text-muted-foreground mb-3">
              {supplier?.description ?? 'Sin descripcion registrada.'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {supplier?.location ?? 'Sin ubicacion'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {supplier?.sector ?? selectedPost.author.sector ?? 'General'}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{supplier?.averageRating ?? 0}</span>
                <span>({supplier?.reviewsCount ?? 0})</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground mb-3">
              Comentarios de compradores
            </p>
            <div className="flex flex-col gap-3">
              {supplierReviews.length > 0
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
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs text-muted-foreground">{c.rating}.0</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/buyer/user/buyer/${c.buyer.id}`)}
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
                              navigate(`/buyer/user/${c.user.role}/${c.user.id}`);
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
                              navigate(`/buyer/user/${c.user.role}/${c.user.id}`);
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
            </div>
          </div>
        </div>
      </div>

      {!!feedback && (
        <p className="mt-4 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default SaleDetailPage;

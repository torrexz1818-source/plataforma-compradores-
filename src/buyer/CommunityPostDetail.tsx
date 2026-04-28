import { useMemo, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPostDetail, resolveApiAssetUrl, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import CommentSection from '@/components/CommentSection';
import { Badge } from '@/components/ui/badge';

const CommunityPostDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState('');

  const postQuery = useQuery({
    queryKey: ['community-post-detail', id],
    queryFn: () => getPostDetail(id),
    enabled: Boolean(id),
  });

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['community-post-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const post = postQuery.data?.post;
  const comments = postQuery.data?.comments ?? [];
  const initials = post?.author.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';
  const totalComments = useMemo(() => {
    const countReplies = (items: typeof comments): number =>
      items.reduce((total, item) => total + 1 + countReplies(item.replies), 0);

    return countReplies(comments);
  }, [comments]);

  if (postQuery.isLoading) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Cargando publicacion...</p>;
  }

  if (postQuery.isError || !post || post.type !== 'community' || post.author.role !== 'buyer') {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Publicacion no encontrada.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-smooth">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(`/perfil/${post.author.role}/${post.author.id}`)}
              className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-sm font-medium text-primary-foreground shadow-sm"
              aria-label={`Ver perfil de ${post.author.fullName}`}
            >
              {initials}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/perfil/${post.author.role}/${post.author.id}`)}
                  className="text-left text-base font-medium text-foreground transition-colors hover:text-primary sm:text-lg"
                >
                  {post.author.fullName}
                </button>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                  {post.category.name}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">{post.author.company}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(post.createdAt).toLocaleString('es-PE', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <h2 className="text-2xl font-bold leading-tight text-foreground">{post.title}</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85 sm:text-[15px]">
              {post.description}
            </p>
          </div>
        </div>

        {(post.videoUrl || post.thumbnailUrl) && (
          <div className="border-y border-border/70 bg-muted">
            {post.thumbnailUrl ? (
              <img
                src={resolveApiAssetUrl(post.thumbnailUrl)}
                alt={post.title}
                className="h-72 w-full object-cover sm:h-[26rem]"
              />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground sm:h-[26rem]">
                Contenido multimedia
              </div>
            )}
          </div>
        )}

        <div className="border-b border-border/70 px-5 py-3 text-sm text-muted-foreground sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span>{post.likes.toLocaleString()} Me gusta</span>
            <span>{totalComments.toLocaleString()} comentarios</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 border-b border-border/70 p-2">
          <button
            onClick={() => {
              if (user?.role !== 'buyer' && user?.role !== 'supplier') {
                setFeedback('Inicia sesion como comprador o proveedor para interactuar en Comunidad.');
                return;
              }
              likeMutation.mutate();
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              post.isLiked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary'
            }`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-primary' : ''}`} />
            Me gusta
          </button>
          <button
            onClick={() => {
              const commentsHeading = document.getElementById('community-comments');
              commentsHeading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" />
            Comentar
          </button>
        </div>

        <div id="community-comments" className="p-5 sm:p-6">
          <CommentSection
            postId={id}
            comments={comments}
            title="Comentarios"
            emptyMessage="Aun no hay comentarios en esta publicacion."
            composerPlaceholder="Escribe un comentario publico..."
            onCommentAdded={() => {
              void queryClient.invalidateQueries({ queryKey: ['community-post-detail', id] });
              void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
            }}
          />
        </div>
      </div>

      {!!feedback && (
        <p className="mt-4 rounded-md border border-success/25 bg-success/15 px-3 py-2 text-sm text-success-foreground">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default CommunityPostDetail;

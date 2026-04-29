import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPostDetail, resolveApiAssetUrl, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import CommentSection from '@/components/CommentSection';
import { Badge } from '@/components/ui/badge';
import { Comment, Post } from '@/types';

function getCategoryStyles(slug?: string) {
  if (slug === 'experiencia') return 'border border-[#F72A3A]/20 bg-[#F72A3A]/12 text-[#D91F2E] hover:bg-[#F72A3A]/18';
  if (slug === 'pregunta') return 'border border-[#A7E13F]/35 bg-[#A7E13F]/22 text-[#0E109E] hover:bg-[#A7E13F]/30';
  if (slug === 'tips') return 'border border-[#1512A8]/20 bg-[#1512A8]/12 text-[#1512A8] hover:bg-[#1512A8]/18';
  return 'border border-[#5A36D8]/20 bg-[#5A36D8]/12 text-[#4B2BC7] hover:bg-[#5A36D8]/18';
}

function countComments(items: Comment[]): number {
  return items.reduce((total, item) => total + 1 + countComments(item.replies), 0);
}

function appendComment(items: Comment[], comment: Comment, parentId?: string): Comment[] {
  if (!parentId) {
    return [comment, ...items];
  }

  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, replies: [...item.replies, comment] };
    }

    return { ...item, replies: appendComment(item.replies, comment, parentId) };
  });
}

function updateCommentLike(items: Comment[], commentId: string, liked: boolean, likes: number): Comment[] {
  return items.map((item) => {
    if (item.id === commentId) {
      return { ...item, isLiked: liked, likes: Math.max(0, likes) };
    }

    return { ...item, replies: updateCommentLike(item.replies, commentId, liked, likes) };
  });
}

const CommunityPostDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState('');
  const fallbackPost = (location.state as { post?: Post } | null)?.post;
  const [displayPost, setDisplayPost] = useState<Post | undefined>(fallbackPost);
  const [displayComments, setDisplayComments] = useState<Comment[]>([]);

  const postQuery = useQuery({
    queryKey: ['community-post-detail', id],
    queryFn: () => getPostDetail(id),
    enabled: Boolean(id),
  });

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(id),
    onMutate: () => {
      if (!displayPost) return undefined;

      const previousPost = displayPost;
      const nextLiked = !displayPost.isLiked;
      const nextLikes = Math.max(0, displayPost.likes + (nextLiked ? 1 : -1));
      setDisplayPost({ ...displayPost, isLiked: nextLiked, likes: nextLikes });
      return { previousPost };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousPost) {
        setDisplayPost(context.previousPost);
      }
      setFeedback(error.message);
    },
    onSuccess: async (result) => {
      setDisplayPost((current) => current ? { ...current, isLiked: result.liked, likes: result.likes } : current);
      await queryClient.invalidateQueries({ queryKey: ['community-post-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
  });

  useEffect(() => {
    if (postQuery.data?.post) {
      setDisplayPost(postQuery.data.post);
    }
  }, [postQuery.data?.post]);

  useEffect(() => {
    if (postQuery.data?.comments) {
      setDisplayComments(postQuery.data.comments);
    }
  }, [postQuery.data?.comments]);

  const post = displayPost;
  const comments = displayComments;
  const initials = post?.author.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';
  const totalComments = useMemo(() => countComments(comments), [comments]);
  const visibleCommentCount = postQuery.isLoading ? Math.max(totalComments, post?.comments ?? 0) : totalComments;

  useEffect(() => {
    if (postQuery.isLoading || window.location.hash !== '#community-comments') return;

    window.requestAnimationFrame(() => {
      document.getElementById('community-comments')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [postQuery.isLoading]);

  if (postQuery.isLoading && !fallbackPost) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Cargando publicacion...</p>;
  }

  if (!post) {
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

      <div className="overflow-hidden rounded-[28px] border-0 bg-card shadow-smooth">
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
                <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 text-[11px] ${getCategoryStyles(post.category.slug)}`}>
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
          <div className="bg-muted">
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

        <div className="px-5 py-3 text-sm text-muted-foreground sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span>{post.likes.toLocaleString()} Me gusta</span>
            <span>{visibleCommentCount.toLocaleString()} comentarios</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-2">
          <button
            onClick={() => {
              if (user?.role !== 'buyer' && user?.role !== 'supplier') {
                setFeedback('Inicia sesion como comprador o proveedor para interactuar en Comunidad.');
                return;
              }
              if (!likeMutation.isPending) {
                likeMutation.mutate();
              }
            }}
            disabled={likeMutation.isPending}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              post.isLiked ? 'bg-[rgba(243,49,63,0.10)] text-[#F3313F]' : 'text-[#0E109E] hover:bg-[rgba(243,49,63,0.14)] hover:text-[#F3313F]'
            }`}
          >
            <Heart className={`h-4 w-4 text-[#F3313F] ${post.isLiked ? 'fill-[#F3313F]' : ''}`} />
            Me gusta
          </button>
          <button
            onClick={() => {
              const commentsHeading = document.getElementById('community-comments');
              commentsHeading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-[#0E109E] transition-colors hover:bg-[rgba(14,16,158,0.06)]"
          >
            <MessageCircle className="h-4 w-4" />
            Comentar
          </button>
        </div>

        <div id="community-comments" className="p-5 sm:p-6">
          <CommentSection
            postId={id}
            comments={comments}
            commentCount={visibleCommentCount}
            isLoadingComments={postQuery.isLoading}
            title="Comentarios"
            emptyMessage="Aun no hay comentarios en esta publicacion."
            composerPlaceholder="Escribe un comentario publico..."
            onCommentCreated={(comment, parentId) => {
              setDisplayComments((current) => appendComment(current, comment, parentId));
            }}
            onCommentLiked={(commentId, liked, likes) => {
              setDisplayComments((current) => updateCommentLike(current, commentId, liked, likes));
            }}
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

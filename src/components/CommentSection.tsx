import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Heart, MessageCircle, Send, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createComment, toggleCommentLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Comment } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  commentCount?: number;
  isLoadingComments?: boolean;
  onCommentAdded?: () => void;
  onCommentCreated?: (comment: Comment, parentId?: string) => void;
  onCommentLiked?: (commentId: string, liked: boolean, likes: number) => void;
  title?: string;
  emptyMessage?: string;
  composerPlaceholder?: string;
  canComment?: boolean;
  commentDisabledMessage?: string;
}

interface CommentItemProps {
  comment: Comment;
  onReply: (payload: { content: string; parentId?: string }) => Promise<void>;
  onCommentLiked?: (commentId: string, liked: boolean, likes: number) => void;
  isReply?: boolean;
  canReply?: boolean;
}

const CommentItem = ({ comment, onReply, onCommentLiked, isReply = false, canReply = true }: CommentItemProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const initials = comment.user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const commentDate = new Date(comment.createdAt).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  useEffect(() => {
    setLiked(comment.isLiked);
    setLikeCount(comment.likes);
  }, [comment.isLiked, comment.likes]);

  useEffect(() => {
    if (showReply) {
      replyInputRef.current?.focus();
    }
  }, [showReply]);

  const likeMutation = useMutation({
    mutationFn: () => toggleCommentLike(comment.postId, comment.id),
    onMutate: () => {
      const nextLiked = !liked;
      const nextLikes = Math.max(0, likeCount + (nextLiked ? 1 : -1));
      setLiked(nextLiked);
      setLikeCount(nextLikes);
      onCommentLiked?.(comment.id, nextLiked, nextLikes);
      return { previousLiked: liked, previousLikes: likeCount };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      setLiked(context.previousLiked);
      setLikeCount(context.previousLikes);
      onCommentLiked?.(comment.id, context.previousLiked, context.previousLikes);
    },
    onSuccess: (result) => {
      setLiked(result.liked);
      setLikeCount(result.likes);
      onCommentLiked?.(comment.id, result.liked, result.likes);
    },
  });

  const handleReply = async () => {
    if (!replyText.trim() || commentMutationIsPending(comment.id)) return;
    try {
      await onReply({ content: replyText, parentId: comment.id });
      setReplyText('');
      setShowReply(false);
    } catch {
      // The parent mutation renders the existing discreet error message.
    }
  };

  const handleCommentLike = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!likeMutation.isPending) {
      likeMutation.mutate();
    }
  };

  const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleReply();
    }
  };

  return (
    <div className={`${isReply ? 'ml-5 mt-3 border-l border-[rgba(14,16,158,0.12)] pl-4' : 'mt-4'} min-w-0`}>
      <div className="flex min-w-0 gap-3">
        <button
          type="button"
          onClick={() => navigate(`/perfil/${comment.user.role}/${comment.user.id}`)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-medium text-primary-foreground shadow-sm"
          aria-label={`Ver perfil de ${comment.user.fullName}`}
        >
          {initials}
        </button>
        <div className="min-w-0 flex-1">
          <div className="min-w-0 rounded-[20px] border border-white/80 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(14,16,158,0.07)]">
            <div className="mb-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => navigate(`/perfil/${comment.user.role}/${comment.user.id}`)}
                  className="break-words text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {comment.user.fullName}
                </button>
                <span className="text-xs text-[rgba(14,16,158,0.68)]">{commentDate}</span>
              </div>
              <span className="break-words text-xs text-[rgba(14,16,158,0.68)]">{comment.user.company}</span>
            </div>
            <p className="overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
              {comment.content}
            </p>
          </div>

          <div className="ml-1 mt-2 flex flex-wrap items-center gap-4">
            <button
              onClick={handleCommentLike}
              disabled={likeMutation.isPending}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                liked ? 'text-[#F3313F]' : 'text-[#0E109E] hover:text-[#F3313F]'
              }`}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${liked ? 'fill-[#F3313F]' : ''}`} />
              Me gusta {likeCount > 0 ? `${likeCount}` : ''}
            </button>
            {canReply && (
              <button
                onClick={() => setShowReply(!showReply)}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#0E109E] transition-colors hover:bg-[rgba(14,16,158,0.06)]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Responder
              </button>
            )}
            {comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#0E109E] transition-colors hover:bg-[rgba(14,16,158,0.06)]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
                {showReplies ? 'Ocultar respuestas' : `Ver respuestas (${comment.replies.length})`}
              </button>
            )}
          </div>

          {showReply && (
            <div className="mt-3 flex min-w-0 gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[rgba(14,16,158,0.06)]" />
              <div className="min-w-0 flex-1 rounded-2xl border border-[rgba(14,16,158,0.14)] bg-white p-3 shadow-[0_8px_20px_rgba(14,16,158,0.04)]">
                <Textarea
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Escribe una respuesta..."
                  className="min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    className="h-9 min-w-[132px] rounded-full bg-[#B2EB4A] px-5 text-[#0E109E] hover:bg-[#B2EB4A]/85"
                    disabled={!replyText.trim() || commentMutationIsPending(comment.id)}
                    onClick={() => void handleReply()}
                  >
                    <Send className="mr-1 h-4 w-4" />
                    Responder
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showReplies && comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} onCommentLiked={onCommentLiked} isReply canReply={canReply} />
          ))}
        </div>
      </div>
    </div>
  );
};

const pendingReplies = new Set<string>();

function commentMutationIsPending(commentId: string) {
  return pendingReplies.has(commentId);
}

const CommentSection = ({
  postId,
  comments,
  commentCount,
  isLoadingComments = false,
  onCommentAdded,
  onCommentCreated,
  onCommentLiked,
  title = 'Comentarios',
  emptyMessage = 'Aun no hay comentarios.',
  composerPlaceholder = 'Escribe un comentario...',
  canComment = true,
  commentDisabledMessage = 'No tienes permisos para comentar en esta publicacion.',
}: CommentSectionProps) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [sortBy, setSortBy] = useState<'voted' | 'newest'>('voted');
  const [newComment, setNewComment] = useState('');
  const [replyingParentId, setReplyingParentId] = useState<string | undefined>();

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) => createComment(postId, payload),
    onMutate: (payload) => {
      setReplyingParentId(payload.parentId);
      if (payload.parentId) {
        pendingReplies.add(payload.parentId);
      }
    },
    onSuccess: (result, payload) => {
      if (!payload.parentId) {
        setNewComment('');
      }
      onCommentCreated?.(result.comment, payload.parentId);
      onCommentAdded?.();
    },
    onSettled: (_data, _error, payload) => {
      if (payload?.parentId) {
        pendingReplies.delete(payload.parentId);
      }
      setReplyingParentId(undefined);
    },
  });

  const sortedComments = useMemo(() => {
    const cloned = [...comments];
    if (sortBy === 'newest') {
      return cloned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return cloned.sort((a, b) => b.likes - a.likes);
  }, [comments, sortBy]);

  const submitComment = async (payload: { content: string; parentId?: string }) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    await commentMutation.mutateAsync(payload);
  };

  const handleNewCommentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (newComment.trim() && !commentMutation.isPending) {
        void submitComment({ content: newComment });
      }
    }
  };

  const initials = user?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';
  const totalComments = useMemo(() => {
    const countReplies = (items: Comment[]): number =>
      items.reduce((total, item) => total + 1 + countReplies(item.replies), 0);
    return countReplies(comments);
  }, [comments]);
  const visibleCommentCount = commentCount ?? totalComments;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{title} ({visibleCommentCount})</h3>
        <div className="flex rounded-full bg-[rgba(14,16,158,0.05)] p-1">
          {(['voted', 'newest'] as const).map((sortValue) => (
            <button
              key={sortValue}
              onClick={() => setSortBy(sortValue)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === sortValue
                  ? 'bg-white text-[#0E109E] shadow-[0_6px_16px_rgba(14,16,158,0.10)]'
                  : 'text-[#0E109E] hover:bg-[rgba(14,16,158,0.06)]'
              }`}
            >
              {sortValue === 'voted' ? 'Mas votados' : 'Mas recientes'}
            </button>
          ))}
        </div>
      </div>

      {canComment ? (
        <div className="mb-6 flex min-w-0 gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2620bf,#5a31d5)] text-xs font-semibold text-white shadow-[0_10px_24px_rgba(14,16,158,0.18)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1 rounded-[24px] border border-[rgba(14,16,158,0.35)] bg-white p-3 shadow-[0_12px_28px_rgba(14,16,158,0.06)]">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleNewCommentKeyDown}
              placeholder={composerPlaceholder}
              className="min-h-[96px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-[rgba(14,16,158,0.72)]">
                <Heart className="h-4 w-4" />
                <span>Comenta como publicacion social</span>
              </div>
              <Button
                size="sm"
                className="w-full rounded-full bg-[#B2EB4A] px-5 text-[#0E109E] shadow-[0_10px_24px_rgba(178,235,74,0.24)] hover:bg-[#B2EB4A]/85"
                disabled={!newComment.trim() || (commentMutation.isPending && !replyingParentId)}
                onClick={() => void submitComment({ content: newComment })}
              >
                <Send className="mr-1 h-4 w-4" />
                Publicar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-6 rounded-2xl border border-[rgba(14,16,158,0.14)] bg-[rgba(14,16,158,0.04)] px-4 py-3 text-sm text-[rgba(14,16,158,0.72)]">
          {commentDisabledMessage}
        </p>
      )}

      {commentMutation.error && (
        <p className="mb-4 text-xs text-destructive">
          {commentMutation.error instanceof Error ? commentMutation.error.message : 'No se pudo enviar el comentario'}
        </p>
      )}

      <div className="space-y-1">
        {isLoadingComments && sortedComments.length === 0 && (
          <p className="rounded-2xl bg-white/75 px-4 py-5 text-center text-sm text-[rgba(14,16,158,0.68)]">Cargando comentarios...</p>
        )}
        {!isLoadingComments && sortedComments.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[rgba(14,16,158,0.16)] bg-white/75 px-4 py-5 text-center text-sm text-[rgba(14,16,158,0.68)]">{emptyMessage}</p>
        )}
        {sortedComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onReply={submitComment} onCommentLiked={onCommentLiked} canReply={canComment} />
        ))}
      </div>
    </div>
  );
};

export default CommentSection;

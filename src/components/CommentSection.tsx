import { useMemo, useState } from 'react';
import { ChevronDown, Heart, MessageCircle, Send, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createComment } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Comment } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  onCommentAdded?: () => void;
  title?: string;
  emptyMessage?: string;
  composerPlaceholder?: string;
}

interface CommentItemProps {
  comment: Comment;
  onReply: (payload: { content: string; parentId?: string }) => Promise<void>;
  isReply?: boolean;
}

const CommentItem = ({ comment, onReply, isReply = false }: CommentItemProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const initials = comment.user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const commentDate = new Date(comment.createdAt).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await onReply({ content: replyText, parentId: comment.id });
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className={`${isReply ? 'ml-5 mt-3 border-l border-border/70 pl-4' : 'mt-4'} min-w-0`}>
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
          <div className="min-w-0 rounded-[20px] bg-muted/80 px-4 py-3">
            <div className="mb-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => navigate(`/perfil/${comment.user.role}/${comment.user.id}`)}
                  className="break-words text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {comment.user.fullName}
                </button>
                <span className="text-xs text-muted-foreground">{commentDate}</span>
              </div>
              <span className="break-words text-xs text-muted-foreground">{comment.user.company}</span>
            </div>
            <p className="overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
              {comment.content}
            </p>
          </div>

          <div className="ml-1 mt-2 flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                setLiked(!liked);
                setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
              }}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${liked ? 'fill-primary' : ''}`} />
              Me gusta {likeCount > 0 ? `${likeCount}` : ''}
            </button>
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Responder
            </button>
            {comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies((current) => !current)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
                {showReplies ? 'Ocultar respuestas' : `Ver respuestas (${comment.replies.length})`}
              </button>
            )}
          </div>

          {showReply && (
            <div className="mt-3 flex min-w-0 gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary/15" />
              <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background p-3">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  className="min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex justify-end">
                  <Button size="sm" className="h-9 min-w-[132px] rounded-full px-5" onClick={() => void handleReply()}>
                    <Send className="mr-1 h-4 w-4" />
                    Responder
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showReplies && comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} isReply />
          ))}
        </div>
      </div>
    </div>
  );
};

const CommentSection = ({
  postId,
  comments,
  onCommentAdded,
  title = 'Comentarios',
  emptyMessage = 'Aun no hay comentarios.',
  composerPlaceholder = 'Escribe un comentario...',
}: CommentSectionProps) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [sortBy, setSortBy] = useState<'voted' | 'newest'>('voted');
  const [newComment, setNewComment] = useState('');

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) => createComment(postId, payload),
    onSuccess: () => {
      setNewComment('');
      onCommentAdded?.();
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

  const initials = user?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';
  const totalComments = useMemo(() => {
    const countReplies = (items: Comment[]): number =>
      items.reduce((total, item) => total + 1 + countReplies(item.replies), 0);
    return countReplies(comments);
  }, [comments]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-foreground">{title} ({totalComments})</h3>
        <div className="flex gap-1">
          {(['voted', 'newest'] as const).map((sortValue) => (
            <button
              key={sortValue}
              onClick={() => setSortBy(sortValue)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === sortValue ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {sortValue === 'voted' ? 'Mas votados' : 'Mas recientes'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex min-w-0 gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-medium text-primary-foreground shadow-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1 rounded-[24px] border border-border bg-background p-3 shadow-sm">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={composerPlaceholder}
            className="min-h-[96px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span>Comenta como en una publicacion social</span>
            </div>
            <Button
              size="sm"
              className="min-w-[132px] rounded-full px-5"
              disabled={!newComment.trim() || commentMutation.isPending}
              onClick={() => void submitComment({ content: newComment })}
            >
              <Send className="mr-1 h-4 w-4" />
              Publicar
            </Button>
          </div>
        </div>
      </div>

      {commentMutation.error && (
        <p className="mb-4 text-xs text-destructive">
          {commentMutation.error instanceof Error ? commentMutation.error.message : 'No se pudo enviar el comentario'}
        </p>
      )}

      <div className="space-y-1">
        {sortedComments.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
        {sortedComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onReply={submitComment} />
        ))}
      </div>
    </div>
  );
};

export default CommentSection;

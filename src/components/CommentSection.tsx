import { useMemo, useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
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
}

interface CommentItemProps {
  comment: Comment;
  onReply: (payload: { content: string; parentId?: string }) => Promise<void>;
  isReply?: boolean;
}

const CommentItem = ({ comment, onReply, isReply = false }: CommentItemProps) => {
  const [liked, setLiked] = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const initials = comment.user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await onReply({ content: replyText, parentId: comment.id });
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className={`${isReply ? 'ml-10 mt-3' : 'mt-4'}`}>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">{comment.user.fullName}</span>
              <span className="text-xs text-muted-foreground">{comment.user.company}</span>
            </div>
            <p className="text-sm text-foreground/80">{comment.content}</p>
          </div>
          <div className="flex gap-3 mt-1.5 ml-1">
            <button
              onClick={() => {
                setLiked(!liked);
                setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
              }}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-primary' : ''}`} />
              {likeCount}
            </button>
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Responder
            </button>
          </div>
          {showReply && (
            <div className="mt-2 flex gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribe tu respuesta..."
                className="text-sm min-h-[60px]"
              />
              <Button size="sm" className="self-end" onClick={() => void handleReply()}>
                Enviar
              </Button>
            </div>
          )}
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} isReply />
          ))}
        </div>
      </div>
    </div>
  );
};

const CommentSection = ({ postId, comments, onCommentAdded }: CommentSectionProps) => {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Discusion ({comments.length})</h3>
        <div className="flex gap-1">
          {(['voted', 'newest'] as const).map((sortValue) => (
            <button
              key={sortValue}
              onClick={() => setSortBy(sortValue)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                sortBy === sortValue ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {sortValue === 'voted' ? 'Mas votados' : 'Mas recientes'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Hacer una pregunta o comentar..."
            className="text-sm min-h-[60px]"
          />
          <Button
            size="sm"
            className="self-end"
            disabled={!newComment.trim() || commentMutation.isPending}
            onClick={() => void submitComment({ content: newComment })}
          >
            Enviar
          </Button>
        </div>
      </div>

      {commentMutation.error && (
        <p className="text-xs text-destructive mb-4">
          {commentMutation.error instanceof Error ? commentMutation.error.message : 'No se pudo enviar el comentario'}
        </p>
      )}

      <div className="space-y-1">
        {sortedComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onReply={submitComment} />
        ))}
      </div>
    </div>
  );
};

export default CommentSection;

import { useMemo, useState } from 'react';
import { ArrowLeft, Heart, Star } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createComment, getPostDetail, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const CommunityPostDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
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

  const commentMutation = useMutation({
    mutationFn: () => createComment(id, { content: newComment.trim() }),
    onSuccess: async () => {
      setNewComment('');
      await queryClient.invalidateQueries({ queryKey: ['community-post-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const post = postQuery.data?.post;
  const buyerComments = useMemo(
    () => (postQuery.data?.comments ?? []).filter((comment) => comment.user.role === 'buyer'),
    [postQuery.data?.comments],
  );

  if (postQuery.isLoading) {
    return <p className="text-sm text-muted-foreground px-4 py-6">Cargando publicacion...</p>;
  }

  if (postQuery.isError || !post || post.type !== 'community' || post.author.role !== 'buyer') {
    return <p className="text-sm text-muted-foreground px-4 py-6">Publicacion no encontrada.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-2 leading-snug">
        {post.title}
      </h1>

      <p className="text-sm text-muted-foreground mb-4">
        {post.author.fullName}
        <span className="mx-1.5">•</span>
        {post.author.company}
      </p>

      <p className="text-sm text-foreground leading-relaxed mb-4">
        {post.description}
      </p>

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => {
            if (user?.role !== 'buyer') {
              setFeedback('Solo compradores pueden dar like en Comunidad.');
              return;
            }
            if (post.isLiked) {
              setFeedback('Ya diste like a esta publicacion.');
              return;
            }
            likeMutation.mutate();
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              post.isLiked ? 'fill-red-500 text-red-500' : ''
            }`}
          />
          <span className="text-foreground font-medium">
            {post.likes.toLocaleString()} Me gusta
          </span>
        </button>
        <span className="text-xs text-muted-foreground">
          · {new Date(post.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Comentarios</h2>
        <div className="flex flex-col gap-4">
          {buyerComments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
                {c.user.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{c.user.fullName}</p>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">5.0</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-0.5">{c.user.company}</p>
                <p className="text-sm text-foreground">{c.content}</p>
              </div>
            </div>
          ))}
          {buyerComments.length === 0 && (
            <p className="text-sm text-muted-foreground">Aun no hay comentarios de compradores.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          dejar tu comentario
        </h2>
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe tu comentario aqui..."
          className="resize-none mb-3"
          rows={3}
        />
        <Button
          onClick={() => {
            if (user?.role !== 'buyer') {
              setFeedback('Solo compradores pueden comentar en Comunidad.');
              return;
            }
            commentMutation.mutate();
          }}
          disabled={!newComment.trim() || commentMutation.isPending}
          size="sm"
        >
          Publicar comentario
        </Button>
      </div>

      {!!feedback && (
        <p className="mt-4 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default CommunityPostDetail;

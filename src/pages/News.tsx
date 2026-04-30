import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, FileText, Heart, ImagePlus, Link, MessageCircle, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createNewsComment, createNewsPost, getNewsPosts, resolveApiAssetUrl, toggleNewsLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { NewsComment, NewsPost } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function formatRelativeTime(value: string) {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffSeconds = Math.max(1, Math.floor((now - then) / 1000));

  if (diffSeconds < 60) return 'hace unos segundos';
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `hace ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

const CommentBranch = ({
  comment,
  postId,
  onReply,
  autoExpandReply,
  isReply = false,
}: {
  comment: NewsComment;
  postId: string;
  onReply: (postId: string, payload: { content: string; parentId?: string }) => Promise<void>;
  autoExpandReply?: boolean;
  isReply?: boolean;
}) => {
  const navigate = useNavigate();
  const [replyOpen, setReplyOpen] = useState(Boolean(autoExpandReply));
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const initials = comment.user.fullName.split(' ').map((name) => name[0]).join('').slice(0, 2);
  const commentDate = new Date(comment.createdAt).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  useEffect(() => {
    if (replyOpen) {
      replyInputRef.current?.focus();
    }
  }, [replyOpen]);

  const handleReply = async () => {
    if (!replyText.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      await onReply(postId, { content: replyText, parentId: comment.id });
      setReplyText('');
      setReplyOpen(false);
      setShowReplies(true);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleReply();
    }
  };

  return (
    <div className={`${isReply ? 'ml-5 mt-3 border-l border-[rgba(14,16,158,0.12)] pl-4' : 'mt-4'} min-w-0 space-y-3`}>
      <div className="rounded-[20px] border border-[rgba(14,16,158,0.06)] bg-[rgba(255,255,255,0.92)] px-4 py-3 shadow-[0_8px_22px_rgba(14,16,158,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{comment.user.fullName}</p>
            <p className="text-xs text-muted-foreground/70">
              {comment.user.company} · {formatRelativeTime(comment.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyOpen((current) => !current)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#0E109E] transition-colors hover:bg-[rgba(14,16,158,0.06)]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Responder
          </button>
          {comment.replies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((current) => !current)}
              className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#0E109E] transition-colors hover:bg-[rgba(14,16,158,0.06)]"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
              {showReplies ? 'Ocultar respuestas' : `Ver respuestas (${comment.replies.length})`}
            </button>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{comment.content}</p>
      </div>

      {replyOpen && (
        <div className="ml-4 rounded-2xl border border-[rgba(14,16,158,0.12)] bg-[rgba(255,255,255,0.92)] p-3">
          <Textarea
            ref={replyInputRef}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder="Escribe una respuesta..."
            className="min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-[132px] rounded-full bg-[#B2EB4A] px-5 text-[#0E109E] hover:bg-[#B2EB4A]/85"
              disabled={!replyText.trim() || isSubmittingReply}
              onClick={() => void handleReply()}
            >
              <Send className="mr-1 h-4 w-4" />
              Responder
            </Button>
          </div>
        </div>
      )}

      {showReplies && comment.replies.map((reply) => (
        <CommentBranch
          key={reply.id}
          comment={reply}
          postId={postId}
          onReply={onReply}
          isReply
        />
      ))}
    </div>
  );
};

const NewsCard = ({
  post,
  highlighted,
  onToggleLike,
  onComment,
}: {
  post: NewsPost;
  highlighted: boolean;
  onToggleLike: (postId: string) => Promise<void>;
  onComment: (postId: string, payload: { content: string; parentId?: string }) => Promise<void>;
}) => {
  const [commentsOpen, setCommentsOpen] = useState(highlighted);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (highlighted) {
      setCommentsOpen(true);
    }
  }, [highlighted]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await onComment(post.id, { content: commentText });
      setCommentText('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmitComment();
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-[28px] border bg-white/90 shadow-[0_18px_50px_rgba(14, 16, 158, 0.10)] ${
        highlighted ? 'border-primary/40 ring-4 ring-primary/20' : 'border-white/70'
      }`}
    >
      {post.imageUrl && (
        <div className="aspect-[16/8] overflow-hidden bg-primary/10">
          <img src={resolveApiAssetUrl(post.imageUrl)} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="space-y-5 p-6 md:p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">{post.title}</h2>
          <p className="text-sm text-muted-foreground/70">{formatRelativeTime(post.timestamp)}</p>
          {post.body && <p className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-foreground/80">{post.body}</p>}
          {(post.pdfUrl || post.resourceUrl) && (
            <div className="flex flex-wrap gap-3 pt-1">
              {post.pdfUrl && (
                <a
                  href={resolveApiAssetUrl(post.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0E109E]/10 px-4 py-2 text-sm font-medium text-[#0E109E] transition-colors hover:bg-[#0E109E]/16"
                >
                  <FileText className="h-4 w-4" />
                  Ver PDF
                </a>
              )}
              {post.resourceUrl && (
                <a
                  href={post.resourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0E109E]/10 px-4 py-2 text-sm font-medium text-[#0E109E] transition-colors hover:bg-[#0E109E]/16"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir URL
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-primary/15 pt-4">
          <button
            type="button"
            onClick={() => void onToggleLike(post.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              post.isLiked
                ? 'border-red-500/20 bg-red-500/10 text-red-600'
                : 'border-primary/15 text-muted-foreground hover:bg-red-500/10 hover:text-red-600'
            }`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
            {post.likes}
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-[#0E109E]/15 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#0E109E]/10 hover:text-[#0E109E]"
          >
            <MessageCircle className="h-4 w-4" />
            Comentar
          </button>
        </div>

        <AnimatePresence initial={false}>
          {commentsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-5 border-t border-primary/15 pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-medium text-foreground">Comentarios ({post.commentsCount})</h3>
                  <button
                    type="button"
                    className="rounded-full border border-[#5A31D5]/24 bg-[#5A31D5]/16 px-3 py-1.5 text-xs font-medium text-[#4B2BC7]"
                  >
                    Mas recientes
                  </button>
                </div>

                <div className="rounded-[24px] border border-[#0E109E] bg-white p-3 shadow-sm">
                  <Textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Escribe un comentario publico..."
                    className="min-h-[96px] w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#0E109E]">
                      <Heart className="h-4 w-4" />
                      <span>Comenta como en una publicacion social</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-[132px] rounded-full bg-[#B2EB4A] px-5 text-[#0E109E] hover:bg-[#B2EB4A]/85"
                      disabled={!commentText.trim() || isSubmittingComment}
                      onClick={() => void handleSubmitComment()}
                    >
                      <Send className="mr-1 h-4 w-4" />
                      Publicar
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {post.comments.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-primary/15 bg-primary/5 px-4 py-6 text-center text-sm text-muted-foreground/70">
                      Todavia no hay comentarios en esta publicacion.
                    </p>
                  )}
                  {post.comments.map((comment) => (
                    <CommentBranch
                      key={comment.id}
                      comment={comment}
                      postId={post.id}
                      onReply={onComment}
                      autoExpandReply={highlighted}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};

const News = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ title: '', body: '' });
  const [image, setImage] = useState<File | null>(null);
  const [imageName, setImageName] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');

  const newsQuery = useQuery({
    queryKey: ['news-posts'],
    queryFn: getNewsPosts,
  });

  const createMutation = useMutation({
    mutationFn: createNewsPost,
    onSuccess: () => {
      setForm({ title: '', body: '' });
      setImage(null);
      setImageName('');
      setPdf(null);
      setPdfName('');
      setResourceUrl('');
      void queryClient.invalidateQueries({ queryKey: ['news-posts'] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: toggleNewsLike,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news-posts'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: { content: string; parentId?: string } }) =>
      createNewsComment(postId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news-posts'] });
    },
  });

  const highlightedPostId = searchParams.get('post');
  const isAdmin = user?.role === 'admin';

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImage(file);
    setImageName(file?.name ?? '');
  };

  const handlePdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPdf(file);
    setPdfName(file?.name ?? '');
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    await createMutation.mutateAsync({
      title: form.title,
      body: form.body,
      image,
      pdf,
      resourceUrl,
    });
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[32px] bg-[linear-gradient(110deg,#1f20b7_0%,#3620b6_50%,#6235de_100%)] p-6 text-white shadow-[0_18px_44px_rgba(14,16,158,0.16)] md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/78">Pantalla de bienvenida</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">Novedades</h1>
              <p className="mt-3 text-base leading-7 text-white/88 md:text-lg">
                Un espacio donde encontar las las novedades del mundo de compras, para mantenerte siempre informado.
              </p>
            </div>
            <div className="rounded-2xl bg-[#6B49D8] px-5 py-4 text-white shadow-none">
              <p className="text-xs uppercase tracking-[0.25em] text-white/78">Sesion activa</p>
              <p className="mt-1 text-lg font-medium">{user?.fullName ?? 'Usuario'}</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <section className="mt-8 rounded-[28px] border border-primary/15 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14, 16, 158, 0.10)]">
            <div className="mb-5">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-destructive">Panel administrativo</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Publicar novedad</h2>
              <p className="mt-2 text-sm text-muted-foreground">Solo admins ven este formulario y tambien pueden responder comentarios de los usuarios.</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo destacado"
                className="h-12 rounded-2xl"
              />
              <Textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                placeholder="Cuerpo de la publicacion"
                className="min-h-[140px] rounded-2xl"
              />
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-4 transition-colors hover:bg-primary/10">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                  <span>{imageName || 'Adjuntar imagen opcional'}</span>
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Seleccionar</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-4 transition-colors hover:bg-primary/10">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span>{pdfName || 'Agregar PDF opcional'}</span>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Seleccionar</span>
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handlePdfChange} />
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-3">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  <Input
                    type="url"
                    value={resourceUrl}
                    onChange={(event) => setResourceUrl(event.target.value)}
                    placeholder="Agregar URL opcional"
                    className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {createMutation.error instanceof Error ? createMutation.error.message : 'No se pudo publicar la novedad.'}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending || !form.title.trim()} className="h-11 rounded-full px-6">
                  {createMutation.isPending ? 'Publicando...' : 'Publicar novedad'}
                </Button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-8 space-y-6">
          {newsQuery.isLoading && (
            <div className="rounded-[28px] border border-primary/15 bg-white/90 px-6 py-10 text-center text-muted-foreground/70">
              Cargando novedades...
            </div>
          )}
          {newsQuery.error && (
            <div className="rounded-[28px] border border-destructive/20 bg-destructive/10 px-6 py-10 text-center text-destructive">
              {newsQuery.error instanceof Error ? newsQuery.error.message : 'No se pudo cargar el modulo.'}
            </div>
          )}
          {(newsQuery.data ?? []).map((post) => (
            <NewsCard
              key={post.id}
              post={post}
              highlighted={highlightedPostId === post.id}
              onToggleLike={async (postId) => {
                await likeMutation.mutateAsync(postId);
              }}
              onComment={async (postId, payload) => {
                await commentMutation.mutateAsync({ postId, payload });
              }}
            />
          ))}
          {!newsQuery.isLoading && !newsQuery.error && (newsQuery.data ?? []).length === 0 && (
            <div className="rounded-[28px] border border-dashed border-primary/25 bg-white/75 px-6 py-12 text-center text-muted-foreground/70">
              Aun no hay publicaciones en Novedades.
            </div>
          )}
        </section>
      </div>

    </div>
  );
};

export default News;

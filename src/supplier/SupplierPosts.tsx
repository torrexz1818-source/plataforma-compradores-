import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createPost, getSupplierPublications, sendMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PublicationMessage } from '@/types';
import { useHighlight } from '@/hooks/useHighlight';

const SupplierPosts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const highlightedId = searchParams.get('highlight');
  const expandMessages = searchParams.get('expand') === 'messages';
  useHighlight(highlightedId);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [published, setPublished] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [expandedByPublication, setExpandedByPublication] = useState<Record<string, boolean>>({});

  const publicationsQuery = useQuery({
    queryKey: ['supplier-publications', user?.id],
    queryFn: getSupplierPublications,
    enabled: Boolean(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const uploadedImage = imagen ? await uploadFile(imagen, 'posts') : null;

      return createPost({
        title: titulo.trim() || 'Liquidacion del proveedor',
        description: descripcion.trim() || 'Sin descripcion.',
        categoryId: 'cat-6',
        type: 'liquidation',
        videoUrl: url.trim() || undefined,
        thumbnailUrl: uploadedImage?.url,
      });
    },
    onSuccess: async () => {
      setPublished(true);
      setFeedback('');
      setTitulo('');
      setDescripcion('');
      setUrl('');
      setImagen(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['sale-feed-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-publications', user?.id] });
      window.setTimeout(() => setPublished(false), 3000);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const replyMutation = useMutation({
    mutationFn: async (message: PublicationMessage) => {
      if (!user?.id) {
        throw new Error('Sesion no disponible');
      }

      return sendMessage({
        supplierId: user.id,
        buyerId: message.buyerId,
        publicationId: message.publicationId,
        message: replyText.trim(),
      });
    },
    onSuccess: async () => {
      setReplyingTo(null);
      setReplyText('');
      setFeedback('Respuesta enviada correctamente.');
      await queryClient.invalidateQueries({ queryKey: ['supplier-publications', user?.id] });
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const handleImagen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      setImagen(file);
      setPreview(URL.createObjectURL(file));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la imagen.');
    }
  };

  const handlePublicar = () => {
    if (!titulo.trim() && !descripcion.trim()) {
      return;
    }

    createMutation.mutate();
  };

  const handleResponder = (message: PublicationMessage) => {
    if (!replyText.trim()) {
      return;
    }

    replyMutation.mutate(message);
  };

  const toggleExpanded = (publicationId: string) => {
    setExpandedByPublication((current) => ({
      ...current,
      [publicationId]: !current[publicationId],
    }));
  };

  const publications = publicationsQuery.data ?? [];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <h1 className="text-xl font-bold text-foreground mb-1">Liquidaciones del proveedor</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Publica liquidaciones y revisa los mensajes privados asociados a cada oportunidad.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-8">
        <Input
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          placeholder="Titulo de la liquidacion"
          className="mb-3"
        />

        <Textarea
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          placeholder="Describe el stock, condiciones, cantidades o vigencia"
          rows={4}
          className="resize-none mb-3"
        />

        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="URL del producto o sitio (opcional)"
          className="mb-3"
        />

        {preview && (
          <div className="mb-3 rounded-lg overflow-hidden border border-border bg-muted/30">
            <img src={preview} alt="Preview" className="w-full max-h-64 object-contain mx-auto" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors mb-4 w-fit">
          <ImagePlus className="w-4 h-4" />
          {imagen ? imagen.name : 'Agrega imagen'}
          <input type="file" accept="image/*" className="hidden" onChange={handleImagen} />
        </label>

        {published && <p className="text-sm text-success-foreground mb-3">Liquidacion publicada exitosamente.</p>}
        {feedback && !published && <p className="text-sm text-success-foreground mb-3">{feedback}</p>}

        <Button
          onClick={handlePublicar}
          disabled={createMutation.isPending || (!titulo.trim() && !descripcion.trim())}
          className="bg-primary text-primary-foreground"
          size="sm"
        >
          {createMutation.isPending ? 'Publicando...' : 'Publicar liquidacion'}
        </Button>
      </div>

      <h2 className="text-sm font-medium text-foreground mb-4 tracking-wide uppercase">
        Liquidaciones anteriores
      </h2>

      {publicationsQuery.isLoading && (
        <p className="text-sm text-muted-foreground mb-4">Cargando liquidaciones...</p>
      )}

      <div className="flex flex-col gap-5">
        {publications.map((publication) => {
          const messageCount = publication.messages.length;
          const isExpanded = expandMessages && highlightedId === publication.id
            ? true
            : Boolean(expandedByPublication[publication.id]);
          const initialMessages =
            messageCount >= 3 && !isExpanded
              ? publication.messages.slice(0, 2)
              : publication.messages;
          const hiddenMessages =
            messageCount >= 3 ? publication.messages.slice(2) : [];

          return (
            <article id={`item-${publication.id}`} key={publication.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-base font-medium text-foreground">{publication.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{publication.content}</p>
                  {publication.url && (
                    <a
                      href={publication.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      Abrir enlace del proveedor
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/publicaciones/edit/${publication.id}`)}
                >
                  Editar
                </Button>
              </div>

              {publication.image && (
                <div className="mb-4 rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={publication.image}
                    alt={`Imagen de ${publication.title}`}
                    className="w-full max-h-80 object-contain mx-auto"
                  />
                </div>
              )}

              {messageCount > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Mensajes
                  </p>

                  <div className="flex flex-col gap-3">
                    {initialMessages.map((message) => (
                      <div key={message.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {message.buyerName}
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">
                              {message.buyerCompany}
                            </p>
                            <p className="text-sm text-foreground">{message.content}</p>

                            {message.reply && (
                              <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                <p className="text-xs text-muted-foreground">Tu respuesta:</p>
                                <p className="text-sm text-foreground">{message.reply}</p>
                              </div>
                            )}

                            {replyingTo === message.id && (
                              <div className="mt-3 flex gap-2">
                                <Input
                                  value={replyText}
                                  onChange={(event) => setReplyText(event.target.value)}
                                  placeholder="Escribe tu respuesta..."
                                  className="text-sm h-8"
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      handleResponder(message);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 px-3"
                                  onClick={() => handleResponder(message)}
                                  disabled={replyMutation.isPending || !replyText.trim()}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {!message.reply && (
                            <button
                              onClick={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                              className="text-sm text-primary hover:underline flex-shrink-0"
                            >
                              {replyingTo === message.id ? 'Cancelar' : 'Responder'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <AnimatePresence initial={false}>
                      {messageCount >= 3 && isExpanded && (
                        <motion.div
                          key={`expanded-${publication.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="flex flex-col gap-3 overflow-hidden"
                        >
                          {hiddenMessages.map((message) => (
                            <div key={message.id} className="rounded-lg border border-border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {message.buyerName}
                                  </p>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {message.buyerCompany}
                                  </p>
                                  <p className="text-sm text-foreground">{message.content}</p>

                                  {message.reply && (
                                    <div className="mt-2 pl-3 border-l-2 border-primary/30">
                                      <p className="text-xs text-muted-foreground">Tu respuesta:</p>
                                      <p className="text-sm text-foreground">{message.reply}</p>
                                    </div>
                                  )}

                                  {replyingTo === message.id && (
                                    <div className="mt-3 flex gap-2">
                                      <Input
                                        value={replyText}
                                        onChange={(event) => setReplyText(event.target.value)}
                                        placeholder="Escribe tu respuesta..."
                                        className="text-sm h-8"
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            handleResponder(message);
                                          }
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        className="h-8 px-3"
                                        onClick={() => handleResponder(message)}
                                        disabled={replyMutation.isPending || !replyText.trim()}
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {!message.reply && (
                                  <button
                                    onClick={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                                    className="text-sm text-primary hover:underline flex-shrink-0"
                                  >
                                    {replyingTo === message.id ? 'Cancelar' : 'Responder'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {messageCount >= 3 && (
                    <button
                      onClick={() => toggleExpanded(publication.id)}
                      className="mt-3 text-sm text-primary hover:underline"
                    >
                      {isExpanded
                        ? 'Mostrar menos'
                        : `Ver todos los mensajes (${messageCount})`}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {!publicationsQuery.isLoading && publications.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aun no tienes publicaciones registradas.
          </p>
        )}
      </div>
    </div>
  );
};

export default SupplierPosts;

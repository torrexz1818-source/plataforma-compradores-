import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileUp, ImagePlus, MapPin, Search, Send, X } from 'lucide-react';
import {
  createSupplierReview,
  getConversationMessages,
  getConversations,
  getPostDetail,
  getSupplierReviews,
  getSuppliersBySector,
  sendConversationMessage,
  uploadFile,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MessageAttachment } from '@/types';
import { toast } from '@/components/ui/sonner';
import { isBuyerLikeRole } from '@/lib/roles';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Ahora';
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString();
}

function AttachmentPreview({ attachment, compact = false }: { attachment: MessageAttachment; compact?: boolean }) {
  if (attachment.kind === 'publication') {
    return (
      <div className={`overflow-hidden rounded-xl border border-border bg-white ${compact ? 'w-40' : 'w-full max-w-sm'}`}>
        {attachment.thumbnailUrl ? (
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.name}
            className={`${compact ? 'h-20' : 'h-36'} w-full object-cover`}
          />
        ) : null}
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            Publicacion compartida
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{attachment.name}</p>
          {attachment.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{attachment.description}</p>
          )}
        </div>
      </div>
    );
  }

  if (attachment.kind === 'profile') {
    return (
      <div className={`rounded-xl border border-border bg-white p-3 ${compact ? 'w-40' : 'w-full max-w-sm'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
          Perfil compartido
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{attachment.name}</p>
        {attachment.label && (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-700">{attachment.label}</p>
        )}
        {attachment.description && (
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{attachment.description}</p>
        )}
      </div>
    );
  }

  if (attachment.kind === 'image' && attachment.url) {
    return (
      <div className={`${compact ? 'w-16 h-16' : 'w-48 h-48'} rounded-xl overflow-hidden border border-border bg-white`}>
        <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (attachment.kind === 'location') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground hover:bg-muted/60"
      >
        <MapPin className="w-4 h-4 text-primary" />
        {attachment.label || 'Ubicacion compartida'}
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground hover:bg-muted/60"
    >
      <FileUp className="w-4 h-4 text-primary" />
      {attachment.name}
    </a>
  );
}

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('conversationId'),
  );
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDone, setReviewDone] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const source = searchParams.get('source');
  const sourceTargetName = searchParams.get('targetName');
  const sourceTargetHeadline = searchParams.get('targetHeadline');

  const hasMembershipAccess = Boolean(user?.hasSensitiveAccess);

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });

  const activeConversation = useMemo(
    () => (conversationsQuery.data ?? []).find((c) => c.id === activeConversationId) ?? null,
    [conversationsQuery.data, activeConversationId],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return conversationsQuery.data ?? [];
    }

    return (conversationsQuery.data ?? []).filter((conversation) => {
      const name =
        conversation.otherUserName ||
        (isBuyerLikeRole(user?.role) ? conversation.supplierName : conversation.buyerName);
      const company =
        conversation.otherUserCompany ||
        (isBuyerLikeRole(user?.role) ? conversation.supplierCompany : conversation.buyerCompany);
      return `${name} ${company} ${conversation.lastMessage}`.toLowerCase().includes(term);
    });
  }, [conversationsQuery.data, search, user?.role]);

  useEffect(() => {
    if (activeConversationId) {
      return;
    }

    const fromUrl = searchParams.get('conversationId');
    if (fromUrl) {
      setActiveConversationId(fromUrl);
      return;
    }

    if (conversationsQuery.data?.length) {
      const firstId = conversationsQuery.data[0].id;
      setActiveConversationId(firstId);
      setSearchParams({ conversationId: firstId });
    }
  }, [activeConversationId, conversationsQuery.data, searchParams, setSearchParams]);

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', activeConversationId],
    queryFn: () => getConversationMessages(activeConversationId ?? ''),
    enabled: Boolean(activeConversationId),
    refetchInterval: 10000,
  });

  const publicationQuery = useQuery({
    queryKey: ['message-publication', activeConversation?.publicationId],
    queryFn: () => getPostDetail(activeConversation?.publicationId ?? ''),
    enabled: Boolean(activeConversation?.publicationId),
  });
  const publicationPath = activeConversation?.publicationId
    ? publicationQuery.data?.post.author.role === 'buyer'
      ? `/supplier/sale/${activeConversation.publicationId}`
      : user?.role === 'supplier'
        ? `/publicaciones?highlight=${activeConversation.publicationId}&expand=messages`
        : `/buyer/sale/${activeConversation.publicationId}`
    : null;

  useEffect(() => {
    if (activeConversationId) {
      inputRef.current?.focus();
    }
  }, [activeConversationId]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!activeConversationId || (!draft.trim() && attachments.length === 0)) {
        return;
      }
      return sendConversationMessage(activeConversationId, {
        message: draft.trim(),
        attachments,
      });
    },
    onSuccess: async () => {
      setDraft('');
      setAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ['conversation-messages', activeConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      inputRef.current?.focus();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const supplierSector = activeConversation?.supplierSector ?? '';
  const supplierId = activeConversation?.otherUserRole === 'supplier'
    ? (activeConversation?.otherUserId ?? activeConversation?.supplierId ?? '')
    : activeConversation?.supplierId ?? '';

  const similarSuppliersQuery = useQuery({
    queryKey: ['similar-suppliers', supplierSector, supplierId],
    queryFn: async () => {
      const list = await getSuppliersBySector(supplierSector);
      return list.filter((item) => item.id !== supplierId).slice(0, 3);
    },
    enabled: Boolean(isBuyerLikeRole(user?.role) && supplierSector && supplierId && (messagesQuery.data?.length ?? 0) > 0),
  });

  const reviewsQuery = useQuery({
    queryKey: ['supplier-reviews', supplierId],
    queryFn: () => getSupplierReviews(supplierId),
    enabled: Boolean(isBuyerLikeRole(user?.role) && supplierId && (messagesQuery.data?.length ?? 0) > 0),
  });

  const alreadyReviewed = useMemo(
    () => (reviewsQuery.data ?? []).some((item) => item.buyer.id === user?.id),
    [reviewsQuery.data, user?.id],
  );

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId || !reviewComment.trim()) {
        return;
      }
      return createSupplierReview(supplierId, { rating, comment: reviewComment.trim() });
    },
    onSuccess: async () => {
      setReviewDone(true);
      setReviewComment('');
      await queryClient.invalidateQueries({ queryKey: ['supplier-reviews', supplierId] });
    },
  });

  const addFiles = async (files: FileList | null, kind: 'image' | 'file') => {
    if (!files?.length) {
      return;
    }

    if (!hasMembershipAccess) {
      toast.error('Solo usuarios con membresia activa pueden enviar fotos o archivos.');
      return;
    }

    setIsUploadingAttachments(true);

    try {
      const nextAttachments = await Promise.all(
        Array.from(files).map(async (file) => {
          const uploadedFile = await uploadFile(file, 'messages');

          return {
            id: crypto.randomUUID(),
            kind,
            name: uploadedFile.name || file.name,
            url: uploadedFile.url,
            mimeType: uploadedFile.mimeType || file.type,
            size: uploadedFile.size || file.size,
          } satisfies MessageAttachment;
        }),
      );

      setAttachments((current) => [...current, ...nextAttachments]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo.');
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const shareLocation = async () => {
    if (!hasMembershipAccess) {
      toast.error('Solo usuarios con membresia activa pueden compartir ubicacion.');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalizacion.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setAttachments((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            kind: 'location',
            name: 'Ubicacion',
            label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude,
            url,
          },
        ]);
      },
      () => {
        toast.error('No se pudo obtener tu ubicacion.');
      },
    );
  };

  const onSend = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() && attachments.length === 0) {
      return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mensajeria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conversaciones en tiempo real con soporte para fotos, archivos y ubicacion.
          </p>
          {!hasMembershipAccess && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 inline-block">
              Tu cuenta puede enviar texto. Fotos, archivos y ubicacion requieren membresia activa autorizada.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <aside className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar en mensajes..."
                  className="pl-10 rounded-full"
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              {filteredConversations.map((conversation) => {
                const name =
                  conversation.otherUserName ||
                  (isBuyerLikeRole(user?.role) ? conversation.supplierName : conversation.buyerName);
                const company =
                  conversation.otherUserCompany ||
                  (isBuyerLikeRole(user?.role) ? conversation.supplierCompany : conversation.buyerCompany);
                const isActive = conversation.id === activeConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setActiveConversationId(conversation.id);
                      setSearchParams({ conversationId: conversation.id });
                    }}
                    className={`w-full text-left rounded-xl px-3 py-3 mb-1 transition-colors ${
                      isActive ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>{name}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatConversationTime(conversation.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{company}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={`text-xs truncate ${conversation.unreadCount > 0 ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                            {conversation.lastMessage || 'Sin mensajes aun'}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!conversationsQuery.isLoading && filteredConversations.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-6 text-center">
                  No tienes conversaciones activas.
                </p>
              )}
            </div>
          </aside>

          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              {activeConversation ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {getInitials(
                        activeConversation.otherUserName ||
                        (isBuyerLikeRole(user?.role) ? activeConversation.supplierName : activeConversation.buyerName),
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {activeConversation.otherUserName ||
                          (isBuyerLikeRole(user?.role) ? activeConversation.supplierName : activeConversation.buyerName)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeConversation.otherUserCompany ||
                          (isBuyerLikeRole(user?.role) ? activeConversation.supplierCompany : activeConversation.buyerCompany)}
                      </p>
                    </div>
                  </div>
                  {source === 'employability' && activeConversationId === searchParams.get('conversationId') && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                        Conversacion iniciada desde Empleabilidad
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {sourceTargetName ?? 'Perfil profesional'}
                      </p>
                      {sourceTargetHeadline ? (
                        <p className="mt-1 text-xs text-slate-600">{sourceTargetHeadline}</p>
                      ) : null}
                    </div>
                  )}
                  {activeConversation.publicationId && publicationQuery.data?.post && (
                    <button
                      type="button"
                      onClick={() => publicationPath && navigate(publicationPath)}
                      className="w-full text-left rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                        Conversacion ligada a publicacion
                      </p>
                      <p className="text-sm font-semibold text-foreground mt-1">
                        {publicationQuery.data.post.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {publicationQuery.data.post.description}
                      </p>
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona una conversacion para empezar.</p>
              )}
            </div>

            <div className="min-h-[360px] max-h-[52vh] overflow-y-auto space-y-3 p-5 bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,1))]">
              {messagesQuery.isError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  No se pudieron cargar los mensajes de esta conversacion.
                </div>
              )}
              {(messagesQuery.data ?? []).map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.isOwn
                      ? 'ml-auto bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-white border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                  {message.attachments.length > 0 && (
                    <div className={`mt-2 flex flex-wrap gap-2 ${message.text ? '' : 'mt-0'}`}>
                      {message.attachments.map((attachment) => (
                        attachment.kind === 'publication' && attachment.publicationId ? (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() =>
                              navigate(
                                publicationQuery.data?.post.author.role === 'buyer'
                                  ? `/supplier/sale/${attachment.publicationId}`
                                  : user?.role === 'supplier'
                                    ? `/publicaciones?highlight=${attachment.publicationId}&expand=messages`
                                    : `/buyer/sale/${attachment.publicationId}`,
                              )
                            }
                            className="text-left"
                          >
                            <AttachmentPreview attachment={attachment} />
                          </button>
                        ) : (
                          <AttachmentPreview key={attachment.id} attachment={attachment} />
                        )
                      ))}
                    </div>
                  )}
                  <p className={`mt-2 text-[11px] ${message.isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {formatMessageTime(message.createdAt)}
                  </p>
                </div>
              ))}

              {!messagesQuery.isLoading && (messagesQuery.data ?? []).length === 0 && (
                <div className="h-full min-h-[280px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Aun no hay mensajes en este hilo.</p>
                </div>
              )}
            </div>

            <form onSubmit={onSend} className="border-t border-border p-4 bg-card">
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative">
                      <AttachmentPreview attachment={attachment} compact />
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isUploadingAttachments && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Subiendo adjuntos al almacenamiento...
                </p>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Escribe tu mensaje..."
                    rows={3}
                    className="resize-none rounded-2xl"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => imageInputRef.current?.click()} disabled={!hasMembershipAccess || isUploadingAttachments}>
                      <ImagePlus className="w-4 h-4 mr-1" />
                      Foto
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={!hasMembershipAccess || isUploadingAttachments}>
                      <FileUp className="w-4 h-4 mr-1" />
                      Archivo
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={shareLocation} disabled={!hasMembershipAccess || isUploadingAttachments}>
                      <MapPin className="w-4 h-4 mr-1" />
                      Ubicacion
                    </Button>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void addFiles(event.target.files, 'image');
                      event.target.value = '';
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void addFiles(event.target.files, 'file');
                      event.target.value = '';
                    }}
                  />
                </div>
                <Button type="submit" disabled={sendMutation.isPending || isUploadingAttachments || (!draft.trim() && attachments.length === 0)} className="self-end rounded-full px-4">
                  <Send className="w-4 h-4 mr-1" />
                  {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>

            {isBuyerLikeRole(user?.role) && activeConversation?.otherUserRole === 'supplier' && (messagesQuery.data?.length ?? 0) > 0 && (
              <div className="px-5 pb-5 space-y-5">
                {(similarSuppliersQuery.data?.length ?? 0) > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3">
                      Proveedores similares que podrian interesarte
                    </h2>
                    <div className="grid md:grid-cols-3 gap-3">
                      {(similarSuppliersQuery.data ?? []).map((supplier) => (
                        <article key={supplier.id} className="rounded-xl border border-border p-3">
                          <p className="text-sm font-semibold text-foreground">{supplier.company}</p>
                          <p className="text-xs text-muted-foreground">{supplier.sector}</p>
                          <p className="text-xs text-amber-600 mt-1">*****</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={() => navigate(`/perfil/${supplier.id}`)}
                          >
                            Ver perfil
                          </Button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {!alreadyReviewed && !reviewDone && activeConversation && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground mb-2">
                      Ya trabajaste con {activeConversation.supplierCompany}? Comparte tu experiencia
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setRating(item)}
                          className={`text-lg ${item <= rating ? 'text-amber-500' : 'text-muted-foreground'}`}
                        >
                          *
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Escribe tu comentario..."
                      rows={2}
                      className="resize-none mb-3 rounded-2xl"
                    />
                    <Button onClick={() => reviewMutation.mutate()} disabled={!reviewComment.trim() || reviewMutation.isPending}>
                      Enviar valoracion
                    </Button>
                  </div>
                )}

                {(alreadyReviewed || reviewDone) && (
                  <p className="text-sm text-emerald-700">Gracias por tu valoracion</p>
                )}
              </div>
            )}
          </section>
        </div>
    </div>
  );
};

export default Messages;

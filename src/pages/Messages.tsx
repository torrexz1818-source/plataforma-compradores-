import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import {
  createSupplierReview,
  getConversationMessages,
  getConversations,
  getSupplierReviews,
  getSuppliersBySector,
  sendConversationMessage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('conversationId'),
  );
  const [draft, setDraft] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDone, setReviewDone] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    enabled: Boolean(user?.id),
  });

  const activeConversation = useMemo(
    () => (conversationsQuery.data ?? []).find((c) => c.id === activeConversationId) ?? null,
    [conversationsQuery.data, activeConversationId],
  );

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
  });

  useEffect(() => {
    if (activeConversationId) {
      inputRef.current?.focus();
    }
  }, [activeConversationId]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!activeConversationId || !draft.trim()) {
        return;
      }
      return sendConversationMessage(activeConversationId, draft.trim());
    },
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['conversation-messages', activeConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      inputRef.current?.focus();
    },
  });

  const supplierSector = activeConversation?.supplierSector ?? '';
  const supplierId = activeConversation?.supplierId ?? '';

  const similarSuppliersQuery = useQuery({
    queryKey: ['similar-suppliers', supplierSector, supplierId],
    queryFn: async () => {
      const list = await getSuppliersBySector(supplierSector);
      return list.filter((item) => item.id !== supplierId).slice(0, 3);
    },
    enabled: Boolean(user?.role === 'buyer' && supplierSector && supplierId && (messagesQuery.data?.length ?? 0) > 0),
  });

  const reviewsQuery = useQuery({
    queryKey: ['supplier-reviews', supplierId],
    queryFn: () => getSupplierReviews(supplierId),
    enabled: Boolean(user?.role === 'buyer' && supplierId && (messagesQuery.data?.length ?? 0) > 0),
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

  const onSend = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    sendMutation.mutate();
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Mensajes</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <aside className="bg-card border border-border rounded-xl p-3 max-h-[70vh] overflow-y-auto">
            {(conversationsQuery.data ?? []).map((conversation) => {
              const company = user?.role === 'buyer' ? conversation.supplierCompany : conversation.buyerCompany;
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setSearchParams({ conversationId: conversation.id });
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2 mb-1 transition-colors ${
                    isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/60'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{company}</p>
                  <p className="text-xs text-muted-foreground truncate">{conversation.lastMessage || 'Sin mensajes aun'}</p>
                </button>
              );
            })}
            {!conversationsQuery.isLoading && (conversationsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground px-2 py-3">No tienes conversaciones activas.</p>
            )}
          </aside>

          <section className="bg-card border border-border rounded-xl p-4">
            <div className="min-h-[360px] max-h-[52vh] overflow-y-auto space-y-2">
              {(messagesQuery.data ?? []).map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.senderId === user?.id
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.text}
                </div>
              ))}
              {!messagesQuery.isLoading && (messagesQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aun no hay mensajes en este hilo.</p>
              )}
            </div>

            <form onSubmit={onSend} className="mt-4 flex gap-2">
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={2}
                className="resize-none"
              />
              <Button type="submit" disabled={!draft.trim() || sendMutation.isPending}>
                {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </form>

            {user?.role === 'buyer' && (messagesQuery.data?.length ?? 0) > 0 && (
              <div className="mt-8 space-y-5">
                {(similarSuppliersQuery.data?.length ?? 0) > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3">
                      Proveedores similares que podrian interesarte
                    </h2>
                    <div className="grid md:grid-cols-3 gap-3">
                      {(similarSuppliersQuery.data ?? []).map((supplier) => (
                        <article key={supplier.id} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-semibold text-foreground">{supplier.company}</p>
                          <p className="text-xs text-muted-foreground">{supplier.sector}</p>
                          <p className="text-xs text-amber-600 mt-1">★★★★★</p>
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
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground mb-2">
                      ¿Ya trabajaste con {activeConversation.supplierCompany}? Comparte tu experiencia
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setRating(item)}
                          className={`text-lg ${item <= rating ? 'text-amber-500' : 'text-muted-foreground'}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Escribe tu comentario..."
                      rows={2}
                      className="resize-none mb-3"
                    />
                    <Button onClick={() => reviewMutation.mutate()} disabled={!reviewComment.trim() || reviewMutation.isPending}>
                      Enviar valoración
                    </Button>
                  </div>
                )}

                {(alreadyReviewed || reviewDone) && (
                  <p className="text-sm text-emerald-700">Gracias por tu valoración</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default Messages;

import { useMemo, useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  createConversation,
  createSupplierReview,
  getConversationByPair,
  getSupplierById,
  getSupplierReviews,
  sendConversationMessage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isBuyerLikeRole } from '@/lib/roles';

const SupplierProfile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [mensaje, setMensaje] = useState('');
  const [starHover, setStarHover] = useState(0);
  const [starSelected, setStarSelected] = useState(5);
  const [comentario, setComentario] = useState('');
  const [comentarioEnviado, setComentarioEnviado] = useState(false);
  const [feedback, setFeedback] = useState('');

  const supplierQuery = useQuery({
    queryKey: ['supplier-profile', id],
    queryFn: () => getSupplierById(id),
    enabled: Boolean(id),
  });

  const reviewsQuery = useQuery({
    queryKey: ['supplier-reviews', id],
    queryFn: () => getSupplierReviews(id),
    enabled: Boolean(id),
  });

  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Sesion no disponible');
      }

      const existing = await getConversationByPair(user.id, id);
      const conversation = existing ?? await createConversation({ toUserId: id, publicationId: null });

      if (mensaje.trim()) {
        await sendConversationMessage(conversation.id, { message: mensaje.trim() });
      }

      return conversation;
    },
    onSuccess: (conversation) => {
      setMensaje('');
      setFeedback('');
      navigate(`/mensajes?conversationId=${conversation.id}`);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () =>
      createSupplierReview(id, {
        rating: starSelected,
        comment: comentario.trim(),
      }),
    onSuccess: async () => {
      setComentario('');
      setComentarioEnviado(true);
      setFeedback('');
      await queryClient.invalidateQueries({ queryKey: ['supplier-reviews', id] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-profile', id] });
      window.setTimeout(() => setComentarioEnviado(false), 3000);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const comments = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  if (supplierQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando proveedor...</p>;
  }

  if (supplierQuery.isError || !supplierQuery.data) {
    return <p className="text-sm text-muted-foreground">Proveedor no encontrado.</p>;
  }

  const supplier = supplierQuery.data;
  const contactado = supplier.hasContacted;
  const ratingDisplay = supplier.averageRating > 0 ? Math.round(supplier.averageRating) : 4;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= ratingDisplay
                      ? 'fill-success text-success'
                      : 'text-muted-foreground'
                  }`}
                />
              ))}
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs border-success text-success-foreground bg-success/15"
          >
            Proveedor
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-sm mb-5">
          <div>
            <span className="text-muted-foreground">Empresa: </span>
            <span className="text-foreground">{supplier.company}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sector: </span>
            <span className="text-foreground">{supplier.sector}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ubicacion: </span>
            <span className="text-foreground">{supplier.location}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Provincia: </span>
            <span className="text-foreground">{supplier.province}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Distrito: </span>
            <span className="text-foreground">{supplier.district}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Correo: </span>
            <span className="text-foreground">{supplier.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Telefono: </span>
            <span className="text-foreground">{supplier.phone || 'Sin telefono'}</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1">Descripcion</p>
          <p className="text-sm text-muted-foreground">{supplier.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-foreground mb-4">
            Comentarios de compradores
          </p>
          <div className="flex flex-col gap-4">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                  {c.buyer.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {c.buyer.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-0.5">{c.buyer.company}</p>
                  <p className="text-sm text-foreground">{c.comment}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && !reviewsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Aun no hay comentarios.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground mb-3">
              Contactar proveedor
            </p>
            <>
              <Textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe tu mensaje para contactar al proveedor (opcional)..."
                rows={3}
                className="resize-none text-sm mb-3"
              />
              <Button
                size="sm"
                className="w-full bg-primary text-primary-foreground"
                onClick={() => {
                  if (!isBuyerLikeRole(user?.role)) {
                    setFeedback('Solo compradores o expertos pueden contactar proveedores.');
                    return;
                  }
                  contactMutation.mutate();
                }}
                disabled={contactMutation.isPending}
              >
                {contactMutation.isPending ? 'Abriendo...' : 'Contactar'}
              </Button>
            </>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm font-medium text-foreground mb-1">
              Dejar comentario y estrellas
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {contactado
                ? 'Comparte tu experiencia con este proveedor.'
                : 'Solo disponible despues de contactar al proveedor.'}
            </p>

            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  disabled={!contactado}
                  onMouseEnter={() => contactado && setStarHover(s)}
                  onMouseLeave={() => setStarHover(0)}
                  onClick={() => contactado && setStarSelected(s)}
                  className="focus:outline-none disabled:cursor-not-allowed"
                >
                  <Star
                    className={`w-5 h-5 transition-colors ${
                      s <= (starHover || starSelected)
                        ? 'fill-success text-success'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe tu comentario..."
              rows={2}
              disabled={!contactado}
              className="resize-none text-sm mb-3"
            />

            {comentarioEnviado && (
              <p className="text-xs text-success-foreground mb-2">
                Comentario enviado correctamente.
              </p>
            )}

            <Button
              size="sm"
              className="w-full bg-primary text-primary-foreground"
              onClick={() => {
                if (!contactado || !comentario.trim()) {
                  return;
                }
                reviewMutation.mutate();
              }}
              disabled={!contactado || !comentario.trim() || reviewMutation.isPending}
            >
              Enviar comentario
            </Button>
          </div>
        </div>
      </div>

      {!!feedback && (
        <p className="mt-4 text-sm rounded-md border border-success/25 bg-success/15 text-success-foreground px-3 py-2">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default SupplierProfile;

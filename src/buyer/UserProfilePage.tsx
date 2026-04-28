import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createConversation, getBuyerById, getConversationByPair, getSupplierById, sendConversationMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';

const UserProfilePage = () => {
  const { user: sessionUser } = useAuth();
  const navigate = useNavigate();
  const { role = '', id: idParam = '' } = useParams();
  const normalizedRole = role.toLowerCase();
  const targetId = idParam || sessionUser?.id || '';
  const isOwnProfile = !idParam || targetId === sessionUser?.id;
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const userQuery = useQuery({
    queryKey: ['user-profile', normalizedRole || 'auto', targetId],
    queryFn: async () => {
      if (!targetId) {
        throw new Error('Usuario no encontrado');
      }

      if (normalizedRole === 'supplier') {
        const supplier = await getSupplierById(targetId);
        return { data: supplier, role: 'supplier' as const };
      }

      if (normalizedRole === 'buyer') {
        const buyer = await getBuyerById(targetId);
        return { data: buyer, role: 'buyer' as const };
      }

      if (sessionUser?.role === 'supplier' && isOwnProfile) {
        const supplier = await getSupplierById(targetId);
        return { data: supplier, role: 'supplier' as const };
      }

      if (sessionUser?.role === 'buyer' && isOwnProfile) {
        const buyer = await getBuyerById(targetId);
        return { data: buyer, role: 'buyer' as const };
      }

      try {
        const supplier = await getSupplierById(targetId);
        return { data: supplier, role: 'supplier' as const };
      } catch {
        const buyer = await getBuyerById(targetId);
        return { data: buyer, role: 'buyer' as const };
      }
    },
    enabled: Boolean(targetId),
  });

  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!sessionUser?.id || !targetId) {
        throw new Error('Usuario no disponible');
      }

      const buyerId = sessionUser.role === 'buyer' ? sessionUser.id : targetId;
      const supplierId = sessionUser.role === 'supplier' ? sessionUser.id : targetId;
      const existing = await getConversationByPair(buyerId, supplierId);
      const conversation = existing ?? await createConversation({ toUserId: targetId, publicationId: null });

      if (message.trim()) {
        await sendConversationMessage(conversation.id, { message: message.trim() });
      }

      return conversation;
    },
    onSuccess: (conversation) => {
      setFeedback('');
      setMessage('');
      navigate(`/mensajes?conversationId=${conversation.id}`);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  if (userQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando perfil...</p>;
  }

  if (userQuery.isError || !userQuery.data) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el perfil.</p>;
  }

  const profile = userQuery.data.data;
  const profileRole = userQuery.data.role;
  const canContact =
    !isOwnProfile &&
    sessionUser?.role !== 'admin' &&
    ((sessionUser?.role === 'supplier' && profileRole === 'buyer') ||
      (sessionUser?.role === 'buyer' && profileRole === 'supplier'));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {!isOwnProfile && <BackButton fallback="/home" className="mb-6" />}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            {'name' in profile ? profile.name : sessionUser?.fullName ?? 'Usuario'}
          </h1>
          <Badge className={profileRole === 'supplier' ? 'bg-success/25 text-success-foreground' : 'bg-primary/15 text-primary'}>
            {profileRole === 'supplier' ? 'Proveedor' : 'Comprador'}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <p><span className="font-medium">Empresa:</span> {profile.company}</p>
          <p><span className="font-medium">Sector:</span> {profile.sector}</p>
          <p><span className="font-medium">Ubicacion:</span> {profile.location}</p>
          {'province' in profile && <p><span className="font-medium">Provincia:</span> {profile.province}</p>}
          {'district' in profile && <p><span className="font-medium">Distrito:</span> {profile.district}</p>}
          <p><span className="font-medium">Correo:</span> {profile.email}</p>
          <p><span className="font-medium">Telefono:</span> {profile.phone || 'No registrado'}</p>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Descripcion</p>
          <p className="text-sm text-muted-foreground">{profile.description || 'Sin descripcion registrada.'}</p>
        </div>

        {canContact && (
          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">
                {profileRole === 'buyer' ? 'Contactar comprador' : 'Contactar proveedor'}
              </p>
              <p className="text-xs text-muted-foreground">
                Puedes abrir una conversacion y enviar un mensaje desde este perfil.
              </p>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje inicial (opcional)..."
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              className="w-full"
              onClick={() => contactMutation.mutate()}
              disabled={contactMutation.isPending}
            >
              {contactMutation.isPending ? 'Abriendo...' : 'Enviar mensaje'}
            </Button>
          </div>
        )}

        {!!feedback && (
          <p className="text-sm rounded-md border border-success/25 bg-success/15 text-success-foreground px-3 py-2">
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;

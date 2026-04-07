import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Badge } from '@/components/ui/badge';
import { getBuyerById, getSupplierById } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const UserProfilePage = () => {
  const { user: sessionUser } = useAuth();
  const { role = '', id: idParam = '' } = useParams();
  const normalizedRole = role.toLowerCase();
  const targetId = idParam || sessionUser?.id || '';
  const isOwnProfile = !idParam || targetId === sessionUser?.id;

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

  if (userQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando perfil...</p>;
  }

  if (userQuery.isError || !userQuery.data) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el perfil.</p>;
  }

  const profile = userQuery.data.data;
  const profileRole = userQuery.data.role;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {!isOwnProfile && <BackButton fallback="/home" className="mb-6" />}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            {'name' in profile ? profile.name : sessionUser?.fullName ?? 'Usuario'}
          </h1>
          <Badge className={profileRole === 'supplier' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>
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
      </div>
    </div>
  );
};

export default UserProfilePage;

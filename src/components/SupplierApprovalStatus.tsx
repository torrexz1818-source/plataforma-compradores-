import { Hourglass, LogOut, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

const SupplierApprovalStatus = () => {
  const { user, logout } = useAuth();
  const isRejected = user?.status === 'rejected';

  return (
    <div className="sidebar-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl rounded-2xl border-white/20 bg-white text-primary shadow-[var(--shadow-sidebar)]">
        <CardContent className="p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white">
            {isRejected ? <ShieldX className="h-7 w-7" /> : <Hourglass className="h-7 w-7" />}
          </div>
          <h1 className="text-2xl font-bold text-primary">
            {isRejected ? 'Cuenta de proveedor rechazada' : 'Cuenta pendiente de aprobación'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-primary/75">
            {isRejected
              ? 'Tu solicitud de proveedor no fue aprobada por el administrador. Si crees que hubo un error, comunícate con el equipo de Buyer Nodus.'
              : 'Se esta revisando su información , gracias por la espera.'}
          </p>
          <p className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-primary/75">
            Empresa: <span className="font-medium text-primary">{user?.company ?? 'No registrada'}</span>
          </p>
          <Button type="button" variant="outline" className="mt-6 rounded-full border-primary text-primary hover:bg-primary hover:text-white" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierApprovalStatus;

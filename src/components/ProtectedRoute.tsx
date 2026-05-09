import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isBuyerLikeRole } from '@/lib/roles';
import SupplierApprovalStatus from '@/components/SupplierApprovalStatus';

type AllowedRole = 'buyer' | 'supplier' | 'expert';

interface ProtectedRouteProps {
  role: AllowedRole;
  children: ReactElement;
}

function getDashboardPath(role: string | undefined) {
  if (role === 'supplier') {
    return '/supplier/dashboard';
  }

  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'expert') {
    return '/expert/calendar-setup';
  }

  return '/buyer/dashboard';
}

const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return children;
  }

  if (user.role === 'supplier' && (user.status === 'pending' || user.status === 'rejected')) {
    return <SupplierApprovalStatus />;
  }

  if (role === 'buyer' && isBuyerLikeRole(user.role)) {
    return children;
  }

  if (user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;

import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

type AllowedRole = 'buyer' | 'supplier';

interface ProtectedRouteProps {
  role: AllowedRole;
  children: ReactElement;
}

function getDashboardPath(role: string | undefined) {
  if (role === 'supplier') {
    return '/supplier/dashboard';
  }

  if (role === 'admin') {
    return '/admin';
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

  if (user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;

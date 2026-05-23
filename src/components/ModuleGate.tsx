import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import {
  getDefaultModuleState,
  isModuleEnabled,
  ModuleKey,
  useMyModuleActivations,
} from '@/lib/moduleActivation';

const ModuleUnavailable = () => (
  <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4">
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
      <h1 className="text-xl font-semibold text-foreground">Este módulo aún no está disponible.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        El administrador podrá activarlo cuando esté listo para el lanzamiento.
      </p>
    </div>
  </div>
);

export default function ModuleGate({
  moduleKey,
  role,
  children,
}: {
  moduleKey: ModuleKey;
  role: 'buyer' | 'supplier';
  children: ReactNode;
}) {
  const { user } = useAuth();
  const modulesQuery = useMyModuleActivations();

  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  const settings = modulesQuery.data?.modules;
  const enabled = modulesQuery.isLoading
    ? getDefaultModuleState(role, moduleKey)
    : isModuleEnabled(settings, role, moduleKey);

  return enabled ? <>{children}</> : <ModuleUnavailable />;
}

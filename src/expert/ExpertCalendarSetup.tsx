import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Link2, Unplug } from 'lucide-react';
import {
  disconnectMyExpertCalendar,
  getMyCalendarOauthUrl,
  getMyExpertCalendarConnection,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const DEFAULT_TIMEZONE = 'America/Lima';

function getCalendarConnectErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'No se pudo conectar Google Calendar.';

  if (
    message.includes('Google OAuth no configurado') ||
    message.includes('GOOGLE_CLIENT_ID') ||
    message.includes('GOOGLE_OAUTH_REDIRECT_URI')
  ) {
    return 'Google Calendar aun no esta configurado en el servidor. Intenta nuevamente cuando el administrador active la conexion.';
  }

  return message;
}

const ExpertCalendarSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const isBuyer = user?.role === 'buyer';
  const roleLabel = isBuyer ? 'Configuracion comprador' : 'Configuracion Experto';
  const pageTitle = isBuyer ? 'Conecta tu Google Calendar' : 'Conecta Google Calendar';
  const pageDescription = isBuyer
    ? 'Activa la sincronizacion de tus reuniones para que las citas confirmadas tambien se guarden en tu calendario.'
    : 'Este paso activa la disponibilidad real del experto y permite crear reuniones con respaldo en Google Calendar.';
  const [connection, setConnection] = useState<Awaited<
    ReturnType<typeof getMyExpertCalendarConnection>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadConnection = async () => {
      setIsLoading(true);
      setError('');

      try {
        const currentConnection = await getMyExpertCalendarConnection();
        if (!cancelled) {
          setConnection(currentConnection);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el estado de Google Calendar.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const calendarStatus = searchParams.get('calendar');
    const reason = searchParams.get('reason');

    if (calendarStatus === 'connected') {
      toast({
        title: 'Google Calendar conectado',
        description: 'La cuenta ya quedo enlazada con la plataforma.',
      });
    }

    if (calendarStatus === 'error') {
      toast({
        title: 'No se pudo conectar Google Calendar',
        description: reason || 'Ocurrio un problema durante la autorizacion con Google.',
        variant: 'destructive',
      });
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setIsSaving(true);
    setError('');

    try {
      const frontendPath = isBuyer ? '/calendar-setup' : '/expert/calendar-setup';
      const oauth = await getMyCalendarOauthUrl(frontendPath);
      window.location.href = oauth.url;
    } catch (connectError) {
      setError(getCalendarConnectErrorMessage(connectError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError('');

    try {
      await disconnectMyExpertCalendar();
      setConnection({ connected: false });
      await refreshMe();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'No se pudo desconectar Google Calendar.',
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-[640px]"
      >
        <div className="rounded-3xl border border-border/60 bg-card p-7 shadow-sm">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl bg-secondary/10 p-3 text-secondary">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-secondary">
                {roleLabel}
              </p>
              <h1 className="mt-1 text-2xl font-medium text-foreground">
                {pageTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pageDescription}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
              Cargando estado del calendario...
            </div>
          ) : connection?.connected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-success/25 bg-success/15 p-5">
                <div className="flex items-center gap-2 text-success-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium">Google Calendar conectado</p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-success-foreground/90">
                  <p>Correo: {connection.googleEmail ?? 'No disponible'}</p>
                  <p>Calendario: {connection.calendarName ?? connection.calendarId ?? 'primary'}</p>
                  <p>Zona horaria: {connection.timezone ?? DEFAULT_TIMEZONE}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-secondary hover:bg-secondary"
                  onClick={() => navigate('/buyer/dashboard', { replace: true })}
                >
                  Continuar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-5">
                <p className="text-sm font-medium text-foreground">
                  Conecta tu cuenta con Google en un clic
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  La plataforma abrira Google para que autorices el acceso de forma segura.
                  {isBuyer
                    ? ' Puedes seguir sin conectarlo, pero la cita no se copiara automaticamente a tu Google Calendar.'
                    : ' Si eres experto, esta conexion tambien permite validar tu disponibilidad real y crear las reuniones desde tu calendario.'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Link2 className="mt-0.5 h-4 w-4 text-secondary" />
                  <p>
                    El backend completa la autorizacion con Google y solo despues guarda la conexion del calendario en tu cuenta.
                  </p>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-secondary hover:bg-secondary"
                  onClick={handleConnect}
                  disabled={isSaving}
                >
                  {isSaving ? 'Conectando...' : 'Conectar Google Calendar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/buyer/dashboard', { replace: true })}
                >
                  Omitir por ahora
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ExpertCalendarSetup;

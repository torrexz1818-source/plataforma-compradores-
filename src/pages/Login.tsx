import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { normalizeEmail } from '@/lib/emailValidation';

const loginSchema = z.object({
  email: z.string().trim().email('Formato de correo invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
});

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitError('');
    setIsSubmitting(true);

    try {
      await login({ ...form, email: normalizeEmail(form.email) });
      navigate('/home');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
      <Link
        to="/"
        aria-label="Regresar a la pagina principal"
        className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gradient mb-1">BUYER NODUS</h1>
          <p className="text-sm text-muted-foreground">Inicia sesion en tu cuenta</p>
        </div>

        <div className="bg-card rounded-lg shadow-smooth p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Correo electronico</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={() => setForm((current) => ({ ...current, email: normalizeEmail(current.email) }))}
                placeholder="tu@empresa.com"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Contrasena</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="********"
              />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {submitError && <p className="text-xs text-destructive">{submitError}</p>}
            <Button type="submit" className="btn-orange w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Iniciar sesion'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            No tienes cuenta?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Crear cuenta
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

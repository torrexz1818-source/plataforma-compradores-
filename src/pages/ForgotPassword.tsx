import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  requestPasswordReset,
  resetPasswordWithToken,
  verifyPasswordResetCode,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeEmail, validateRealEmail } from '@/lib/emailValidation';

const emailSchema = z.object({
  email: z.string().superRefine((value, ctx) => {
    const result = validateRealEmail(value);
    if (result !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
    }
  }),
});

const codeSchema = z.object({
  code: z.string().trim().length(6, 'Codigo de 6 digitos'),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma tu contrasena'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });

type Step = 'email' | 'code' | 'password' | 'done';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token')?.trim() || '';
  const emailFromUrl = normalizeEmail(searchParams.get('email') || '');
  const [step, setStep] = useState<Step>(tokenFromUrl && emailFromUrl ? 'password' : 'email');
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestOtp = async () => {
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Correo invalido');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const normalized = normalizeEmail(parsed.data.email);
      setEmail(normalized);
      const response = await requestPasswordReset(normalized);
      setMessage(response.message);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    const parsed = codeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Codigo invalido');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const response = await verifyPasswordResetCode(email, parsed.data.code);
      setResetToken(response.resetToken);
      setMessage(response.message);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el codigo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async () => {
    const parsed = passwordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos invalidos');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const response = await resetPasswordWithToken({
        email: normalizeEmail(email),
        resetToken,
        newPassword: parsed.data.password,
      });
      setMessage(response.message || 'Tu contraseña fue actualizada correctamente. Ahora puedes iniciar sesión.');
      setStep('done');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo actualizar la contrasena',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-smooth p-6"
      >
        <h1 className="text-xl font-medium text-foreground mb-1">
          Recuperar contrasena
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          {step === 'email' && 'Ingresa tu correo para recibir instrucciones de restablecimiento.'}
          {step === 'code' &&
            'Revisa tu correo y escribe el codigo de 6 digitos.'}
          {step === 'password' && 'Define una nueva contrasena segura.'}
          {step === 'done' && 'Tu contrasena fue actualizada correctamente.'}
        </p>

        {step === 'email' && (
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail(normalizeEmail(email))}
            />
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={() => void requestOtp()}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar codigo'}
            </Button>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="Codigo de 6 digitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={() => void verifyCode()}
            >
              {isSubmitting ? 'Validando...' : 'Validar codigo'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => void requestOtp()}
            >
              Reenviar codigo
            </Button>
          </div>
        )}

        {step === 'password' && (
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Nueva contrasena (minimo 8 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirmar contrasena"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={() => void resetPassword()}
            >
              {isSubmitting ? 'Actualizando...' : 'Cambiar contrasena'}
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <Button className="w-full" onClick={() => navigate('/login')}>
              Ir a iniciar sesion
            </Button>
          </div>
        )}

        {message && (
          <p className="text-xs text-success-foreground bg-success/15 border border-success/25 rounded-md px-3 py-2 mt-4">
            {message}
          </p>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 mt-4">
            {error}
          </p>
        )}

        <p className="text-sm text-muted-foreground text-center mt-4">
          Volver a{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            iniciar sesion
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

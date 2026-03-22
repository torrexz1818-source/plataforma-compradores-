import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Nombre requerido').max(100),
  company: z.string().trim().min(1, 'Empresa requerida').max(100),
  position: z.string().trim().min(1, 'Cargo requerido').max(100),
  email: z.string().trim().email('Formato de correo invalido').max(255),
  password: z.string().min(6, 'Minimo 6 caracteres'),
});

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', company: '', position: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = registerSchema.safeParse(form);
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
      await register(form);
      navigate('/');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fields = [
    { key: 'fullName', label: 'Nombre completo', placeholder: 'Maria Garcia', type: 'text' },
    { key: 'company', label: 'Empresa', placeholder: 'TechCorp', type: 'text' },
    { key: 'position', label: 'Cargo', placeholder: 'Procurement Manager', type: 'text' },
    { key: 'email', label: 'Correo electronico', placeholder: 'tu@empresa.com', type: 'email' },
    { key: 'password', label: 'Contrasena', placeholder: '********', type: 'password' },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gradient mb-1">SUPPLYCONNECT</h1>
          <p className="text-sm text-muted-foreground">Crea tu cuenta</p>
        </div>

        <div className="bg-card rounded-lg shadow-smooth p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium text-foreground mb-1 block">{field.label}</label>
                <Input
                  type={field.type}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
                {errors[field.key] && <p className="text-xs text-destructive mt-1">{errors[field.key]}</p>}
              </div>
            ))}
            {submitError && <p className="text-xs text-destructive">{submitError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Iniciar sesion
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;

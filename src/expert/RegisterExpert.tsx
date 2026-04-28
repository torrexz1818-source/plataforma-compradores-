import { ChangeEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Network, Sparkles, Upload, Wallet } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const expertSchema = z.object({
  fullName: z.string().trim().min(1, 'Nombre requerido'),
  email: z.string().trim().email('Correo invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
  currentProfessionalProfile: z.string().trim().min(1, 'Perfil profesional actual requerido'),
  industry: z.string().trim().min(1, 'Industria requerida'),
  specialty: z.string().trim().min(1, 'Especialidad requerida'),
  experience: z.string().trim().min(1, 'Experiencia requerida'),
  biography: z.string().trim().min(1, 'Biografia requerida'),
  service: z.string().trim().min(1, 'Servicio requerido'),
});

type FormState = {
  fullName: string;
  email: string;
  password: string;
  currentProfessionalProfile: string;
  industry: string;
  specialty: string;
  experience: string;
  skills: string;
  biography: string;
  companies: string;
  education: string;
  achievements: string;
  photo: string;
  service: string;
  availabilityDays: string[];
};

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const BENEFITS = [
  {
    icon: Wallet,
    title: 'Ingresos adicionales',
    description: 'Monetiza tu experiencia profesional con servicios y acompanamiento especializado.',
  },
  {
    icon: Sparkles,
    title: 'Mayor visibilidad',
    description: 'Posiciona tu perfil como referente dentro del ecosistema de compras de BUYER NODUS.',
  },
  {
    icon: Network,
    title: 'Networking de valor',
    description: 'Conecta con compradores, empresas y otros especialistas de alto nivel.',
  },
];

function SectionTitle({ children }: { children: string }) {
  return <p className="mb-3 mt-6 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">{children}</p>;
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const RegisterExpert = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
    currentProfessionalProfile: '',
    industry: '',
    specialty: '',
    experience: '',
    skills: '',
    biography: '',
    companies: '',
    education: '',
    achievements: '',
    photo: '',
    service: '',
    availabilityDays: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const setValue = (key: keyof FormState, value: string | boolean | string[]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleDay = (day: string) => {
    setForm((current) => ({
      ...current,
      availabilityDays: current.availabilityDays.includes(day)
        ? current.availabilityDays.filter((item) => item !== day)
        : [...current.availabilityDays, day],
    }));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : '');

    if (!file) {
      setValue('photo', '');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setValue('photo', typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = expertSchema.safeParse(form);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        nextErrors[String(issue.path[0] ?? '')] = issue.message;
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError('');
    setIsSubmitting(true);

    try {
      await register({
        fullName: form.fullName,
        company: 'Experto Nexu',
        position: form.currentProfessionalProfile,
        sector: form.industry,
        description: form.biography,
        email: form.email,
        password: form.password,
        role: 'expert',
        expertProfile: {
          currentProfessionalProfile: form.currentProfessionalProfile,
          industry: form.industry,
          specialty: form.specialty,
          experience: form.experience,
          skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean),
          biography: form.biography,
          companies: form.companies,
          education: form.education,
          achievements: form.achievements,
          photo: form.photo,
          service: form.service,
          availabilityDays: form.availabilityDays,
        },
      });
      navigate('/expert/calendar-setup');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-[680px]"
      >
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-2xl font-bold text-gradient">BUYER NODUS</h1>
          <h2 className="text-xl font-medium text-foreground">Conviertete en Experto Nexu</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Comparte tu experiencia, genera nuevas oportunidades y forma parte de la red de especialistas de la plataforma.
          </p>
        </div>

        {!showForm ? (
          <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="rounded-xl border border-border bg-muted/20 p-4">
                  <benefit.icon className="mb-3 h-5 w-5 text-secondary" />
                  <h3 className="text-sm font-medium text-foreground">{benefit.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-secondary/10 bg-secondary/10 p-5">
              <p className="text-sm font-medium text-foreground">Requisitos</p>
              <div className="mt-3 space-y-2 text-sm text-foreground/85">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <span>+3 anos de experiencia</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <span>Especializacion en compras</span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              className="mt-6 w-full bg-secondary hover:bg-secondary"
              onClick={() => setShowForm(true)}
            >
              Postular como Experto
            </Button>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Iniciar sesion
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">Formulario de postulacion</p>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Volver
                </button>
              </div>
            <SectionTitle>Cuenta en Nexu</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre" required error={errors.fullName}>
                <Input value={form.fullName} onChange={(e) => setValue('fullName', e.target.value)} />
              </Field>
              <Field label="Email" required error={errors.email}>
                <Input type="email" value={form.email} onChange={(e) => setValue('email', e.target.value)} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Password" required error={errors.password}>
                <Input type="password" value={form.password} onChange={(e) => setValue('password', e.target.value)} />
              </Field>
            </div>

            <SectionTitle>Perfil profesional actual</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Perfil profesional actual" required error={errors.currentProfessionalProfile}>
                <Input value={form.currentProfessionalProfile} onChange={(e) => setValue('currentProfessionalProfile', e.target.value)} />
              </Field>
              <Field label="Industria" required error={errors.industry}>
                <Input value={form.industry} onChange={(e) => setValue('industry', e.target.value)} />
              </Field>
              <Field label="Especialidad" required error={errors.specialty}>
                <Input value={form.specialty} onChange={(e) => setValue('specialty', e.target.value)} />
              </Field>
              <Field label="Experiencia" required error={errors.experience}>
                <Input value={form.experience} onChange={(e) => setValue('experience', e.target.value)} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Skills">
                <Input
                  value={form.skills}
                  onChange={(e) => setValue('skills', e.target.value)}
                  placeholder="Separadas por comas"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Biografia" required error={errors.biography}>
                <Textarea value={form.biography} onChange={(e) => setValue('biography', e.target.value)} rows={4} />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Empresas">
                <Textarea value={form.companies} onChange={(e) => setValue('companies', e.target.value)} rows={3} />
              </Field>
              <Field label="Educacion">
                <Textarea value={form.education} onChange={(e) => setValue('education', e.target.value)} rows={3} />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Logros">
                <Textarea value={form.achievements} onChange={(e) => setValue('achievements', e.target.value)} rows={3} />
              </Field>
              <Field label="Foto">
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-secondary/20 bg-secondary/5 px-4 py-5 text-center transition hover:border-secondary/30 hover:bg-secondary/10">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Vista previa de la foto" className="h-24 w-24 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-secondary shadow-sm">
                      <Upload className="h-6 w-6" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {photoFile ? photoFile.name : 'Subir imagen por archivo'}
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG o WEBP en buena calidad.</p>
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
                </label>
              </Field>
            </div>

            <SectionTitle>Temas destacados</SectionTitle>
            <Field label="Agrega los temas en que mas destacas" required error={errors.service}>
              <Textarea
                value={form.service}
                onChange={(e) => setValue('service', e.target.value)}
                rows={3}
                placeholder="Ej: negociacion, compras estrategicas, abastecimiento, licitaciones, logistica."
              />
            </Field>

            <div className="mt-3">
              <Field label="Disponibilidad de dias">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        form.availabilityDays.includes(day)
                          ? 'border-secondary/40 bg-secondary/10 font-medium text-secondary'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <SectionTitle>Integracion</SectionTitle>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 text-secondary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    La conexion real de Google Calendar se hace en el siguiente paso
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Primero crearemos tu cuenta de experto y luego te llevaremos a una pantalla protegida para validar y guardar el calendario en backend.
                  </p>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {submitError}
              </p>
            )}

            <Button type="submit" className="mt-6 w-full bg-secondary hover:bg-secondary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta como Experto Nexu'}
            </Button>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Iniciar sesion
              </Link>
            </p>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RegisterExpert;

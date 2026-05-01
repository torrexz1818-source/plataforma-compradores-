import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createSupplierOnboardingSession, registerSupplierOnboardingShare } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { normalizeEmail, validateRealEmail } from '@/lib/emailValidation';

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Nombre requerido').max(100),
  position: z.string().trim().min(1, 'Cargo requerido').max(100),
  ruc: z.string().trim().min(8, 'RUC invalido').max(11, 'RUC invalido'),
  razonSocial: z.string().trim().min(1, 'Razon social requerida').max(200),
  company: z.string().trim().max(100).optional(),
  sector: z.string().trim().min(1, 'Sector requerido'),
  employees: z.string().optional(),
  phone: z.string().trim().min(1, 'Telefono requerido').max(20),
  email: z.string().max(255).superRefine((value, ctx) => {
    const result = validateRealEmail(value);
    if (result !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
    }
  }),
  password: z.string().min(8, 'Minimo 8 caracteres'),
  role: z.enum(['buyer', 'supplier'], { required_error: 'Selecciona un tipo de cuenta' }),
  linkedin: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  instagram: z.string().trim().max(100).optional(),
  categories: z.array(z.string()).optional(),
  volume: z.string().optional(),
  digitalized: z.string().optional(),
  usesAI: z.string().optional(),
  supplierType: z.string().optional(),
  offerCategories: z.array(z.string()).optional(),
  coverage: z.string().optional(),
  province: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  supplierDescription: z.string().trim().max(500).optional(),
  yearsInMarket: z.string().optional(),
  hasCatalog: z.string().optional(),
});

type FormState = {
  fullName: string;
  position: string;
  ruc: string;
  razonSocial: string;
  company: string;
  sector: string;
  employees: string;
  phone: string;
  email: string;
  password: string;
  role: string;
  linkedin: string;
  website: string;
  whatsapp: string;
  instagram: string;
  categories: string[];
  volume: string;
  digitalized: string;
  usesAI: string;
  supplierType: string;
  offerCategories: string[];
  coverage: string;
  province: string;
  district: string;
  supplierDescription: string;
  yearsInMarket: string;
  hasCatalog: string;
};

const SECTORS = [
  'Retail',
  'Manufactura',
  'Salud',
  'Tecnologia',
  'Educacion',
  'Logistica',
  'Construccion',
  'Agroindustria',
  'Otro',
];
const EMPLOYEES = ['1-10', '11-50', '51-200', '201-500', '+500'];
const CATEGORIES = ['Tecnologia', 'Insumos', 'Marketing', 'Logistica', 'RRHH', 'Manufactura', 'Construccion', 'Otro'];
const VOLUMES = ['Menos de $5,000', '$5,000 - $20,000', '$20,000 - $100,000', '+$100,000'];
const COVERAGES = ['Local (ciudad)', 'Nacional', 'Latinoamerica', 'Global'];
const YEARS = ['Menos de 1 ano', '1-3 anos', '3-10 anos', '+10 anos'];
const SUPPLIER_ONBOARDING_STORAGE_KEY = 'supplynexu_supplier_onboarding_session';

function readStoredShareSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SUPPLIER_ONBOARDING_STORAGE_KEY);
}

function writeStoredShareSessionId(sessionId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(SUPPLIER_ONBOARDING_STORAGE_KEY, sessionId);
    return;
  }

  window.localStorage.removeItem(SUPPLIER_ONBOARDING_STORAGE_KEY);
}

const SUPPLIER_TYPES = [
  { value: 'provider', icon: '🏪', title: 'Solo proveedor', desc: 'Ofrece productos o servicios de terceros' },
  { value: 'distributor', icon: '🚚', title: 'Distribuidor', desc: 'Distribuye y gestiona logistica regional o nacional' },
  { value: 'manufacturer', icon: '🏭', title: 'Fabricante', desc: 'Produce y manufactura sus propios productos' },
];

function pwStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3;
}
const PW_LABELS = ['', 'Muy debil', 'Media', 'Segura'];
const PW_COLORS = ['', 'bg-destructive', 'bg-destructive', 'bg-success'];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mt-6 mb-3">
      {children}
    </p>
  );
}

function FieldWrap({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function YNGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; color: 'green' | 'amber' | 'red' }[];
}) {
  const colorMap = {
    green: 'border-success/45 bg-success/15 text-success-foreground font-medium',
    amber: 'border-destructive/40 bg-destructive/10 text-destructive font-medium',
    red: 'border-destructive/30 bg-destructive/10 text-destructive font-medium',
  };
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-3 rounded-lg border text-[13px] transition-all ${value === opt.value
            ? colorMap[opt.color]
            : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TagRow({
  tags,
  selected,
  onToggle,
  color,
}: {
  tags: string[];
  selected: string[];
  onToggle: (t: string) => void;
  color: 'buyer' | 'green';
}) {
  const activeClass =
    color === 'buyer'
      ? 'border-destructive/40 bg-destructive/10 text-destructive font-medium'
      : 'border-success/45 bg-success/15 text-success-foreground font-medium';
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={`px-3 py-1.5 rounded-full border text-[12px] transition-all ${selected.includes(tag)
            ? activeClass
            : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

function SocialInput({
  icon,
  prefix,
  placeholder,
  value,
  onChange,
  iconBg,
}: {
  icon: string;
  prefix: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[88px] shrink-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span
          className={`w-5 h-5 rounded flex items-center justify-center text-white text-[11px] font-medium shrink-0 ${iconBg}`}
        >
          {icon}
        </span>
        {prefix.split('.')[0].charAt(0).toUpperCase() + prefix.split('.')[0].slice(1)}
      </span>
      <div className="flex flex-1 items-center border border-border rounded-lg overflow-hidden focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <span className="px-3 py-2.5 bg-muted/50 border-r border-border text-[12px] text-muted-foreground whitespace-nowrap">
          {prefix}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

function ProgressBar({ form }: { form: FormState }) {
  const requiredFields: (keyof FormState)[] = [
    'fullName',
    'position',
    'ruc',
    'razonSocial',
    'sector',
    'phone',
    'email',
    'password',
  ];
  const filled = requiredFields.filter((k) => String(form[k]).trim() !== '').length;
  const pct = Math.round((filled / requiredFields.length) * 100);
  const isBuyer = form.role === 'buyer';
  return (
    <div className="mb-5">
      <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
        <span>Progreso del registro</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isBuyer ? 'bg-destructive' : 'bg-success'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState<FormState>({
    fullName: '',
    position: '',
    ruc: '',
    razonSocial: '',
    company: '',
    sector: '',
    employees: '',
    phone: '',
    email: '',
    password: '',
    role: '',
    linkedin: '',
    website: '',
    whatsapp: '',
    instagram: '',
    categories: [],
    volume: '',
    digitalized: '',
    usesAI: '',
    supplierType: '',
    offerCategories: [],
    coverage: '',
    province: '',
    district: '',
    supplierDescription: '',
    yearsInMarket: '',
    hasCatalog: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [shareCount, setShareCount] = useState(0);
  const [requiredShareCount, setRequiredShareCount] = useState(3);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);
  const [isPreparingShareSession, setIsPreparingShareSession] = useState(false);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const toggleArray = (key: 'categories' | 'offerCategories', val: string) => {
    setForm((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  };

  const getRoleFromToken = (token: string): 'buyer' | 'supplier' => {
    try {
      const payloadPart = token.split('.')[1] ?? '';
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as { role?: string };

      if (payload.role === 'supplier') {
        return 'supplier';
      }
    } catch {
      // fallback handled below
    }

    return 'buyer';
  };

  const sharePageUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/register?role=supplier` : '';

  const syncShareSession = (session: {
    id: string;
    shareCount: number;
    requiredShares: number;
  }) => {
    setShareSessionId(session.id);
    setShareCount(session.shareCount);
    setRequiredShareCount(session.requiredShares);
    writeStoredShareSessionId(session.id);
  };

  const ensureShareSession = async () => {
    const storedSessionId =
      shareSessionId ?? readStoredShareSessionId() ?? undefined;
    const session = await createSupplierOnboardingSession(storedSessionId);
    syncShareSession(session);
    return session;
  };

  const registerShareSuccess = (
    actionLabel: string,
    session: { shareCount: number; requiredShares: number; remainingShares: number },
  ) => {
    setShareError('');
    setShareFeedback(
      session.remainingShares === 0
        ? `${actionLabel}. Requisito completado: ${session.shareCount} de ${session.requiredShares} compartidos.`
        : `${actionLabel}. Enviado ${session.shareCount} de ${session.requiredShares} compartidos requeridos.`,
    );
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(sharePageUrl);
      const session = await ensureShareSession();
      const updatedSession = await registerSupplierOnboardingShare(session.id, {
        method: 'copy',
      });
      syncShareSession(updatedSession);
      registerShareSuccess('Link copiado', updatedSession);
    } catch {
      setShareFeedback('');
      setShareError('No se pudo copiar el link de la pagina. Intenta nuevamente.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      await handleCopyShareLink();
      return;
    }

    try {
      await navigator.share({
        title: 'BUYER NODUS',
        text: 'Te comparto la pagina de registro para proveedores.',
        url: sharePageUrl,
      });
      const session = await ensureShareSession();
      const updatedSession = await registerSupplierOnboardingShare(session.id, {
        method: 'native',
      });
      syncShareSession(updatedSession);
      registerShareSuccess('Pagina compartida', updatedSession);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      setShareFeedback('');
      setShareError('No se pudo compartir la pagina. Intenta nuevamente.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = registerSchema.safeParse({ ...form, role: form.role || undefined });
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
    setShareFeedback('');

    if (form.role === 'supplier' && (!shareSessionId || shareCount < requiredShareCount)) {
      setShareError(`Comparte el link de esta pagina con ${requiredShareCount} personas antes de crear la cuenta de proveedor.`);
      return;
    }

    setShareError('');
    setIsSubmitting(true);
    try {
      const normalizedCoverage = (form.coverage || '').trim();
      const normalizedProvince = (form.province || '').trim();
      const normalizedDistrict = (form.district || '').trim();
      const supplierLocation = [normalizedCoverage, normalizedProvince, normalizedDistrict]
        .filter((value) => value.length > 0)
        .join(' - ');

      const response = await register({
        fullName: form.fullName,
        company: form.razonSocial,
        commercialName: form.company || undefined,
        position: form.position,
        ruc: form.ruc,
        phone: form.phone,
        sector: form.sector || undefined,
        location: form.role === 'supplier' ? supplierLocation || undefined : (form.coverage || '').trim() || undefined,
        description: form.role === 'supplier' ? (form.supplierDescription || '').trim() || undefined : undefined,
        employeeCount: form.employees || undefined,
        digitalPresence: {
          linkedin: form.linkedin || undefined,
          website: form.website || undefined,
          whatsapp: form.whatsapp || undefined,
          instagram: form.instagram || undefined,
        },
        buyerProfile: form.role === 'buyer'
          ? {
              interestCategories: form.categories,
              purchaseVolume: form.volume || undefined,
              isCompanyDigitalized: form.digitalized || undefined,
              usesGenerativeAI: form.usesAI || undefined,
            }
          : undefined,
        supplierProfile: form.role === 'supplier'
          ? {
              supplierType: form.supplierType || undefined,
              productsOrServices: form.offerCategories,
              hasDigitalCatalog: form.hasCatalog || undefined,
              isCompanyDigitalized: form.digitalized || undefined,
              usesGenerativeAI: form.usesAI || undefined,
              coverage: normalizedCoverage || undefined,
              province: normalizedProvince || undefined,
              district: normalizedDistrict || undefined,
              yearsInMarket: form.yearsInMarket || undefined,
            }
          : undefined,
        supplierOnboarding:
          form.role === 'supplier' && shareSessionId
            ? { sessionId: shareSessionId }
            : undefined,
        email: normalizeEmail(form.email),
        password: form.password,
        role: form.role as 'buyer' | 'supplier',
      });
      if (form.role === 'supplier') {
        writeStoredShareSessionId(null);
      }
      const role = getRoleFromToken(response.accessToken);
      navigate(role === 'supplier' ? '/supplier/dashboard' : '/buyer/dashboard');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuyer = form.role === 'buyer';
  const isSupplier = form.role === 'supplier';
  const strength = pwStrength(form.password);
  const isSupplierFormReadyToShare =
    isSupplier &&
    form.fullName.trim().length > 0 &&
    form.position.trim().length > 0 &&
    form.ruc.trim().length >= 8 &&
    form.razonSocial.trim().length > 0 &&
    form.sector.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.supplierType.trim().length > 0 &&
    form.offerCategories.length > 0;
  const supplierCanSubmit =
    !isSupplier || (Boolean(shareSessionId) && shareCount >= requiredShareCount);

  useEffect(() => {
    if (!isSupplierFormReadyToShare) {
      return;
    }

    let cancelled = false;

    const bootstrapShareSession = async () => {
      setIsPreparingShareSession(true);

      try {
        const storedSessionId =
          shareSessionId ?? readStoredShareSessionId() ?? undefined;
        const session = await createSupplierOnboardingSession(storedSessionId);
        if (!cancelled) {
          setShareSessionId(session.id);
          setShareCount(session.shareCount);
          setRequiredShareCount(session.requiredShares);
          writeStoredShareSessionId(session.id);
        }
      } catch {
        if (!cancelled) {
          setShareFeedback('');
          setShareError(
            'No se pudo preparar el seguimiento de compartidos. Recarga la pagina e intenta nuevamente.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsPreparingShareSession(false);
        }
      }
    };

    void bootstrapShareSession();

    return () => {
      cancelled = true;
    };
  }, [isSupplierFormReadyToShare, shareSessionId]);

  return (
    <div className="min-h-screen flex items-start justify-center bg-background p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-[560px]"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gradient mb-1">BUYER NODUS</h1>
          <h1 className="text-xl font-medium text-foreground tracking-tight">Crear cuenta</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Unete a la plataforma de compradores y proveedores
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-7">
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="flex bg-muted/60 rounded-xl p-1 gap-1 mb-6">
              {[
                { value: 'buyer', label: 'Soy Comprador', dot: 'bg-destructive' },
                { value: 'supplier', label: 'Soy Proveedor', dot: 'bg-success' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('role', opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[14px] font-medium transition-all ${form.role === opt.value
                    ? 'bg-card shadow-sm border border-border/60 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${opt.dot} ${form.role === opt.value ? 'opacity-100' : 'opacity-30'}`}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.role && <p className="text-xs text-destructive -mt-4 mb-4">{errors.role}</p>}

            {form.role && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 pb-4 mb-1 border-b border-border/50"
              >
                <span
                  className={`text-[11px] font-medium px-3 py-1 rounded-full ${isBuyer ? 'bg-destructive/10 text-destructive' : 'bg-success/15 text-success-foreground'
                    }`}
                >
                  {isBuyer ? 'Comprador' : 'Proveedor'}
                </span>
                <p className="text-[13px] text-muted-foreground">
                  {isBuyer
                    ? 'Encuentra proveedores verificados para tu empresa'
                    : 'Conecta tu negocio con compradores calificados'}
                </p>
              </motion.div>
            )}

            <ProgressBar form={form} />

            <SectionLabel>Datos personales</SectionLabel>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FieldWrap label="Nombre completo" required error={errors.fullName}>
                <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Ej. Ana Torres" />
              </FieldWrap>
              <FieldWrap label="Cargo" required error={errors.position}>
                <Input
                  value={form.position}
                  onChange={(e) => set('position', e.target.value)}
                  placeholder="Ej. Gerente de Compras"
                />
              </FieldWrap>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Correo electronico" required error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  onBlur={() => set('email', normalizeEmail(form.email))}
                  placeholder="ana@empresa.com"
                />
              </FieldWrap>
              <FieldWrap label="Numero de celular" required error={errors.phone}>
                <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+51 999 999 999" />
              </FieldWrap>
            </div>

            <SectionLabel>Datos de empresa</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldWrap label="RUC" required error={errors.ruc}>
                  <Input
                    value={form.ruc}
                    onChange={(e) => set('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="20xxxxxxxxx"
                  />
                </FieldWrap>
                <FieldWrap label="Razon social" required error={errors.razonSocial}>
                  <Input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} placeholder="Nombre legal" />
                </FieldWrap>
              </div>
              <FieldWrap label="Nombre comercial" error={errors.company}>
                <Input
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  placeholder="Nombre con el que se conoce la empresa"
                />
              </FieldWrap>
              <div className="grid grid-cols-2 gap-3">
                <FieldWrap label="Sector" required error={errors.sector}>
                  <select
                    value={form.sector}
                    onChange={(e) => set('sector', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar...</option>
                    {SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </FieldWrap>
                <FieldWrap label="Numero de empleados">
                  <select
                    value={form.employees}
                    onChange={(e) => set('employees', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar...</option>
                    {EMPLOYEES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </FieldWrap>
              </div>
            </div>

            {isSupplier && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionLabel>
                  Tipo de proveedor <span className="text-destructive">*</span>
                </SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPLIER_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => set('supplierType', t.value)}
                      className={`border rounded-xl p-3 text-center transition-all ${form.supplierType === t.value ? 'border-success/45 bg-success/15' : 'border-border hover:bg-muted/50'
                        }`}
                    >
                      <span className="text-xl block mb-1.5">{t.icon}</span>
                      <p
                        className={`text-[13px] font-medium ${form.supplierType === t.value ? 'text-success-foreground' : 'text-foreground'}`}
                      >
                        {t.title}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 leading-tight ${form.supplierType === t.value ? 'text-success-foreground' : 'text-muted-foreground'}`}
                      >
                        {t.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <SectionLabel>Presencia digital</SectionLabel>
            <div className="space-y-2">
              <SocialInput icon="in" prefix="linkedin.com/in/" placeholder="tu-perfil" value={form.linkedin} onChange={(v) => set('linkedin', v)} iconBg="bg-primary" />
              <SocialInput icon="W" prefix="https://" placeholder="www.tuempresa.com" value={form.website} onChange={(v) => set('website', v)} iconBg="bg-foreground" />
              <SocialInput icon="W" prefix="+51 " placeholder="999 999 999" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} iconBg="bg-success" />
              <SocialInput icon="ig" prefix="@" placeholder="tuempresa" value={form.instagram} onChange={(v) => set('instagram', v)} iconBg="bg-destructive" />
            </div>

            {isBuyer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <SectionLabel>Necesidades de compra</SectionLabel>
                <FieldWrap label="Categorias de interes" required>
                  <TagRow tags={CATEGORIES} selected={form.categories} onToggle={(v) => toggleArray('categories', v)} color="buyer" />
                </FieldWrap>
                <FieldWrap label="Volumen mensual aprox. de compra">
                  <select
                    value={form.volume}
                    onChange={(e) => set('volume', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar...</option>
                    {VOLUMES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldWrap>
              </motion.div>
            )}

            {isSupplier && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <SectionLabel>Oferta comercial</SectionLabel>
                <FieldWrap label="Productos o servicios que ofrece" required>
                  <TagRow
                    tags={CATEGORIES}
                    selected={form.offerCategories}
                    onToggle={(v) => toggleArray('offerCategories', v)}
                    color="green"
                  />
                </FieldWrap>
                <div className="grid grid-cols-2 gap-3">
                  <FieldWrap label="Zonas de cobertura">
                    <select
                      value={form.coverage}
                      onChange={(e) => set('coverage', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar...</option>
                      {COVERAGES.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </FieldWrap>
                  <FieldWrap label="Provincia">
                    <Input
                      value={form.province}
                      onChange={(e) => set('province', e.target.value)}
                      placeholder="Ej. Lima"
                    />
                  </FieldWrap>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldWrap label="Distrito">
                    <Input
                      value={form.district}
                      onChange={(e) => set('district', e.target.value)}
                      placeholder="Ej. Miraflores"
                    />
                  </FieldWrap>
                  <FieldWrap label="Tiempo en el mercado">
                    <select
                      value={form.yearsInMarket}
                      onChange={(e) => set('yearsInMarket', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar...</option>
                      {YEARS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </FieldWrap>
                </div>
                <FieldWrap label="Descripcion del proveedor">
                  <textarea
                    value={form.supplierDescription}
                    onChange={(e) => set('supplierDescription', e.target.value)}
                    placeholder="Describe tus productos o servicios principales"
                    className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FieldWrap>
                <FieldWrap label="Tiene catalogo digital?">
                  <YNGroup
                    value={form.hasCatalog}
                    onChange={(v) => set('hasCatalog', v)}
                    options={[
                      { value: 'yes', label: 'Si', color: 'green' },
                      { value: 'in_progress', label: 'En desarrollo', color: 'amber' },
                      { value: 'no', label: 'No', color: 'red' },
                    ]}
                  />
                </FieldWrap>
              </motion.div>
            )}

            <SectionLabel>Digitalizacion</SectionLabel>
            <div className="space-y-3">
              <FieldWrap label="¿Tu empresa esta digitalizada en el proceso de compras ?">
                <YNGroup
                  value={form.digitalized}
                  onChange={(v) => set('digitalized', v)}
                  options={[
                    { value: 'yes', label: 'Si', color: 'green' },
                    { value: 'in_progress', label: 'En proceso', color: 'amber' },
                    { value: 'no', label: 'No', color: 'red' },
                  ]}
                />
              </FieldWrap>
              <FieldWrap label="¿Usan IA generativa en el proceso de compras?">
                <YNGroup
                  value={form.usesAI}
                  onChange={(v) => set('usesAI', v)}
                  options={[
                    { value: 'yes', label: 'Si', color: 'green' },
                    { value: 'evaluating', label: 'Evaluando', color: 'amber' },
                    { value: 'no', label: 'No', color: 'red' },
                  ]}
                />
              </FieldWrap>
            </div>

            <div className="border-t border-border/50 mt-6 pt-5">
              <FieldWrap label="Contrasena" required error={errors.password}>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Minimo 8 caracteres"
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-[3px] rounded-full transition-all ${i <= strength ? PW_COLORS[strength] : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{PW_LABELS[strength]}</p>
                  </div>
                )}
              </FieldWrap>
            </div>

            {isSupplier && isSupplierFormReadyToShare && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <SectionLabel>Activa tu cuenta de proveedor</SectionLabel>
                <div className="rounded-2xl border border-success/25 bg-success/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-success-foreground">
                        Comparte esta pagina con {requiredShareCount} personas
                      </p>
                      <p className="text-xs text-success-foreground/80 mt-1">
                        Cuando completes los {requiredShareCount} compartidos, se habilitara el boton de crear cuenta para proveedor.
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-success-foreground border border-success/25">
                      {shareCount}/{requiredShareCount} compartidos
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-success/25">
                    <div
                      className="h-full rounded-full bg-success transition-all duration-500"
                      style={{ width: `${Math.min((shareCount / Math.max(requiredShareCount, 1)) * 100, 100)}%` }}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-success/30 bg-white/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-success-foreground">
                      Link para compartir
                    </p>
                    <div className="mt-2 rounded-lg border border-success/15 bg-success/15 px-3 py-2 text-xs text-success-foreground break-all">
                      {sharePageUrl}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button type="button" variant="outline" onClick={handleCopyShareLink} disabled={isPreparingShareSession}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar link
                      </Button>
                      <Button type="button" variant="outline" onClick={handleNativeShare} disabled={isPreparingShareSession}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Compartir pagina
                      </Button>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {Array.from({ length: requiredShareCount }, (_, index) => index + 1).map((step) => (
                        <div
                          key={step}
                          className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium ${
                            shareCount >= step
                              ? 'border-success/35 bg-success/25 text-success-foreground'
                              : 'border-destructive/20 bg-destructive/10 text-destructive'
                          }`}
                        >
                          {shareCount >= step ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Compartido {step}
                            </span>
                          ) : (
                            <span>Pendiente {step}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {shareError && (
                    <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 mt-3">
                      {shareError}
                    </p>
                  )}

                  {!shareError && shareFeedback && (
                    <p className="text-xs text-success-foreground bg-white border border-success/25 rounded-lg px-3 py-2 mt-3">
                      {shareFeedback}
                    </p>
                  )}

                  {!shareError && isPreparingShareSession && (
                    <p className="text-xs text-success-foreground bg-white border border-success/25 rounded-lg px-3 py-2 mt-3">
                      Preparando el seguimiento persistente de compartidos...
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {isSupplier && !isSupplierFormReadyToShare && (
              <div className="rounded-2xl border border-dashed border-success/25 bg-success/10 p-4 mt-6">
                <p className="text-sm font-medium text-success-foreground">
                  Completa los datos del proveedor para activar el compartir
                </p>
                <p className="text-xs text-success-foreground/80 mt-1">
                  Cuando termines el formulario, aparecera el link para compartir la pagina con {requiredShareCount} personas.
                </p>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 mt-3">
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              className={`w-full mt-5 ${isSupplier ? 'bg-success hover:bg-success' : ''}`}
              disabled={isSubmitting || !supplierCanSubmit}
            >
              {isSubmitting
                ? 'Creando cuenta...'
                : isSupplier && !isSupplierFormReadyToShare
                  ? 'Completa el formulario para activar compartir'
                  : isSupplier && isPreparingShareSession
                  ? 'Preparando activacion del proveedor...'
                  : isSupplier && !supplierCanSubmit
                  ? `Comparte con ${Math.max(requiredShareCount - shareCount, 0)} persona${Math.max(requiredShareCount - shareCount, 0) === 1 ? '' : 's'} mas para activar la cuenta`
                  : `Crear cuenta${form.role === 'buyer' ? ' como Comprador' : form.role === 'supplier' ? ' como Proveedor' : ''}`}
            </Button>

            <p className="text-center text-[12px] text-muted-foreground mt-3 leading-relaxed">
              Al registrarte aceptas nuestros <a href="#" className="text-primary hover:underline">Terminos de uso</a> y{' '}
              <a href="#" className="text-primary hover:underline">Politica de privacidad</a>
            </p>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Iniciar sesion
              </Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;

import { ReactNode, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Nombre requerido').max(100),
  position: z.string().trim().min(1, 'Cargo requerido').max(100),
  ruc: z.string().trim().min(8, 'RUC invalido').max(11, 'RUC invalido'),
  razonSocial: z.string().trim().min(1, 'Razon social requerida').max(200),
  company: z.string().trim().max(100).optional(),
  sector: z.string().trim().min(1, 'Sector requerido'),
  employees: z.string().optional(),
  phone: z.string().trim().min(1, 'Telefono requerido').max(20),
  email: z.string().trim().email('Formato de correo invalido').max(255),
  password: z.string().min(6, 'Minimo 6 caracteres'),
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
const PW_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-500'];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mt-6 mb-3">
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
    green: 'border-emerald-400 bg-emerald-50 text-emerald-800 font-medium',
    amber: 'border-amber-400 bg-amber-50 text-amber-800 font-medium',
    red: 'border-red-300 bg-red-50 text-red-800 font-medium',
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
  color: 'blue' | 'green';
}) {
  const activeClass =
    color === 'blue'
      ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium'
      : 'border-emerald-400 bg-emerald-50 text-emerald-800 font-medium';
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
          className={`w-5 h-5 rounded flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${iconBg}`}
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
          className={`h-full rounded-full transition-all duration-500 ${isBuyer ? 'bg-blue-500' : 'bg-emerald-500'}`}
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
    yearsInMarket: '',
    hasCatalog: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    setIsSubmitting(true);
    try {
      const response = await register({
        fullName: form.fullName,
        company: form.razonSocial,
        position: form.position,
        ruc: form.ruc,
        phone: form.phone,
        sector: form.sector || undefined,
        location: (form.coverage || '').trim() || undefined,
        email: form.email,
        password: form.password,
        role: form.role as 'buyer' | 'supplier',
      });
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

  return (
    <div className="min-h-screen flex items-start justify-center bg-[#F8FAFC] p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-[560px]"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gradient mb-1">SUPPLYCONNECT</h1>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Crear cuenta</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Unete a la plataforma de compradores y proveedores
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-7">
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="flex bg-muted/60 rounded-xl p-1 gap-1 mb-6">
              {[
                { value: 'buyer', label: 'Soy Comprador', dot: 'bg-blue-500' },
                { value: 'supplier', label: 'Soy Proveedor', dot: 'bg-emerald-500' },
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
                  className={`text-[11px] font-semibold px-3 py-1 rounded-full ${isBuyer ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
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
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ana@empresa.com" />
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
                      className={`border rounded-xl p-3 text-center transition-all ${form.supplierType === t.value ? 'border-emerald-400 bg-emerald-50' : 'border-border hover:bg-muted/50'
                        }`}
                    >
                      <span className="text-xl block mb-1.5">{t.icon}</span>
                      <p
                        className={`text-[13px] font-medium ${form.supplierType === t.value ? 'text-emerald-800' : 'text-foreground'}`}
                      >
                        {t.title}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 leading-tight ${form.supplierType === t.value ? 'text-emerald-700' : 'text-muted-foreground'}`}
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
              <SocialInput icon="in" prefix="linkedin.com/in/" placeholder="tu-perfil" value={form.linkedin} onChange={(v) => set('linkedin', v)} iconBg="bg-[#0077B5]" />
              <SocialInput icon="W" prefix="https://" placeholder="www.tuempresa.com" value={form.website} onChange={(v) => set('website', v)} iconBg="bg-foreground" />
              <SocialInput icon="W" prefix="+51 " placeholder="999 999 999" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} iconBg="bg-[#25D366]" />
              <SocialInput icon="ig" prefix="@" placeholder="tuempresa" value={form.instagram} onChange={(v) => set('instagram', v)} iconBg="bg-[#E1306C]" />
            </div>

            {isBuyer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <SectionLabel>Necesidades de compra</SectionLabel>
                <FieldWrap label="Categorias de interes" required>
                  <TagRow tags={CATEGORIES} selected={form.categories} onToggle={(v) => toggleArray('categories', v)} color="blue" />
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
              <FieldWrap label="Tu empresa esta digitalizada?">
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
              <FieldWrap label="Usan IA generativa?">
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
                    placeholder="Minimo 6 caracteres"
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

            {submitError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 mt-3">
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              className={`w-full mt-5 ${isSupplier ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Creando cuenta...'
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

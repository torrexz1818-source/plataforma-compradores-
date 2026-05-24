import { useEffect, useRef, useState } from 'react';
import { Edit, LogOut, UserRound } from 'lucide-react';
import { updateMyProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function getInitials(name?: string) {
  return (name || 'Usuario')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const emptyForm = {
  fullName: '',
  company: '',
  commercialName: '',
  position: '',
  phone: '',
  ruc: '',
  sector: '',
  location: '',
  description: '',
  employeeCount: '',
  linkedin: '',
  website: '',
  whatsapp: '',
  instagram: '',
  buyerInterestCategories: '',
  buyerPurchaseVolume: '',
  buyerDigitalized: '',
  buyerUsesAI: '',
  supplierType: '',
  supplierProductsOrServices: '',
  supplierHasCatalog: '',
  supplierDigitalized: '',
  supplierUsesAI: '',
  supplierCoverage: '',
  supplierProvince: '',
  supplierDistrict: '',
  supplierYearsInMarket: '',
  expertCurrentProfile: '',
  expertIndustry: '',
  expertSpecialty: '',
  expertExperience: '',
  expertSkills: '',
  expertBiography: '',
  expertCompanies: '',
  expertEducation: '',
  expertAchievements: '',
  expertPhoto: '',
  expertService: '',
  expertAvailabilityDays: '',
};

const UserMenu = () => {
  const { user, logout, refreshMe } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadUserForm = () => {
    setForm({
      fullName: user?.fullName ?? '',
      company: user?.company ?? '',
      commercialName: user?.commercialName ?? '',
      position: user?.position ?? '',
      phone: user?.phone ?? '',
      ruc: user?.ruc ?? '',
      sector: user?.sector ?? '',
      location: user?.location ?? '',
      description: user?.description ?? '',
      employeeCount: user?.employeeCount ?? '',
      linkedin: user?.digitalPresence?.linkedin ?? '',
      website: user?.digitalPresence?.website ?? '',
      whatsapp: user?.digitalPresence?.whatsapp ?? '',
      instagram: user?.digitalPresence?.instagram ?? '',
      buyerInterestCategories: user?.buyerProfile?.interestCategories?.join(', ') ?? '',
      buyerPurchaseVolume: user?.buyerProfile?.purchaseVolume ?? '',
      buyerDigitalized: user?.buyerProfile?.isCompanyDigitalized ?? '',
      buyerUsesAI: user?.buyerProfile?.usesGenerativeAI ?? '',
      supplierType: user?.supplierProfile?.supplierType ?? '',
      supplierProductsOrServices: user?.supplierProfile?.productsOrServices?.join(', ') ?? '',
      supplierHasCatalog: user?.supplierProfile?.hasDigitalCatalog ?? '',
      supplierDigitalized: user?.supplierProfile?.isCompanyDigitalized ?? '',
      supplierUsesAI: user?.supplierProfile?.usesGenerativeAI ?? '',
      supplierCoverage: user?.supplierProfile?.coverage ?? '',
      supplierProvince: user?.supplierProfile?.province ?? '',
      supplierDistrict: user?.supplierProfile?.district ?? '',
      supplierYearsInMarket: user?.supplierProfile?.yearsInMarket ?? '',
      expertCurrentProfile: user?.expertProfile?.currentProfessionalProfile ?? '',
      expertIndustry: user?.expertProfile?.industry ?? '',
      expertSpecialty: user?.expertProfile?.specialty ?? '',
      expertExperience: user?.expertProfile?.experience ?? '',
      expertSkills: user?.expertProfile?.skills?.join(', ') ?? '',
      expertBiography: user?.expertProfile?.biography ?? '',
      expertCompanies: user?.expertProfile?.companies ?? '',
      expertEducation: user?.expertProfile?.education ?? '',
      expertAchievements: user?.expertProfile?.achievements ?? '',
      expertPhoto: user?.expertProfile?.photo ?? '',
      expertService: user?.expertProfile?.service ?? '',
      expertAvailabilityDays: user?.expertProfile?.availabilityDays?.join(', ') ?? '',
    });
  };

  useEffect(() => {
    loadUserForm();
  }, [user]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSave = async () => {
    setError('');
    setFeedback('');

    if (!form.fullName.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    try {
      setIsSaving(true);
      await updateMyProfile({
        fullName: form.fullName.trim(),
        company: form.company.trim(),
        commercialName: form.commercialName.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        ruc: form.ruc.trim(),
        sector: form.sector.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        employeeCount: form.employeeCount.trim(),
        digitalPresence: {
          linkedin: form.linkedin.trim(),
          website: form.website.trim(),
          whatsapp: form.whatsapp.trim(),
          instagram: form.instagram.trim(),
        },
        buyerProfile: user?.role === 'buyer'
          ? {
              interestCategories: splitList(form.buyerInterestCategories),
              purchaseVolume: form.buyerPurchaseVolume.trim(),
              isCompanyDigitalized: form.buyerDigitalized.trim(),
              usesGenerativeAI: form.buyerUsesAI.trim(),
            }
          : undefined,
        supplierProfile: user?.role === 'supplier'
          ? {
              supplierType: form.supplierType.trim(),
              productsOrServices: splitList(form.supplierProductsOrServices),
              hasDigitalCatalog: form.supplierHasCatalog.trim(),
              isCompanyDigitalized: form.supplierDigitalized.trim(),
              usesGenerativeAI: form.supplierUsesAI.trim(),
              coverage: form.supplierCoverage.trim(),
              province: form.supplierProvince.trim(),
              district: form.supplierDistrict.trim(),
              yearsInMarket: form.supplierYearsInMarket.trim(),
            }
          : undefined,
        expertProfile: user?.role === 'expert'
          ? {
              currentProfessionalProfile: form.expertCurrentProfile.trim(),
              industry: form.expertIndustry.trim(),
              specialty: form.expertSpecialty.trim(),
              experience: form.expertExperience.trim(),
              skills: splitList(form.expertSkills),
              biography: form.expertBiography.trim(),
              companies: form.expertCompanies.trim(),
              education: form.expertEducation.trim(),
              achievements: form.expertAchievements.trim(),
              photo: form.expertPhoto.trim(),
              service: form.expertService.trim(),
              availabilityDays: splitList(form.expertAvailabilityDays),
            }
          : undefined,
      });
      await refreshMe();
      setIsEditing(false);
      setFeedback('Perfil actualizado correctamente.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenProfile = () => {
    setOpen(false);
    setProfileOpen(true);
    setIsEditing(false);
    setFeedback('');
    setError('');
    loadUserForm();
  };

  const renderField = (key: keyof typeof emptyForm, label: string, multiline = false) => (
    <div className={multiline ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {isEditing ? (
        multiline ? (
          <Textarea
            value={form[key]}
            rows={3}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
          />
        ) : (
          <Input
            value={form[key]}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
          />
        )
      ) : (
        <p className="min-h-10 rounded-md border border-primary/10 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {form[key] || 'No registrado'}
        </p>
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary/15 bg-white px-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/5 sm:h-10 sm:rounded-md sm:px-3"
        aria-label="Abrir menu de usuario"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {getInitials(user?.fullName)}
        </span>
        <span className="hidden max-w-[140px] truncate lg:inline">{user?.fullName || 'Usuario'}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-lg">
          <div className="border-b border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary">
            {user?.fullName || 'Usuario'}
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left text-sm text-primary transition-colors hover:bg-primary/5"
            onClick={handleOpenProfile}
          >
            <UserRound className="h-4 w-4" />
            Ver perfil
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left text-sm text-primary transition-colors hover:bg-primary/5"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </button>
        </div>
      ) : null}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Perfil de usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-semibold text-primary">{user?.fullName || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              {!isEditing ? (
                <Button type="button" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              ) : null}
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Datos generales</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {renderField('fullName', 'Nombre completo')}
                {renderField('position', 'Cargo')}
                {renderField('company', 'Razon social / empresa')}
                {renderField('commercialName', 'Nombre comercial')}
                {renderField('ruc', 'RUC')}
                {renderField('sector', 'Sector')}
                {renderField('location', 'Ubicacion')}
                {renderField('phone', 'Telefono')}
                {renderField('employeeCount', 'Numero de empleados')}
                {renderField('description', 'Descripcion', true)}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Presencia digital</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {renderField('linkedin', 'LinkedIn')}
                {renderField('website', 'Pagina web')}
                {renderField('whatsapp', 'WhatsApp')}
                {renderField('instagram', 'Instagram')}
              </div>
            </section>

            {user?.role === 'buyer' ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Informacion de comprador</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderField('buyerInterestCategories', 'Categorias de interes')}
                  {renderField('buyerPurchaseVolume', 'Volumen de compra')}
                  {renderField('buyerDigitalized', 'Empresa digitalizada')}
                  {renderField('buyerUsesAI', 'Uso de IA generativa')}
                </div>
              </section>
            ) : null}

            {user?.role === 'supplier' ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Informacion de proveedor</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderField('supplierType', 'Tipo de proveedor')}
                  {renderField('supplierProductsOrServices', 'Productos o servicios')}
                  {renderField('supplierHasCatalog', 'Catalogo digital')}
                  {renderField('supplierDigitalized', 'Empresa digitalizada')}
                  {renderField('supplierUsesAI', 'Uso de IA generativa')}
                  {renderField('supplierCoverage', 'Cobertura')}
                  {renderField('supplierProvince', 'Provincia')}
                  {renderField('supplierDistrict', 'Distrito')}
                  {renderField('supplierYearsInMarket', 'Anios en el mercado')}
                </div>
              </section>
            ) : null}

            {user?.role === 'expert' ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Informacion de experto</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderField('expertCurrentProfile', 'Perfil profesional')}
                  {renderField('expertIndustry', 'Industria')}
                  {renderField('expertSpecialty', 'Especialidad')}
                  {renderField('expertExperience', 'Experiencia')}
                  {renderField('expertSkills', 'Habilidades')}
                  {renderField('expertCompanies', 'Empresas')}
                  {renderField('expertEducation', 'Educacion')}
                  {renderField('expertAchievements', 'Logros')}
                  {renderField('expertPhoto', 'Foto')}
                  {renderField('expertService', 'Servicio')}
                  {renderField('expertAvailabilityDays', 'Dias disponibles')}
                  {renderField('expertBiography', 'Biografia', true)}
                </div>
              </section>
            ) : null}

            {feedback ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success-foreground">{feedback}</p> : null}
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isEditing) {
                    loadUserForm();
                    setIsEditing(false);
                    setError('');
                    setFeedback('');
                    return;
                  }
                  setProfileOpen(false);
                }}
              >
                {isEditing ? 'Cancelar edición' : 'Cerrar'}
              </Button>
              {isEditing ? (
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserMenu;

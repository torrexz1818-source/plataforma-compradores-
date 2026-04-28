import { useMemo, useState } from 'react';
import { Search, MapPin, Star, Award, Briefcase } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import BackButton from '@/components/BackButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createConversation, getConversationByPair, getSuppliersBySector } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useHighlight } from '@/hooks/useHighlight';

const CERTIFICATIONS_BY_SECTOR: Record<string, string[]> = {
  tecnologia: ['ISO 27001', 'ISO 9001', 'ITIL'],
  logistica: ['BASC', 'ISO 9001', 'OEA'],
  manufactura: ['ISO 9001', 'ISO 14001', 'ISO 45001'],
  construccion: ['ISO 45001', 'ISO 14001', 'OSINERGMIN'],
  salud: ['DIGESA', 'ISO 13485', 'HACCP'],
  retail: ['ISO 22000', 'ISO 9001', 'HACCP'],
  general: ['ISO 9001'],
};

function getSupplierCertifications(sector: string): string[] {
  const key = sector.trim().toLowerCase();
  return CERTIFICATIONS_BY_SECTOR[key] ?? CERTIFICATIONS_BY_SECTOR.general;
}

function getExperienceYears(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const years = now.getFullYear() - created.getFullYear();
  return Math.max(1, years + 1);
}

export default function SectorSuppliers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sector: sectorParam = '' } = useParams();
  const [searchParams] = useSearchParams();
  const sector = decodeURIComponent(sectorParam);
  const highlightedId = searchParams.get('highlight');
  useHighlight(highlightedId);

  const [busqueda, setBusqueda] = useState('');
  const [ubicacionFiltro, setUbicacionFiltro] = useState('');
  const [ratingFiltro, setRatingFiltro] = useState('');
  const [experienciaFiltro, setExperienciaFiltro] = useState('');
  const [certFiltro, setCertFiltro] = useState('');
  const [feedback, setFeedback] = useState('');

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-by-sector', sector],
    queryFn: () => getSuppliersBySector(sector),
    enabled: Boolean(sector),
  });

  const contactMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      if (!user?.id) {
        throw new Error('Sesion no disponible');
      }

      const existing = await getConversationByPair(user.id, supplierId);
      return existing ?? createConversation({ toUserId: supplierId, publicationId: null });
    },
    onSuccess: (conversation) => {
      navigate(`/mensajes?conversationId=${conversation.id}`);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const proveedores = useMemo(
    () =>
      (suppliersQuery.data ?? []).map((supplier) => ({
        id: supplier.id,
        nombre: supplier.company,
        servicio: supplier.description || 'Servicios empresariales',
        rating: 4.5,
        experiencia: getExperienceYears(supplier.createdAt),
        certificaciones: getSupplierCertifications(supplier.sector),
        ubicacion: `${supplier.province} - ${supplier.district}`,
      })),
    [suppliersQuery.data],
  );

  const ubicaciones = useMemo(
    () => Array.from(new Set(proveedores.map((p) => p.ubicacion))).sort((a, b) => a.localeCompare(b)),
    [proveedores],
  );

  const certificaciones = useMemo(
    () => Array.from(new Set(proveedores.flatMap((p) => p.certificaciones))).sort((a, b) => a.localeCompare(b)),
    [proveedores],
  );

  const filtrados = proveedores.filter((p) => {
    const matchBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.servicio.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.ubicacion.toLowerCase().includes(busqueda.toLowerCase());

    const matchUbicacion = ubicacionFiltro
      ? p.ubicacion.toLowerCase().includes(ubicacionFiltro.toLowerCase())
      : true;

    const matchRating = ratingFiltro ? p.rating >= Number.parseFloat(ratingFiltro) : true;

    const matchExperiencia = experienciaFiltro
      ? p.experiencia >= Number.parseInt(experienciaFiltro, 10)
      : true;

    const matchCert = certFiltro
      ? p.certificaciones.some((c) => c.toLowerCase().includes(certFiltro.toLowerCase()))
      : true;

    return matchBusqueda && matchUbicacion && matchRating && matchExperiencia && matchCert;
  });

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <BackButton fallback="/buyer/directory" className="mb-4" />

      <section className="mb-8 overflow-hidden rounded-3xl border border-secondary/15 bg-[var(--gradient-soft)] shadow-sm">
        <div className="grid gap-4 px-6 py-8 md:grid-cols-[1.25fr_0.9fr] md:px-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Proveedores del sector {sector}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Busca, filtra y compara proveedores con una experiencia visual alineada al resto del modulo.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <Card className="border-secondary/15 bg-white/85 text-foreground shadow-none">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary">Resultados</p>
                <p className="mt-2 text-3xl font-bold">{filtrados.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Proveedores visibles con los filtros actuales.</p>
              </CardContent>
            </Card>
            <Card className="border-secondary/15 bg-white/85 text-foreground shadow-none">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary">Sector</p>
                <p className="mt-2 text-lg font-bold text-primary">{sector}</p>
                <p className="mt-1 text-sm text-muted-foreground">Navegacion enfocada por categoria.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por servicio (ej: limpieza industrial, catering, seguridad, transporte...)"
          className="pl-12 h-12 text-base bg-card border-border"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Select onValueChange={(val) => setUbicacionFiltro(val)}>
          <SelectTrigger className="w-56 bg-card">
            <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Distrito / Ciudad" />
          </SelectTrigger>
          <SelectContent>
            {ubicaciones.map((ubicacion) => (
              <SelectItem key={ubicacion} value={ubicacion}>
                {ubicacion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setRatingFiltro(val)}>
          <SelectTrigger className="w-36 bg-card">
            <Star className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4.5">4.5+</SelectItem>
            <SelectItem value="4.0">4.0+</SelectItem>
            <SelectItem value="3.5">3.5+</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setExperienciaFiltro(val)}>
          <SelectTrigger className="w-40 bg-card">
            <Briefcase className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Experiencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5+ anos</SelectItem>
            <SelectItem value="10">10+ anos</SelectItem>
            <SelectItem value="15">15+ anos</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => setCertFiltro(val)}>
          <SelectTrigger className="w-52 bg-card">
            <Award className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Certificaciones" />
          </SelectTrigger>
          <SelectContent>
            {certificaciones.map((cert) => (
              <SelectItem key={cert} value={cert}>
                {cert}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {suppliersQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando proveedores...</p>
      )}

      {suppliersQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar proveedores para este sector.</p>
      )}

      {!!feedback && (
        <p className="text-sm text-success-foreground bg-success/15 border border-success/25 rounded-md px-3 py-2 mb-4">
          {feedback}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((p) => (
          <Card id={`item-${p.id}`} key={p.id} className="rounded-3xl border-primary/15 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">{p.nombre}</h3>
                  <p className="text-sm text-muted-foreground">{p.servicio}</p>
                </div>
                <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md">
                  <Star className="h-3.5 w-3.5 fill-destructive text-destructive" />
                  <span className="text-sm font-medium">{p.rating.toFixed(1)}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  {p.experiencia} anos de experiencia
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {p.ubicacion}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {p.certificaciones.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/buyer/supplier/${p.id}`)}
                >
                  Ver perfil
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => contactMutation.mutate(p.id)}
                  disabled={contactMutation.isPending}
                >
                  Contactar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!suppliersQuery.isLoading && filtrados.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-12">
          No se encontraron proveedores con los filtros seleccionados.
        </p>
      )}
    </div>
  );
}

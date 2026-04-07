import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getBuyerById, getBuyersBySector, sendSupplierMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useHighlight } from '@/hooks/useHighlight';

const FAVORITES_KEY = 'supplier_favorite_buyers';

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids))));
}

const SectorBuyers = () => {
  const { sector: sectorParam = '' } = useParams();
  const [searchParams] = useSearchParams();
  const sector = decodeURIComponent(sectorParam);
  const { user } = useAuth();
  const highlightedId = searchParams.get('highlight');
  useHighlight(highlightedId);

  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavorites());

  const buyersQuery = useQuery({
    queryKey: ['buyers-by-sector', sector],
    queryFn: () => getBuyersBySector(sector),
    enabled: Boolean(sector),
  });

  const selectedBuyerQuery = useQuery({
    queryKey: ['buyer-profile', selectedBuyerId],
    queryFn: () => getBuyerById(selectedBuyerId ?? ''),
    enabled: Boolean(selectedBuyerId),
  });

  const selectedBuyer = useMemo(
    () => buyersQuery.data?.find((buyer) => buyer.id === selectedBuyerId) ?? null,
    [buyersQuery.data, selectedBuyerId],
  );

  const toggleFavorite = (buyerId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(buyerId)
        ? current.filter((id) => id !== buyerId)
        : [...current, buyerId];
      writeFavorites(next);
      return next;
    });
  };

  const onSendMessage = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedBuyerId || !message.trim() || !user?.id) {
      return;
    }

    setIsSending(true);
    setFeedback('');

    try {
      await sendSupplierMessage({
        supplierId: user.id,
        buyerId: selectedBuyerId,
        message: message.trim(),
      });
      setFeedback('Mensaje enviado correctamente.');
      setMessage('');
      setContactOpen(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compradores del sector {sector}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona oportunidades, revisa perfiles y contacta compradores activos.
        </p>
      </div>

      {buyersQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando compradores...</p>
      )}

      {buyersQuery.isError && (
        <p className="text-sm text-destructive">
          No se pudo cargar el listado de compradores para este sector.
        </p>
      )}

      {!!feedback && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {feedback}
        </p>
      )}

      <div className="space-y-3">
        {(buyersQuery.data ?? []).map((buyer) => {
          const isFavorite = favoriteIds.includes(buyer.id);
          return (
            <article
              id={`item-${buyer.id}`}
              key={buyer.id}
              className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <p className="text-base font-semibold text-foreground">
                  {buyer.name} · {buyer.company}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{buyer.description}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {buyer.sector}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {buyer.location}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full ${
                      buyer.isActiveBuyer
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {buyer.isActiveBuyer ? 'Comprador activo' : 'Estado pendiente'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBuyerId(buyer.id)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/60"
                >
                  Ver perfil
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(buyer.id)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isFavorite
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'border border-border hover:bg-muted/60'
                  }`}
                >
                  {isFavorite ? 'Guardado' : 'Guardar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selectedBuyerId && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setSelectedBuyerId(null);
              setContactOpen(false);
            }}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Perfil del comprador</h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedBuyerId(null);
                  setContactOpen(false);
                }}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedBuyerQuery.isLoading && (
              <p className="text-sm text-muted-foreground mt-4">Cargando perfil...</p>
            )}

            {selectedBuyerQuery.isError && (
              <p className="text-sm text-destructive mt-4">No se pudo cargar el perfil.</p>
            )}

            {selectedBuyerQuery.data && (
              <div className="mt-4 space-y-3">
                <p className="text-sm"><span className="font-medium">Nombre:</span> {selectedBuyerQuery.data.name}</p>
                <p className="text-sm"><span className="font-medium">Empresa:</span> {selectedBuyerQuery.data.company}</p>
                <p className="text-sm"><span className="font-medium">Sector:</span> {selectedBuyerQuery.data.sector}</p>
                <p className="text-sm"><span className="font-medium">Ubicación:</span> {selectedBuyerQuery.data.location}</p>
                <p className="text-sm text-muted-foreground">{selectedBuyerQuery.data.description}</p>

                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="mt-2 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Contactar
                </button>
              </div>
            )}

            {contactOpen && selectedBuyer && (
              <div className="mt-5 rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm">Enviar mensaje a {selectedBuyer.company}</h3>
                <form onSubmit={onSendMessage} className="mt-3 space-y-3">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Escribe tu mensaje..."
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !message.trim()}
                    className="inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {isSending ? 'Enviando...' : 'Enviar mensaje'}
                  </button>
                </form>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default SectorBuyers;

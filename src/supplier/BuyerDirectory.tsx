import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buyers } from './data';

const BuyerDirectory = () => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return buyers;
    }

    return buyers.filter(
      (buyer) =>
        buyer.company.toLowerCase().includes(query) ||
        buyer.sector.toLowerCase().includes(query) ||
        buyer.city.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Directorio de compradores</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Descubre compradores activos y sus necesidades de abastecimiento.
      </p>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por empresa, sector o ciudad"
          className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((buyer) => (
          <article key={buyer.id} className="bg-card border border-border rounded-xl p-5">
            <p className="text-base font-semibold text-foreground">{buyer.company}</p>
            <p className="text-sm text-muted-foreground mt-1">{buyer.description}</p>
            <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>{buyer.sector}</span>
              <span>{buyer.city}</span>
              <span>Volumen: {buyer.volume}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default BuyerDirectory;

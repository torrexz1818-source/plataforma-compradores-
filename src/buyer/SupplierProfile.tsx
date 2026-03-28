import { MapPin, Star } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { reviews, suppliers } from './data';

const SupplierProfile = () => {
  const { id = '' } = useParams();
  const supplier = suppliers.find((item) => item.id === id);
  const supplierReviews = reviews.filter((review) => review.supplierId === id);

  if (!supplier) {
    return <p className="text-sm text-muted-foreground">Proveedor no encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">{supplier.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {supplier.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {supplier.rating} ({supplier.reviews} reseñas)
          </span>
          <span className="capitalize">{supplier.sector}</span>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Reseñas</h2>
        <div className="space-y-3">
          {supplierReviews.map((review) => (
            <article key={review.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{review.author}</p>
                <span className="text-xs text-muted-foreground">{review.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{review.role}</p>
              <p className="mt-2 text-sm text-foreground/90">{review.comment}</p>
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {review.rating}/5
              </div>
            </article>
          ))}

          {!supplierReviews.length && (
            <p className="text-sm text-muted-foreground">Aun no hay reseñas para este proveedor.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default SupplierProfile;

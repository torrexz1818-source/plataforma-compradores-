import MainLayout from '@/layouts/MainLayout';
import MonetizationPanel from '@/components/MonetizationPanel';

export default function Memberships() {
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Membresías y créditos</h1>
          <p className="mt-2 text-muted-foreground">
            Elige tu plan, compra créditos adicionales para Nodus IA o agrega servicios complementarios.
          </p>
        </div>
        <MonetizationPanel />
      </div>
    </MainLayout>
  );
}

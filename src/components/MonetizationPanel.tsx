import { useState } from 'react';
import { CheckCircle2, CreditCard, Sparkles, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { additionalServices, aiCreditPacks, buyerMembershipPlans, supplierMembershipPlans, type MembershipAudience } from '../../shared/monetization';
import { createCheckout, confirmCheckout, getMyMonetization, updateCompanyLogo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CheckoutItemType } from '@/types';

type MonetizationPanelProps = {
  mode?: 'full' | 'upgrade';
  reason?: string;
  focus?: 'plans' | 'credits';
};

export default function MonetizationPanel({ mode = 'full', reason, focus = 'plans' }: MonetizationPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logoUrl, setLogoUrl] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const overviewQuery = useQuery({ queryKey: ['monetization', 'mine'], queryFn: getMyMonetization });
  const checkoutMutation = useMutation({
    mutationFn: async (payload: { itemType: CheckoutItemType; itemKey: string }) => {
      const created = await createCheckout(payload);
      return confirmCheckout(created.checkout.id);
    },
    onSuccess: (data) => {
      setCheckoutMessage('Compra confirmada. Tu plan o créditos ya fueron actualizados.');
      queryClient.setQueryData(['monetization', 'mine'], data.overview);
      void queryClient.invalidateQueries({ queryKey: ['monetization'] });
    },
  });
  const logoMutation = useMutation({
    mutationFn: (url: string) => updateCompanyLogo(url),
    onSuccess: (overview) => {
      setCheckoutMessage('Logo actualizado para documentos premium.');
      queryClient.setQueryData(['monetization', 'mine'], overview);
    },
  });

  const audience: MembershipAudience = user?.role === 'supplier' ? 'supplier' : 'buyer';
  const plans = audience === 'supplier' ? supplierMembershipPlans : buyerMembershipPlans;
  const currentPlan = overviewQuery.data?.membership.plan ?? user?.membership?.plan ?? 'free';
  const canUploadLogo = overviewQuery.data?.entitlements.agentBranding === 'custom_brand';

  const buy = (itemType: CheckoutItemType, itemKey: string) => {
    setCheckoutMessage('');
    checkoutMutation.mutate({ itemType, itemKey });
  };

  return (
    <div className="space-y-6">
      {reason ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">{reason}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige un plan o compra créditos adicionales para continuar usando Nodus IA.
          </p>
        </div>
      ) : null}

      <section className={focus === 'credits' ? 'opacity-90' : ''}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Planes de membresía {audience === 'supplier' ? 'Proveedor' : 'Comprador'}</h2>
          {overviewQuery.data ? (
            <Badge variant="outline">{overviewQuery.data.entitlements.aiCreditsRemaining} créditos IA disponibles</Badge>
          ) : null}
        </div>
        <div className={`grid gap-4 ${audience === 'supplier' ? 'xl:grid-cols-4 md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            return (
              <Card key={`${plan.audience}-${plan.key}`} className={`rounded-xl shadow-[var(--shadow-card)] ${isCurrent ? 'border-primary' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <p className="mt-2 text-2xl font-bold text-foreground">{plan.priceLabel}</p>
                    </div>
                    {isCurrent ? <Badge>Plan actual</Badge> : plan.badge ? <Badge variant="outline">{plan.badge}</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-auto" variant={isCurrent ? 'outline' : 'default'} disabled={checkoutMutation.isPending || isCurrent} onClick={() => buy('membership', plan.key)}>
                    {isCurrent ? 'Plan actual' : plan.priceAmount === 0 ? 'Elegir plan' : 'Actualizar'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Créditos adicionales para Nodus IA</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {aiCreditPacks.map((pack) => (
            <Card key={pack.key} className="rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <CreditCard className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">{pack.name}</h3>
                <p className="text-2xl font-bold text-foreground">{pack.priceLabel}</p>
                <p className="text-sm text-muted-foreground">{pack.unitPriceLabel}</p>
                <Button className="mt-auto" variant="outline" disabled={checkoutMutation.isPending} onClick={() => buy('credits', pack.key)}>
                  Comprar créditos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Servicios adicionales</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {additionalServices.map((service) => (
            <Card key={service.key} className="rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <Sparkles className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>
                <p className="text-xl font-bold text-foreground">{service.priceLabel}</p>
                <p className="text-sm text-muted-foreground">{service.frequency}</p>
                <p className="text-sm text-muted-foreground">{service.description}</p>
                <Button className="mt-auto" variant="outline" disabled={checkoutMutation.isPending} onClick={() => buy('service', service.key)}>
                  Comprar servicio
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <Upload className="mt-1 h-5 w-5 text-primary" />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Logo de empresa para documentos Premium</h2>
              <p className="text-sm text-muted-foreground">
                Profesional genera plantillas sin logo. Premium permite usar el logo de la empresa.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder={overviewQuery.data?.entitlements.companyLogoUrl || 'https://.../logo.png'}
                disabled={!canUploadLogo}
              />
              <Button disabled={!canUploadLogo || logoMutation.isPending || !logoUrl.trim()} onClick={() => logoMutation.mutate(logoUrl)}>
                Guardar logo
              </Button>
            </div>
            {!canUploadLogo ? <p className="text-xs text-muted-foreground">Disponible al activar el plan Premium.</p> : null}
          </div>
        </div>
      </section>

      {checkoutMessage || checkoutMutation.error || logoMutation.error ? (
        <p className={`text-sm ${checkoutMutation.error || logoMutation.error ? 'text-destructive' : 'text-success-foreground'}`}>
          {checkoutMessage ||
            (checkoutMutation.error instanceof Error
              ? checkoutMutation.error.message
              : logoMutation.error instanceof Error
                ? logoMutation.error.message
                : '')}
        </p>
      ) : null}

      {mode === 'upgrade' ? <p className="text-xs text-muted-foreground">Checkout funcional en modo simulado para lanzamiento; listo para conectar pasarela real.</p> : null}
    </div>
  );
}

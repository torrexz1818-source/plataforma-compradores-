export type MembershipAudience = 'buyer' | 'supplier';
export type MembershipPlanKey = 'free' | 'professional' | 'premium' | 'corporate';
export type CheckoutItemType = 'membership' | 'credits' | 'service';

export type MembershipPlan = {
  key: MembershipPlanKey;
  audience: MembershipAudience;
  name: string;
  priceLabel: string;
  priceAmount: number;
  currency: 'PEN';
  badge?: string;
  aiCreditsMonthly?: number;
  features: string[];
  limits: Record<string, number | string>;
  agentBranding: 'standard' | 'white_label' | 'custom_brand';
};

export type CreditPack = {
  key: string;
  name: string;
  credits: number;
  priceAmount: number;
  priceLabel: string;
  unitPriceLabel: string;
};

export type AdditionalService = {
  key: string;
  name: string;
  priceAmount: number;
  priceLabel: string;
  frequency: string;
  description: string;
};

export const buyerMembershipPlans: MembershipPlan[] = [
  {
    key: 'free',
    audience: 'buyer',
    name: 'Gratuito',
    priceLabel: 'Gratis',
    priceAmount: 0,
    currency: 'PEN',
    aiCreditsMonthly: 1,
    agentBranding: 'standard',
    features: [
      '1 crédito IA mensual + 2 créditos por compartir',
      'Recursos educativos base',
      'Expertos con pago independiente',
    ],
    limits: { aiCredits: 1, shareBonusCredits: 2 },
  },
  {
    key: 'professional',
    audience: 'buyer',
    name: 'Profesional',
    priceLabel: 'S/ 29',
    priceAmount: 29,
    currency: 'PEN',
    badge: 'Más popular',
    aiCreditsMonthly: 8,
    agentBranding: 'white_label',
    features: [
      '8 créditos IA al mes',
      'Rutas y plantillas educativas completas',
      'Acceso a grupales con pago preferencial',
      'Plantillas del agente sin logo',
    ],
    limits: { aiCredits: 8 },
  },
  {
    key: 'premium',
    audience: 'buyer',
    name: 'Premium',
    priceLabel: 'S/ 69',
    priceAmount: 69,
    currency: 'PEN',
    badge: 'Mejor valor',
    aiCreditsMonthly: 20,
    agentBranding: 'custom_brand',
    features: [
      '20 créditos IA al mes',
      'Todo + recursos premium',
      'Descuento en grupales e individuales',
      'Salidas del agente con logo de la empresa',
    ],
    limits: { aiCredits: 20 },
  },
];

export const supplierMembershipPlans: MembershipPlan[] = [
  {
    key: 'free',
    audience: 'supplier',
    name: 'Gratuito',
    priceLabel: 'Gratis',
    priceAmount: 0,
    currency: 'PEN',
    agentBranding: 'standard',
    features: ['Perfil básico y aparecer en directorio', '1 publicación/mes', 'Responder requerimientos limitado'],
    limits: { monthlyPosts: 1, monthlyReplies: 'limitado' },
  },
  {
    key: 'professional',
    audience: 'supplier',
    name: 'Profesional',
    priceLabel: 'S/ 99.00',
    priceAmount: 99,
    currency: 'PEN',
    badge: 'Más popular',
    agentBranding: 'standard',
    features: ['Perfil completo', '3 publicaciones/día', '10 respuestas/mes'],
    limits: { dailyPosts: 3, monthlyReplies: 10 },
  },
  {
    key: 'premium',
    audience: 'supplier',
    name: 'Premium',
    priceLabel: 'S/ 199.00',
    priceAmount: 199,
    currency: 'PEN',
    badge: 'Mejor valor',
    agentBranding: 'standard',
    features: ['Perfil destacado', 'Uso amplio con control', '40 respuestas/mes'],
    limits: { monthlyReplies: 40 },
  },
  {
    key: 'corporate',
    audience: 'supplier',
    name: 'Corporativo',
    priceLabel: 'S/ 399.00',
    priceAmount: 399,
    currency: 'PEN',
    agentBranding: 'standard',
    features: ['Categoría destacada + prioridad', 'Campañas internas', 'Respuesta prioritaria'],
    limits: { priority: 'alta' },
  },
];

export const aiCreditPacks: CreditPack[] = [
  { key: 'credits_10', name: '10 créditos', credits: 10, priceAmount: 30, priceLabel: 'S/ 30.00', unitPriceLabel: 'S/ 3.00 por crédito' },
  { key: 'credits_25', name: '25 créditos', credits: 25, priceAmount: 69, priceLabel: 'S/ 69.00', unitPriceLabel: 'S/ 2.76 por crédito' },
  { key: 'credits_50', name: '50 créditos', credits: 50, priceAmount: 119, priceLabel: 'S/ 119.00', unitPriceLabel: 'S/ 2.38 por crédito' },
];

export const additionalServices: AdditionalService[] = [
  {
    key: 'group_advisory_3',
    name: 'Asesoría grupal de 3',
    priceAmount: 59,
    priceLabel: 'S/ 59 por persona',
    frequency: 'Por sesión de 1 hora',
    description: 'Sesión grupal para revisar dudas y casos de compra con acompañamiento experto.',
  },
  {
    key: 'individual_advisory',
    name: 'Asesoría individual',
    priceAmount: 179,
    priceLabel: 'S/ 179',
    frequency: 'Por sesión de 1 hora',
    description: 'Sesión individual para resolver un caso puntual de compras, proveedores o negociación.',
  },
];

export function getMembershipPlan(audience: MembershipAudience, planKey?: string) {
  const plans = audience === 'supplier' ? supplierMembershipPlans : buyerMembershipPlans;
  return plans.find((plan) => plan.key === planKey) ?? plans[0];
}

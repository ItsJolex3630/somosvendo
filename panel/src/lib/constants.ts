export type Category =
  | "web_sale"
  | "hosting_monthly"
  | "vendo_conecta_monthly"
  | "feature_implementation"
  | "photography"
  | "branding"
  | "subscription"
  | "nfc_reinvestment"
  | "unexpected"
  | "savings"
  | "partner_payout";

export type ServiceType =
  | "web_dev"
  | "hosting"
  | "vendo_conecta"
  | "nfc_cards"
  | "photography"
  | "branding"
  | "feature_implementation";

export type PaymentKind = "one_time" | "recurring";
export type ServiceStatus = "active" | "completed" | "suspended" | "cancelled";
export type MembershipStatus = "al_dia" | "proximo_a_vencer" | "vencido" | "suspendido";

export const INCOME_CATEGORIES: Category[] = [
  "web_sale",
  "hosting_monthly",
  "vendo_conecta_monthly",
  "feature_implementation",
  "photography",
  "branding",
  "subscription",
];

export const EXPENSE_CATEGORIES: Category[] = [
  "nfc_reinvestment",
  "unexpected",
  "savings",
  "partner_payout",
];

/** Categorías que el usuario puede elegir manualmente (partner_payout es automática). */
export const SELECTABLE_EXPENSE_CATEGORIES: Category[] = [
  "nfc_reinvestment",
  "unexpected",
  "savings",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  web_sale: "Venta web",
  hosting_monthly: "Hosting mensual",
  vendo_conecta_monthly: "Vendo Conecta mensual",
  feature_implementation: "Implementación de funcionalidad",
  photography: "Sesión fotográfica",
  branding: "Creación de marca",
  subscription: "Suscripción",
  nfc_reinvestment: "Reinversión NFC",
  unexpected: "Imprevisto",
  savings: "Ahorro",
  partner_payout: "Pago a socio",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  web_dev: "Desarrollo web",
  hosting: "Hosting",
  vendo_conecta: "Vendo Conecta",
  nfc_cards: "Tarjetas NFC",
  photography: "Sesión fotográfica",
  branding: "Creación de marca",
  feature_implementation: "Implementación de funcionalidad",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  one_time: "Pago único",
  recurring: "Mensual recurrente",
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  active: "Activo",
  completed: "Completado",
  suspended: "Suspendido",
  cancelled: "Cancelado",
};

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  al_dia: "Al día",
  proximo_a_vencer: "Próximo a vencer",
  vencido: "Vencido",
  suspendido: "Suspendido",
};

/** Mapeo servicio contratado → categoría de ingreso automática. */
export const SERVICE_TO_CATEGORY: Record<ServiceType, Category> = {
  web_dev: "web_sale",
  hosting: "hosting_monthly",
  vendo_conecta: "vendo_conecta_monthly",
  nfc_cards: "web_sale",
  feature_implementation: "feature_implementation",
  photography: "photography",
  branding: "branding",
};

/** Categorías cuyo ingreso se reparte con el socio. */
export const SHARED_PROFIT_CATEGORIES: Category[] = ["photography", "branding"];

export const isSharedProfitCategory = (category: string): boolean =>
  SHARED_PROFIT_CATEGORIES.includes(category as Category);

export const isIncomeCategory = (category: string): boolean =>
  INCOME_CATEGORIES.includes(category as Category);

export const categoryLabel = (category: string): string =>
  CATEGORY_LABELS[category as Category] ?? category;

export const serviceTypeLabel = (type: string): string =>
  SERVICE_TYPE_LABELS[type as ServiceType] ?? type;

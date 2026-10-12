/**
 * Tipos fieis ao payload real devolvido pelas Netlify Functions do portal de
 * acompanhamento (service-tracking-data.mjs, tracking-service-request.mjs,
 * tracking-requester-save.mjs). Nao reaproveita ServiceEntry/Billing de
 * src/types/global.d.ts porque aqueles descrevem o estado ja normalizado do
 * admin (camelCase); aqui e o retorno bruto do Supabase (snake_case).
 */

export type TrackingTier = "restricted" | "full" | "full-legacy";
export type TrackingLinkMode = "gated" | "legacy";

export interface TrackingServiceItem {
  id: string;
  service_name: string;
  requested_by: string | null;
  reference: string | null;
  service_date: string;
  amount: number;
  status: "A fazer" | "Pronto" | "Entregue" | "Cancelado" | string;
  is_secondary: boolean;
  primary_entry_id: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  service_id: string | null;
  delivered_at: string | null;
}

export interface TrackingBillingServiceItem {
  id: string;
  service_name: string;
  requested_by: string | null;
  reference: string | null;
  service_date: string;
  amount: number;
  status: string;
  is_secondary: boolean;
  primary_entry_id: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  service_id: string | null;
}

export interface TrackingPayment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
  notes: string | null;
  created_at: string;
}

export interface TrackingPaymentMethod {
  id: string;
  type: string;
  name: string;
  details: string | null;
  payment_link: string | null;
}

export interface TrackingBilling {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  status: "Aberta" | "Parcial" | "Paga" | "Cancelada" | "Consolidada" | string;
  previous_balance: number;
  services_total: number;
  total_due: number;
  open_amount: number;
  created_at: string;
  services: TrackingBillingServiceItem[];
  payments: TrackingPayment[];
  paymentMethods: TrackingPaymentMethod[];
  snapshot?: { rolledIntoBillingId?: string } | null;
}

export interface TrackingRequestCatalogItem {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface TrackingServiceRequestHistoryItem {
  id: string;
  service_name: string;
  references: string[];
  requested_date: string;
  amount: number;
  requested_by: string;
  notes: string;
  status: string;
  created_at: string;
}

export interface TrackingClientRequester {
  id: string;
  name: string;
  normalizedName: string;
}

export interface TrackingPeriod {
  startDate: string;
  endDate: string;
}

export interface TrackingApiResponse {
  client: { id: string; name: string; price_table_id: string | null };
  period: TrackingPeriod;
  weekOffset: number;
  canGoBack: boolean;
  canGoForward: boolean;
  expiresAt: string;
  allowRequests: boolean;
  showAmounts: boolean;
  linkMode: TrackingLinkMode;
  tier: TrackingTier;
  updatedAt: string;
  services: TrackingServiceItem[];
  currentServices: TrackingServiceItem[];
  billing: TrackingBilling | null;
  requestServices: TrackingRequestCatalogItem[];
  serviceRequests: TrackingServiceRequestHistoryItem[];
  clientRequesters: TrackingClientRequester[];
}

export interface TrackingCredentials {
  fullAccessCode?: string;
  identifier?: string;
  password?: string;
}

export interface TrackingServiceRequestPayload {
  accessCode: string;
  serviceId: string;
  references: string;
  requestedBy: string;
  notes: string;
}

export interface TrackingServiceRequestResult {
  id: string;
  requestedDate: string;
  references: string[];
  serviceName: string;
  amount: number;
}

export interface TrackingRequesterSaveResult {
  requester: TrackingClientRequester;
}

export type TrackingAccessChoice = "restricted" | "full";

export type TrackingServiceDisplayMode = "simple" | "full";

export type TrackingView = "services" | "financial" | "billing";

export type TrackingServiceSort = "date" | "requester" | "status" | "service";

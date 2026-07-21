import {
  billingOpenAmount as openAmount,
  json,
  supabase,
  verifyPortalToken
} from "./_shared/server.mjs";
import { createPreference, MercadoPagoError } from "./_shared/mercadopago.mjs";

function formatDate(value) {
  return value ? String(value).split("-").reverse().join("/") : "";
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const clientId = encodeURIComponent(payload.clientId);
    const accessBillingId = encodeURIComponent(payload.billingId);

    const { billingId: requestedBillingId } = await request.json();
    const billingId = String(requestedBillingId || payload.billingId || "").trim();
    if (!billingId) return json(400, { error: "Informe a cobrança a pagar." });

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${clientId}&billing_id=eq.${accessBillingId}&active=eq.true&select=id,history_enabled,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) return json(401, { error: "Este acesso não está mais ativo." });
    if (billingId !== payload.billingId && !credential.history_enabled) {
      return json(403, { error: "O histórico ainda não foi liberado para este acesso." });
    }

    const [clients, billings, payments] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&select=id,name`),
      supabase(`/rest/v1/billings?id=eq.${encodeURIComponent(billingId)}&client_id=eq.${clientId}&status=neq.Cancelada&select=*`),
      supabase(`/rest/v1/payments?billing_id=eq.${encodeURIComponent(billingId)}&client_id=eq.${clientId}&select=amount,created_at`)
    ]);
    if (!clients.length || !billings.length) return json(404, { error: "Cobrança não encontrada." });

    const billing = billings[0];
    if (billing.snapshot?.rolledIntoBillingId) {
      return json(409, { error: "Esta cobrança foi consolidada em uma cobrança posterior." });
    }
    const amount = openAmount(billing, payments);
    if (amount <= 0) return json(409, { error: "Esta cobrança já está paga." });

    const origin = new URL(request.url).origin;
    const preference = await createPreference({
      title: `Cobrança de ${clients[0].name} - ${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}`,
      amount,
      externalReference: billing.id,
      backUrls: {
        success: `${origin}/cliente.html?payment=success`,
        pending: `${origin}/cliente.html?payment=pending`,
        failure: `${origin}/cliente.html?payment=failure`
      },
      notificationUrl: `${origin}/.netlify/functions/mercadopago-webhook`
    });

    return json(200, { initPoint: preference.init_point });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error(error);
      return json(502, { error: "Não foi possível iniciar o pagamento por cartão agora." });
    }
    console.error(error);
    return json(401, { error: error.message });
  }
};

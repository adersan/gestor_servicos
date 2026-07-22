import { applyAdvancePayment, applyPaymentToBilling, BillingPaymentError, json, parsePaymentReference } from "./_shared/server.mjs";
import { getPayment, verifyMercadoPagoSignature } from "./_shared/mercadopago.mjs";

function paymentMethodLabel(payment) {
  const type = String(payment?.payment_type_id || "").toLowerCase();
  if (type === "credit_card") return "Cartão de crédito";
  if (type === "debit_card") return "Cartão de débito";
  return payment?.payment_method_id || "Mercado Pago";
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const topic = String(body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "").toLowerCase();
    const dataId = String(body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "").trim();

    if (topic !== "payment" || !dataId) {
      return json(200, { processed: false, reason: "Notificação ignorada." });
    }

    if (!verifyMercadoPagoSignature(request, dataId)) {
      console.error("[mercadopago-webhook] assinatura invalida", { dataId });
      return json(401, { error: "Assinatura inválida." });
    }

    const payment = await getPayment(dataId);
    if (payment.status !== "approved") {
      return json(200, { processed: false, status: payment.status });
    }

    const reference = parsePaymentReference(payment.external_reference);
    if (!reference) return json(200, { processed: false, reason: "Sem referência vinculada." });

    const amount = Number(payment.transaction_amount);
    const date = String(payment.date_approved || new Date().toISOString()).slice(0, 10);
    const method = paymentMethodLabel(payment);
    const externalId = String(payment.id);

    const result = reference.type === "advance"
      ? await applyAdvancePayment({
        clientId: reference.clientId,
        amount,
        date,
        method,
        note: "Pagamento antecipado via Mercado Pago",
        source: "Mercado Pago",
        externalId
      })
      : await applyPaymentToBilling({
        billingId: reference.billingId,
        amount,
        date,
        method,
        note: "Pagamento por cartão via Mercado Pago",
        source: "Mercado Pago",
        externalId,
        capExcessAsFee: true
      });
    console.log("[mercadopago-webhook] pagamento aplicado", result);

    return json(200, result);
  } catch (error) {
    if (error instanceof BillingPaymentError) {
      console.error(error);
      return json(200, { processed: false, error: error.message });
    }
    console.error(error);
    return json(500, { error: error.message });
  }
};

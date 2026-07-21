import { applyPaymentToBilling, BillingPaymentError, json } from "./_shared/server.mjs";
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

    if (topic !== "payment" || !dataId) return json(200, { processed: false, reason: "Notificação ignorada." });

    if (!verifyMercadoPagoSignature(request, dataId)) {
      return json(401, { error: "Assinatura inválida." });
    }

    const payment = await getPayment(dataId);
    if (payment.status !== "approved") {
      return json(200, { processed: false, status: payment.status });
    }

    const billingId = String(payment.external_reference || "").trim();
    if (!billingId) return json(200, { processed: false, reason: "Sem cobrança vinculada." });

    const result = await applyPaymentToBilling({
      billingId,
      amount: Number(payment.transaction_amount),
      date: String(payment.date_approved || new Date().toISOString()).slice(0, 10),
      method: paymentMethodLabel(payment),
      note: "Pagamento por cartão via Mercado Pago",
      source: "Mercado Pago",
      externalId: String(payment.id)
    });

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

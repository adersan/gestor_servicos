import { applyPaymentToBilling, BillingPaymentError, env, json } from "./_shared/server.mjs";

function paymentPayload(body) {
  return {
    externalId: String(body?.externalId || body?.id || body?.transactionId || "").trim(),
    billingId: String(body?.billingId || body?.reference || "").trim(),
    amount: Number(body?.amount),
    date: String(body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    method: String(body?.method || "Pagamento automático").trim(),
    source: String(body?.source || "Webhook").trim()
  };
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    if (authorization !== `Bearer ${env("PAYMENT_WEBHOOK_SECRET")}`) {
      return json(401, { error: "Webhook não autorizado." });
    }

    const payment = paymentPayload(await request.json());
    if (!payment.externalId || !payment.billingId || !Number.isFinite(payment.amount) || payment.amount <= 0) {
      return json(400, { error: "Informe externalId, billingId e amount válido." });
    }

    const result = await applyPaymentToBilling({
      billingId: payment.billingId,
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
      note: `Baixa automática via ${payment.source}`,
      source: payment.source,
      externalId: payment.externalId
    });

    return json(200, result);
  } catch (error) {
    if (error instanceof BillingPaymentError) return json(error.status, { error: error.message, ...error.details });
    console.error(error);
    return json(500, { error: error.message });
  }
};

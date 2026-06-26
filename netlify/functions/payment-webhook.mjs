import { env, json, supabase } from "./_shared/server.mjs";

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

    const duplicate = await supabase(
      `/rest/v1/payments?external_payment_id=eq.${encodeURIComponent(payment.externalId)}&select=id,billing_id,amount&limit=1`
    );
    if (duplicate.length) {
      return json(200, { processed: false, duplicate: true, paymentId: duplicate[0].id });
    }

    const billings = await supabase(
      `/rest/v1/billings?id=eq.${encodeURIComponent(payment.billingId)}&select=id,client_id,total_due,status,created_at,snapshot&limit=1`
    );
    const billing = billings[0];
    if (!billing || billing.status === "Cancelada") return json(404, { error: "Cobrança ativa não encontrada." });
    if (billing.snapshot?.rolledIntoBillingId) {
      return json(409, { error: "Esta cobrança foi consolidada em uma cobrança posterior." });
    }

    const calculationVersion = Number(billing.snapshot?.calculationVersion || 1);
    const createdFilter = calculationVersion >= 2
      ? ""
      : `&created_at=gt.${encodeURIComponent(billing.created_at)}`;
    const existingPayments = await supabase(
      `/rest/v1/payments?billing_id=eq.${encodeURIComponent(billing.id)}${createdFilter}&select=amount,created_at`
    );
    const paid = existingPayments.reduce((sum, item) => sum + Number(item.amount), 0);
    const openAmount = Math.max(0, Number(billing.total_due) - paid);
    if (openAmount <= 0) return json(409, { error: "Cobrança já está paga." });
    if (payment.amount > openAmount + 0.001) {
      return json(409, { error: "Valor recebido maior que o saldo da cobrança.", openAmount });
    }

    const paymentId = crypto.randomUUID();
    await supabase("/rest/v1/payments", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        id: paymentId,
        client_id: billing.client_id,
        billing_id: billing.id,
        payment_date: payment.date,
        amount: payment.amount,
        method: payment.method,
        notes: `Baixa automática via ${payment.source}`,
        external_payment_id: payment.externalId,
        payment_source: payment.source
      })
    });

    const remaining = Math.max(0, openAmount - payment.amount);
    const status = remaining <= 0 ? "Paga" : "Parcial";
    await supabase(`/rest/v1/billings?id=eq.${encodeURIComponent(billing.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ status })
    });

    return json(200, {
      processed: true,
      paymentId,
      billingId: billing.id,
      status,
      remaining
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message });
  }
};

import { json, supabase, verifyPortalToken } from "./_shared/server.mjs";

function openAmount(billing, payments) {
  const createdAt = new Date(billing.created_at).getTime();
  const laterPayments = payments
    .filter((payment) => new Date(payment.created_at).getTime() > createdAt)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  return Math.max(0, Number(billing.total_due) - laterPayments);
}

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const clientId = encodeURIComponent(payload.clientId);
    const accessBillingId = encodeURIComponent(payload.billingId);
    const requestedBillingId = new URL(request.url).searchParams.get("billingId") || payload.billingId;

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${clientId}&billing_id=eq.${accessBillingId}&active=eq.true&select=id,history_enabled,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) return json(401, { error: "Este acesso não está mais ativo." });

    const historyEnabled = Boolean(credential.history_enabled);
    if (requestedBillingId !== payload.billingId && !historyEnabled) {
      return json(403, { error: "O histórico ainda não foi liberado para este acesso." });
    }

    const billingId = encodeURIComponent(requestedBillingId);
    const [clients, billings, services, payments, currentServices, methods, allBillings] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&select=id,name`),
      supabase(`/rest/v1/billings?id=eq.${billingId}&client_id=eq.${clientId}&status=neq.Cancelada&select=*`),
      supabase(`/rest/v1/service_entries?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,service_name,reference,service_date,amount,status,is_secondary&order=service_date.asc`),
      supabase(`/rest/v1/payments?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,payment_date,amount,method,notes,created_at&order=payment_date.asc`),
      supabase(`/rest/v1/service_entries?billing_id=is.null&client_id=eq.${clientId}&status=neq.Cancelado&select=id,service_name,reference,service_date,amount,status,is_secondary&order=service_date.desc`),
      supabase("/rest/v1/payment_methods?active=eq.true&select=id,type,name,details,payment_link&order=created_at.asc"),
      historyEnabled
        ? supabase(`/rest/v1/billings?client_id=eq.${clientId}&status=neq.Cancelada&select=id,period_start,period_end,total_due,status,created_at&order=period_end.desc`)
        : Promise.resolve([])
    ]);
    if (!clients.length || !billings.length) return json(404, { error: "Cobrança não encontrada." });

    const billing = billings[0];
    const snapshotMethods = Array.isArray(billing.snapshot?.paymentMethods)
      ? billing.snapshot.paymentMethods.map((method) => ({
        id: method.id,
        type: method.type,
        name: method.name,
        details: method.details || "",
        payment_link: method.link || method.payment_link || ""
      }))
      : [];
    const selectedMethodIds = billing.snapshot?.paymentMethodIds || [];
    const selectedMethods = snapshotMethods.length
      ? snapshotMethods
      : (selectedMethodIds.length
        ? methods.filter((method) => selectedMethodIds.includes(method.id))
        : methods);

    return json(200, {
      client: clients[0],
      billing: {
        ...billing,
        open_amount: openAmount(billing, payments)
      },
      services,
      payments,
      paymentMethods: selectedMethods,
      currentServices,
      historyEnabled,
      accessBillingId: payload.billingId,
      billingHistory: allBillings.filter((item) => item.id !== payload.billingId)
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

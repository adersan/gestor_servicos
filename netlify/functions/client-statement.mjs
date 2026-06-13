import { json, supabase, verifyPortalToken } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const clientId = encodeURIComponent(payload.clientId);
    const billingId = encodeURIComponent(payload.billingId);

    const [clients, billings, services, payments, methods] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&select=id,name`),
      supabase(`/rest/v1/billings?id=eq.${billingId}&client_id=eq.${clientId}&select=*`),
      supabase(`/rest/v1/service_entries?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,service_name,reference,service_date,amount,status&order=service_date.asc`),
      supabase(`/rest/v1/payments?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,payment_date,amount,method,notes&order=payment_date.asc`),
      supabase("/rest/v1/payment_methods?active=eq.true&select=id,type,name,details,payment_link&order=created_at.asc")
    ]);
    if (!clients.length || !billings.length) return json(404, { error: "Cobrança não encontrada." });

    const selectedMethodIds = billings[0].snapshot?.paymentMethodIds || [];
    const selectedMethods = selectedMethodIds.length
      ? methods.filter((method) => selectedMethodIds.includes(method.id))
      : methods;

    return json(200, {
      client: clients[0],
      billing: billings[0],
      services,
      payments,
      paymentMethods: selectedMethods
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

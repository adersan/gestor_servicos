import {
  billingOpenAmount as openAmount,
  json,
  selectBillingPaymentMethods,
  supabase,
  verifyPortalToken
} from "./_shared/server.mjs";

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
      supabase(`/rest/v1/clients?id=eq.${clientId}&select=id,name,price_table_id`),
      supabase(`/rest/v1/billings?id=eq.${billingId}&client_id=eq.${clientId}&status=neq.Cancelada&select=*`),
      supabase(`/rest/v1/service_entries?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,service_name,requested_by,reference,service_date,amount,status,is_secondary,primary_entry_id,notes,cancellation_reason&order=service_date.asc`),
      supabase(`/rest/v1/payments?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,payment_date,amount,method,notes,created_at&order=payment_date.asc`),
      supabase(`/rest/v1/service_entries?billing_id=is.null&client_id=eq.${clientId}&status=neq.Cancelado&select=id,service_name,requested_by,reference,service_date,amount,status,is_secondary,primary_entry_id,notes,cancellation_reason&order=service_date.desc`),
      supabase("/rest/v1/payment_methods?active=eq.true&select=id,type,name,details,payment_link&order=created_at.asc"),
      historyEnabled
        ? supabase(`/rest/v1/billings?client_id=eq.${clientId}&status=neq.Cancelada&select=id,period_start,period_end,total_due,status,created_at,snapshot&order=period_end.desc`)
        : Promise.resolve([])
    ]);
    if (!clients.length || !billings.length) return json(404, { error: "Cobrança não encontrada." });

    const billing = billings[0];
    const client = clients[0];
    const [requestCatalog, clientRequests, clientRequesters] = await Promise.all([
      client.price_table_id
        ? supabase(`/rest/v1/service_prices?price_table_id=eq.${encodeURIComponent(client.price_table_id)}&select=amount,service_catalog(id,name,code)&service_catalog.active=eq.true`)
        : Promise.resolve([]),
      supabase(`/rest/v1/client_service_requests?client_id=eq.${clientId}&select=id,service_name,references_list,requested_date,amount,requested_by,notes,status,created_at&order=created_at.desc`)
        .catch((error) => {
          if (/client_service_requests|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
          throw error;
        }),
      supabase(`/rest/v1/client_requesters?client_id=eq.${clientId}&active=eq.true&select=id,name,normalized_name&order=name.asc`)
        .catch((error) => {
          if (/client_requesters|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
          throw error;
        })
    ]);
    const selectedMethods = selectBillingPaymentMethods(billing, methods);

    return json(200, {
      client,
      billing: {
        ...billing,
        status: billing.snapshot?.rolledIntoBillingId ? "Consolidada" : billing.status,
        open_amount: openAmount(billing, payments)
      },
      services,
      payments,
      paymentMethods: selectedMethods,
      currentServices,
      requestServices: requestCatalog
        .filter((item) => item.service_catalog)
        .map((item) => ({
          id: item.service_catalog.id,
          code: item.service_catalog.code || "",
          name: item.service_catalog.name,
          amount: Number(item.amount || 0)
        }))
        .sort((a, b) => (Number(a.code) || 999999) - (Number(b.code) || 999999) || a.name.localeCompare(b.name, "pt-BR")),
      serviceRequests: clientRequests.map((item) => ({
        id: item.id,
        service_name: item.service_name,
        references: Array.isArray(item.references_list) ? item.references_list : [],
        requested_date: item.requested_date,
        amount: Number(item.amount || 0),
        requested_by: item.requested_by || "",
        notes: item.notes || "",
        status: item.status,
        created_at: item.created_at
      })),
      clientRequesters: clientRequesters.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: item.normalized_name
      })),
      historyEnabled,
      accessBillingId: payload.billingId,
      billingHistory: allBillings
        .filter((item) => item.id !== payload.billingId)
        .map((item) => ({
          ...item,
          status: item.snapshot?.rolledIntoBillingId ? "Consolidada" : item.status
        }))
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

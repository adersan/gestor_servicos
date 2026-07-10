import { accessCodeHash, billingOpenAmount, json, selectBillingPaymentMethods, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const { accessCode } = await request.json();
    if (!accessCode || String(accessCode).length < 32) {
      return json(400, { error: "Link de acompanhamento inválido." });
    }

    let links;
    try {
      links = await supabase(
        `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,period_start,period_end,expires_at,allow_requests,show_amounts&limit=1`
      );
    } catch (error) {
      if (!/allow_requests|show_amounts|schema cache|Could not find/i.test(error.message || "")) throw error;
      links = await supabase(
        `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,period_start,period_end,expires_at&limit=1`
      );
      if (links[0]) links[0].allow_requests = false;
      if (links[0]) links[0].show_amounts = true;
    }
    const link = links[0];
    if (!link || new Date(link.expires_at) <= new Date()) {
      return json(401, { error: "Este link expirou ou foi substituído." });
    }

    const clientId = encodeURIComponent(link.client_id);
    const [clients, services] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&active=eq.true&select=id,name,price_table_id&limit=1`),
      supabase(
        `/rest/v1/service_entries?client_id=eq.${clientId}&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}&status=neq.Cancelado&select=id,service_name,requested_by,reference,service_date,amount,status,is_secondary,primary_entry_id,notes,cancellation_reason,updated_at,billing_id&order=service_date.desc`
      )
    ]);
    if (!clients.length) return json(404, { error: "Cliente não encontrado." });
    const client = clients[0];

    const includeFinancial = link.show_amounts !== false;
    const [currentServices, latestBillings, paymentMethodsList] = includeFinancial
      ? await Promise.all([
        supabase(`/rest/v1/service_entries?billing_id=is.null&client_id=eq.${clientId}&status=neq.Cancelado&select=id,service_name,requested_by,reference,service_date,amount,status,is_secondary,primary_entry_id,notes,cancellation_reason&order=service_date.desc`),
        supabase(`/rest/v1/billings?client_id=eq.${clientId}&status=neq.Cancelada&select=*&order=period_end.desc,created_at.desc&limit=1`),
        supabase("/rest/v1/payment_methods?active=eq.true&select=id,type,name,details,payment_link&order=created_at.asc")
      ])
      : [[], [], []];

    let billing = null;
    if (latestBillings[0]) {
      const latest = latestBillings[0];
      const billingId = encodeURIComponent(latest.id);
      const [billingServices, billingPayments] = await Promise.all([
        supabase(`/rest/v1/service_entries?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,service_name,requested_by,reference,service_date,amount,status,is_secondary,primary_entry_id,notes,cancellation_reason&order=service_date.asc`),
        supabase(`/rest/v1/payments?billing_id=eq.${billingId}&client_id=eq.${clientId}&select=id,payment_date,amount,method,notes,created_at&order=payment_date.asc`)
      ]);
      billing = {
        ...latest,
        status: latest.snapshot?.rolledIntoBillingId ? "Consolidada" : latest.status,
        open_amount: billingOpenAmount(latest, billingPayments),
        services: billingServices,
        payments: billingPayments,
        paymentMethods: selectBillingPaymentMethods(latest, paymentMethodsList)
      };
    }
    const [requestCatalog, clientRequests, clientRequesters] = await Promise.all([
      link.allow_requests && client.price_table_id
        ? supabase(`/rest/v1/service_prices?price_table_id=eq.${encodeURIComponent(client.price_table_id)}&select=amount,service_catalog(id,name,code)&service_catalog.active=eq.true`)
        : Promise.resolve([]),
      link.allow_requests
        ? supabase(`/rest/v1/client_service_requests?client_id=eq.${clientId}&status=eq.Novo&select=id,service_name,references_list,requested_date,amount,requested_by,notes,status,created_at&order=created_at.desc`)
        .catch((error) => {
          if (/client_service_requests|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
          throw error;
        })
        : Promise.resolve([]),
      link.allow_requests
        ? supabase(`/rest/v1/client_requesters?client_id=eq.${clientId}&active=eq.true&select=id,name,normalized_name&order=name.asc`)
        .catch((error) => {
          if (/client_requesters|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
          throw error;
        })
        : Promise.resolve([])
    ]);

    await supabase(`/rest/v1/service_tracking_links?id=eq.${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_access_at: new Date().toISOString() })
    });

    return json(200, {
      client,
      period: { startDate: link.period_start, endDate: link.period_end },
      expiresAt: link.expires_at,
      allowRequests: Boolean(link.allow_requests),
      showAmounts: link.show_amounts !== false,
      updatedAt: new Date().toISOString(),
      services,
      currentServices,
      billing,
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
      }))
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível consultar os serviços agora." });
  }
};

import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

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
        `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,period_start,period_end,expires_at,allow_requests&limit=1`
      );
    } catch (error) {
      if (!/allow_requests|schema cache|Could not find/i.test(error.message || "")) throw error;
      links = await supabase(
        `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,period_start,period_end,expires_at&limit=1`
      );
      if (links[0]) links[0].allow_requests = false;
    }
    const link = links[0];
    if (!link || new Date(link.expires_at) <= new Date()) {
      return json(401, { error: "Este link expirou ou foi substituído." });
    }

    const clientId = encodeURIComponent(link.client_id);
    const [clients, services] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&active=eq.true&select=id,name,price_table_id&limit=1`),
      supabase(
        `/rest/v1/service_entries?client_id=eq.${clientId}&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}&status=neq.Cancelado&select=id,service_name,reference,service_date,amount,status,is_secondary,primary_entry_id,updated_at&order=service_date.desc`
      )
    ]);
    if (!clients.length) return json(404, { error: "Cliente não encontrado." });
    const client = clients[0];
    const [requestCatalog, clientRequests] = await Promise.all([
      link.allow_requests && client.price_table_id
        ? supabase(`/rest/v1/service_prices?price_table_id=eq.${encodeURIComponent(client.price_table_id)}&select=amount,service_catalog(id,name,code)&service_catalog.active=eq.true`)
        : Promise.resolve([]),
      link.allow_requests
        ? supabase(`/rest/v1/client_service_requests?client_id=eq.${clientId}&select=id,service_name,references_list,requested_date,amount,requested_by,notes,status,created_at&order=created_at.desc`)
        .catch((error) => {
          if (/client_service_requests|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
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
      updatedAt: new Date().toISOString(),
      services,
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
      }))
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível consultar os serviços agora." });
  }
};

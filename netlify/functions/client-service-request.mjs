import { json, supabase, verifyPortalToken } from "./_shared/server.mjs";

function normalizeReferences(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Metodo nao permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const body = await request.json();
    const serviceId = String(body.serviceId || "");
    const references = normalizeReferences(body.references);
    const requestedBy = String(body.requestedBy || "").trim();
    const notes = String(body.notes || "").trim();
    if (!serviceId) return json(400, { error: "Escolha um servico." });
    if (!references.length) return json(400, { error: "Informe pelo menos uma placa ou referencia." });

    const clientId = encodeURIComponent(payload.clientId);
    const accessBillingId = encodeURIComponent(payload.billingId);
    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${clientId}&billing_id=eq.${accessBillingId}&active=eq.true&select=id,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) return json(401, { error: "Este acesso nao esta mais ativo." });

    const clients = await supabase(`/rest/v1/clients?id=eq.${clientId}&active=eq.true&select=id,price_table_id&limit=1`);
    const client = clients[0];
    if (!client) return json(404, { error: "Cliente nao encontrado." });

    const serviceRows = await supabase(
      `/rest/v1/service_catalog?id=eq.${encodeURIComponent(serviceId)}&active=eq.true&select=id,name&limit=1`
    );
    const service = serviceRows[0];
    if (!service) return json(404, { error: "Servico nao encontrado." });

    const priceRows = client.price_table_id
      ? await supabase(`/rest/v1/service_prices?service_id=eq.${encodeURIComponent(serviceId)}&price_table_id=eq.${encodeURIComponent(client.price_table_id)}&select=amount&limit=1`)
      : [];
    const amount = Number(priceRows[0]?.amount || 0);
    const requestedDate = new Date().toISOString().slice(0, 10);
    const inserted = await supabase("/rest/v1/client_service_requests?select=id", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        client_id: payload.clientId,
        service_id: service.id,
        service_name: service.name,
        references_list: references,
        requested_date: requestedDate,
        amount,
        requested_by: requestedBy || null,
        notes: notes || null,
        status: "Novo"
      })
    });

    return json(200, {
      id: inserted[0]?.id,
      requestedDate,
      references,
      serviceName: service.name,
      amount
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Nao foi possivel enviar o pedido agora." });
  }
};

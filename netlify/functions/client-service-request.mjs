import { json, supabase, verifyPortalToken } from "./_shared/server.mjs";
import { sendPushToAllAdmins } from "./_shared/push.mjs";

function normalizeReferences(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function normalizeRequesterName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const body = await request.json();
    const serviceId = String(body.serviceId || "");
    const references = normalizeReferences(body.references);
    const requestedBy = String(body.requestedBy || "").trim();
    const notes = String(body.notes || "").trim();
    if (!serviceId) return json(400, { error: "Escolha um serviço." });
    if (!references.length) return json(400, { error: "Informe pelo menos uma placa ou referência." });

    const clientId = encodeURIComponent(payload.clientId);
    const accessBillingId = encodeURIComponent(payload.billingId);
    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${clientId}&billing_id=eq.${accessBillingId}&active=eq.true&select=id,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) return json(401, { error: "Este acesso não está mais ativo." });

    const clients = await supabase(`/rest/v1/clients?id=eq.${clientId}&active=eq.true&select=id,name,price_table_id&limit=1`);
    const client = clients[0];
    if (!client) return json(404, { error: "Cliente não encontrado." });

    const serviceRows = await supabase(
      `/rest/v1/service_catalog?id=eq.${encodeURIComponent(serviceId)}&active=eq.true&select=id,name&limit=1`
    );
    const service = serviceRows[0];
    if (!service) return json(404, { error: "Serviço não encontrado." });

    const priceRows = client.price_table_id
      ? await supabase(`/rest/v1/service_prices?service_id=eq.${encodeURIComponent(serviceId)}&price_table_id=eq.${encodeURIComponent(client.price_table_id)}&select=amount&limit=1`)
      : [];
    const amount = Number(priceRows[0]?.amount || 0);
    const requestedDate = new Date().toISOString().slice(0, 10);
    const normalizedRequester = normalizeRequesterName(requestedBy);
    if (normalizedRequester) {
      await supabase("/rest/v1/client_requesters", {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: JSON.stringify({
          client_id: payload.clientId,
          name: requestedBy,
          normalized_name: normalizedRequester,
          active: true
        })
      }).catch((error) => {
        if (!/client_requesters|schema cache|does not exist|Could not find|duplicate key/i.test(error.message || "")) throw error;
      });
    }
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

    await sendPushToAllAdmins({
      title: "Novo pedido de cliente",
      body: `${client.name}: ${service.name}`,
      tag: `request:${inserted[0]?.id}`,
      url: "/#requests"
    }).catch((error) => console.error("Falha ao enviar push de pedido novo:", error.message));

    return json(200, {
      id: inserted[0]?.id,
      requestedDate,
      references,
      serviceName: service.name,
      amount
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Não foi possível enviar o pedido agora." });
  }
};

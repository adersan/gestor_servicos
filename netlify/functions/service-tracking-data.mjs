import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const { accessCode } = await request.json();
    if (!accessCode || String(accessCode).length < 32) {
      return json(400, { error: "Link de acompanhamento inválido." });
    }

    const links = await supabase(
      `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,period_start,period_end,expires_at&limit=1`
    );
    const link = links[0];
    if (!link || new Date(link.expires_at) <= new Date()) {
      return json(401, { error: "Este link expirou ou foi substituído." });
    }

    const clientId = encodeURIComponent(link.client_id);
    const [clients, services] = await Promise.all([
      supabase(`/rest/v1/clients?id=eq.${clientId}&active=eq.true&select=id,name&limit=1`),
      supabase(
        `/rest/v1/service_entries?client_id=eq.${clientId}&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}&status=neq.Cancelado&select=id,service_name,reference,service_date,amount,status,is_secondary,updated_at&order=service_date.desc`
      )
    ]);
    if (!clients.length) return json(404, { error: "Cliente não encontrado." });

    await supabase(`/rest/v1/service_tracking_links?id=eq.${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_access_at: new Date().toISOString() })
    });

    return json(200, {
      client: clients[0],
      period: { startDate: link.period_start, endDate: link.period_end },
      expiresAt: link.expires_at,
      updatedAt: new Date().toISOString(),
      services
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível consultar os serviços agora." });
  }
};

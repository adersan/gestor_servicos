import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method === "DELETE") {
    try {
      await requireAdmin(request);
      const { id } = await request.json();
      if (!id) return json(400, { error: "Link não informado." });
      await supabase(`/rest/v1/service_tracking_links?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({
          active: false,
          plain_access_code: null,
          plain_full_token: null,
          plain_identifier: null,
          plain_password: null
        })
      });
      return json(200, { ok: true });
    } catch (error) {
      console.error(error);
      return json(401, { error: error.message || "Não foi possível excluir o link." });
    }
  }

  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);

    const links = await supabase(
      "/rest/v1/service_tracking_links?active=eq.true"
      + "&select=id,client_id,period_start,period_end,expires_at,allow_requests,created_at,"
      + "plain_access_code,plain_full_token,plain_identifier,plain_password"
      + "&order=created_at.desc"
    );
    if (!links.length) return json(200, { links: [] });

    const clientIds = [...new Set(links.map((item) => item.client_id))];
    const clients = await supabase(
      `/rest/v1/clients?id=in.(${clientIds.map(encodeURIComponent).join(",")})&select=id,name`
    );
    const clientNameById = new Map(clients.map((item) => [item.id, item.name]));

    return json(200, {
      links: links.map((item) => ({
        id: item.id,
        clientId: item.client_id,
        clientName: clientNameById.get(item.client_id) || "Cliente",
        periodStart: item.period_start,
        periodEnd: item.period_end,
        expiresAt: item.expires_at,
        allowRequests: item.allow_requests,
        createdAt: item.created_at,
        accessCode: item.plain_access_code,
        fullAccessCode: item.plain_full_token,
        identifier: item.plain_identifier,
        password: item.plain_password
      }))
    });
  } catch (error) {
    console.error(error);
    const message = /plain_access_code|plain_full_token|plain_identifier|plain_password/i.test(error.message || "")
      ? "Execute o SQL tracking_links_recoverable_credentials.sql no Supabase antes de listar os links gerados."
      : error.message;
    return json(401, { error: message });
  }
};

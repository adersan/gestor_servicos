import {
  accessCodeHash,
  json,
  randomAccessCode,
  requireAdmin,
  supabase
} from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const { clientId, startDate, endDate, validDays = 30, allowRequests = false } = await request.json();
    const days = Math.min(90, Math.max(1, Number(validDays) || 30));
    if (!clientId || !startDate || !endDate) {
      return json(400, { error: "Cliente e período são obrigatórios." });
    }
    if (endDate < startDate) return json(400, { error: "A data final deve ser igual ou posterior à inicial." });

    const clients = await supabase(`/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&active=eq.true&select=id,name&limit=1`);
    if (!clients.length) return json(404, { error: "Cliente não encontrado." });

    await supabase(
      `/rest/v1/service_tracking_links?client_id=eq.${encodeURIComponent(clientId)}&period_start=eq.${startDate}&period_end=eq.${endDate}&active=eq.true`,
      { method: "PATCH", body: JSON.stringify({ active: false }) }
    );

    const accessCode = randomAccessCode();
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const payload = {
      client_id: clientId,
      token_hash: accessCodeHash(accessCode),
      period_start: startDate,
      period_end: endDate,
      expires_at: expiresAt,
      allow_requests: Boolean(allowRequests),
      active: true
    };
    try {
      await supabase("/rest/v1/service_tracking_links", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (!/allow_requests|schema cache|Could not find/i.test(error.message || "")) throw error;
      if (allowRequests) {
        throw new Error("Execute o SQL service_tracking_links.sql no Supabase antes de liberar pedidos neste link.");
      }
      const { allow_requests, ...compatiblePayload } = payload;
      await supabase("/rest/v1/service_tracking_links", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(compatiblePayload)
      });
    }

    return json(200, {
      accessCode,
      clientName: clients[0].name,
      allowRequests: Boolean(allowRequests),
      expiresAt
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

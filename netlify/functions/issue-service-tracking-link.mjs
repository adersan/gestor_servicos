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
    const { clientId, startDate, endDate, validDays = 30 } = await request.json();
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
    await supabase("/rest/v1/service_tracking_links", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        client_id: clientId,
        token_hash: accessCodeHash(accessCode),
        period_start: startDate,
        period_end: endDate,
        expires_at: expiresAt,
        active: true
      })
    });

    return json(200, {
      accessCode,
      clientName: clients[0].name,
      expiresAt
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

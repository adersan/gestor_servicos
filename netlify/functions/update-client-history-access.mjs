import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const { clientId, billingId, enabled } = await request.json();
    if (!clientId || !billingId || typeof enabled !== "boolean") {
      return json(400, { error: "Cliente, cobrança e permissão são obrigatórios." });
    }

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${encodeURIComponent(clientId)}&billing_id=eq.${encodeURIComponent(billingId)}&active=eq.true&select=id&limit=1`
    );
    if (!credentials.length) {
      return json(404, { error: "Gere um novo acesso para esta cobrança antes de alterar o histórico." });
    }

    await supabase(`/rest/v1/client_access_credentials?id=eq.${credentials[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ history_enabled: enabled })
    });
    return json(200, { success: true, historyEnabled: enabled });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

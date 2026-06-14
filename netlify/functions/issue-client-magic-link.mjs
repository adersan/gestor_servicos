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
    const { clientId, billingId } = await request.json();
    if (!clientId || !billingId) return json(400, { error: "Cliente e cobrança são obrigatórios." });

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${encodeURIComponent(clientId)}&billing_id=eq.${encodeURIComponent(billingId)}&active=eq.true&select=id&limit=1`
    );
    if (!credentials.length) {
      return json(404, { error: "Gere um novo acesso para esta cobrança antes de compartilhar." });
    }

    const accessCode = randomAccessCode();
    await supabase(`/rest/v1/client_access_credentials?id=eq.${credentials[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ magic_link_hash: accessCodeHash(accessCode) })
    });

    return json(200, { accessCode });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

import {
  identifierHash,
  json,
  passwordHash,
  randomIdentifier,
  randomPassword,
  requireAdmin,
  supabase
} from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const { clientId, billingId } = await request.json();
    if (!clientId || !billingId) return json(400, { error: "Cliente e cobrança são obrigatórios." });

    const billings = await supabase(
      `/rest/v1/billings?id=eq.${encodeURIComponent(billingId)}&client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id`
    );
    if (!billings.length) return json(404, { error: "Cobrança não encontrada." });

    const identifier = randomIdentifier();
    const password = randomPassword();
    await supabase(`/rest/v1/client_access_credentials?client_id=eq.${encodeURIComponent(clientId)}&active=eq.true`, {
      method: "PATCH",
      body: JSON.stringify({ active: false })
    });
    await supabase("/rest/v1/client_access_credentials", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        client_id: clientId,
        billing_id: billingId,
        identifier_hash: identifierHash(identifier),
        password_hash: passwordHash(password),
        active: true,
        expires_at: null
      })
    });

    return json(200, { identifier, password });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

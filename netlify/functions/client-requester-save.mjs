import { json, supabase, verifyPortalToken } from "./_shared/server.mjs";

function normalizeRequesterName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Metodo nao permitido." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const payload = verifyPortalToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    const body = await request.json();
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeRequesterName(name);
    if (!normalizedName) return json(400, { error: "Informe o solicitante." });

    const clientId = encodeURIComponent(payload.clientId);
    const accessBillingId = encodeURIComponent(payload.billingId);
    const credentials = await supabase(
      `/rest/v1/client_access_credentials?client_id=eq.${clientId}&billing_id=eq.${accessBillingId}&active=eq.true&select=id,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) return json(401, { error: "Este acesso nao esta mais ativo." });

    const existing = await supabase(
      `/rest/v1/client_requesters?client_id=eq.${clientId}&normalized_name=eq.${encodeURIComponent(normalizedName)}&select=id,name&limit=1`
    ).catch((error) => {
      if (/client_requesters|schema cache|does not exist|Could not find/i.test(error.message || "")) return [];
      throw error;
    });
    if (existing.length) return json(409, { error: "Este solicitante ja esta cadastrado.", requester: existing[0] });

    const inserted = await supabase("/rest/v1/client_requesters?select=id,name,normalized_name", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        client_id: payload.clientId,
        name,
        normalized_name: normalizedName,
        active: true
      })
    });

    return json(200, {
      requester: {
        id: inserted[0]?.id,
        name,
        normalizedName
      }
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Nao foi possivel cadastrar o solicitante." });
  }
};

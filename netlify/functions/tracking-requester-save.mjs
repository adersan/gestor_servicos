import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

function normalizeRequesterName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Metodo nao permitido." });

  try {
    const body = await request.json();
    const accessCode = String(body.accessCode || "");
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeRequesterName(name);
    if (!accessCode || accessCode.length < 32) return json(400, { error: "Link de acompanhamento invalido." });
    if (!normalizedName) return json(400, { error: "Informe o solicitante." });

    const links = await supabase(
      `/rest/v1/service_tracking_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,expires_at,allow_requests&limit=1`
    );
    const link = links[0];
    if (!link || new Date(link.expires_at) <= new Date()) return json(401, { error: "Este link expirou ou foi substituido." });
    if (!link.allow_requests) return json(403, { error: "Este link nao permite novos pedidos." });

    const clientId = encodeURIComponent(link.client_id);
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
        client_id: link.client_id,
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

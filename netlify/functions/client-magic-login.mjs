import {
  accessCodeHash,
  json,
  signPortalToken,
  supabase
} from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const { accessCode } = await request.json();
    if (!accessCode || String(accessCode).length < 32) {
      return json(400, { error: "Link de acesso inválido." });
    }

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?magic_link_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=id,client_id,billing_id,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired) {
      return json(401, { error: "Este link expirou ou foi substituído por um acesso mais recente." });
    }

    await supabase(`/rest/v1/client_access_credentials?id=eq.${credential.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_access_at: new Date().toISOString() })
    });

    const token = signPortalToken({
      clientId: credential.client_id,
      billingId: credential.billing_id,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
    });
    return json(200, { token });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível abrir este acesso agora." });
  }
};

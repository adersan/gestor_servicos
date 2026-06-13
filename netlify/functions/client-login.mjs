import {
  identifierHash,
  json,
  signPortalToken,
  supabase,
  verifyPassword
} from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) return json(400, { error: "Informe o identificador e a senha." });

    const credentials = await supabase(
      `/rest/v1/client_access_credentials?identifier_hash=eq.${identifierHash(identifier)}&active=eq.true&select=id,client_id,billing_id,password_hash,expires_at&limit=1`
    );
    const credential = credentials[0];
    const expired = credential?.expires_at && new Date(credential.expires_at) <= new Date();
    if (!credential || expired || !verifyPassword(password, credential.password_hash)) {
      return json(401, { error: "Identificador ou senha inválidos." });
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
    return json(500, { error: "Não foi possível entrar agora." });
  }
};

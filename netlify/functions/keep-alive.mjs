import { json, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Método não permitido." });
  try {
    const rows = await supabase("/rest/v1/clients?select=id&limit=1");
    return json(200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      database: Array.isArray(rows) ? "online" : "sem resposta"
    });
  } catch (error) {
    console.error(error);
    return json(503, {
      ok: false,
      checkedAt: new Date().toISOString(),
      error: error.message || "Falha no manter vivo."
    });
  }
};

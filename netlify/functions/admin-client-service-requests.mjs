import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Metodo nao permitido." });

  try {
    await requireAdmin(request);
    const rows = await supabase(
      "/rest/v1/client_service_requests?select=*&order=created_at.desc"
    );
    return json(200, { requests: rows });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Nao foi possivel consultar os pedidos." });
  }
};

import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const body = await request.json();
    const endpoint = String(body.endpoint || "");
    if (!endpoint) return json(400, { error: "Informe o endpoint da inscrição." });

    await supabase(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });

    return json(200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

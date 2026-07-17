import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const endpoint = String(body.endpoint || "");
    const p256dh = String(body.keys?.p256dh || "");
    const authKey = String(body.keys?.auth || "");
    const deviceLabel = String(body.deviceLabel || "").trim();
    if (!endpoint || !p256dh || !authKey) return json(400, { error: "Inscrição de notificação inválida." });

    await supabase("/rest/v1/push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        admin_user_id: user.id,
        endpoint,
        p256dh,
        auth_key: authKey,
        device_label: deviceLabel || null,
        last_used_at: new Date().toISOString()
      })
    });

    return json(200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

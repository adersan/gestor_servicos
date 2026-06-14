import { json, requireAdmin, supabase } from "./_shared/server.mjs";

function sessionName() {
  return globalThis.Netlify?.env?.get("APIBRASIL_WHATSAPP_SESSION")
    || process.env.APIBRASIL_WHATSAPP_SESSION
    || "gestor_servicos";
}

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const session = encodeURIComponent(sessionName());
    const rows = await supabase(
      `/rest/v1/whatsapp_sessions?session=eq.${session}&select=session,status,message,qr_code,updated_at&limit=1`
    );
    return json(200, rows[0] || {
      session: sessionName(),
      status: "not_started",
      message: "A sessão ainda não foi iniciada.",
      qr_code: null
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

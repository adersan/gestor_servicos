import {
  ApiBrasilError,
  ApiBrasilWhatsAppClient
} from "./_shared/apibrasil-whatsapp.mjs";
import { env, json, requireAdmin, supabase } from "./_shared/server.mjs";

function optionalEnv(name, fallback = "") {
  return globalThis.Netlify?.env?.get(name) || process.env[name] || fallback;
}

function qrCodeFrom(result) {
  return result?.qrcode
    || result?.qrCode
    || result?.data?.qrcode
    || result?.data?.qrCode
    || null;
}

async function saveSession(session, status, message, qrCode = null) {
  await supabase("/rest/v1/whatsapp_sessions?on_conflict=session", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      session,
      status,
      message,
      qr_code: qrCode,
      updated_at: new Date().toISOString()
    })
  });
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  const session = optionalEnv("APIBRASIL_WHATSAPP_SESSION", "gestor_servicos");
  try {
    await requireAdmin(request);
    const input = await request.json().catch(() => ({}));
    const siteUrl = optionalEnv("URL", new URL(request.url).origin).replace(/\/+$/, "");
    const webhookSecret = env("WHATSAPP_WEBHOOK_SECRET");
    const webhookUrl = `${siteUrl}/.netlify/functions/whatsapp-status-webhook?token=${encodeURIComponent(webhookSecret)}`;

    await saveSession(session, "starting", "Aguardando resposta da APIBrasil.");
    const client = new ApiBrasilWhatsAppClient({
      deviceToken: env("APIBRASIL_DEVICE_TOKEN"),
      bearerToken: env("APIBRASIL_BEARER_TOKEN"),
      baseUrl: optionalEnv("APIBRASIL_BASE_URL", "https://gateway.apibrasil.io/api/v2"),
      timeoutMs: 110000
    });

    const result = await client.startSession({
      session,
      qrcode: input.qrcode !== false,
      number: typeof input.number === "string" ? input.number : undefined,
      device_name: "Gestor de Serviços",
      wh_status: webhookUrl,
      wh_message: webhookUrl,
      wh_connect: webhookUrl,
      wh_qrcode: webhookUrl,
      auto_close: 120000,
      force_clear_cache: Boolean(input.forceClearCache),
      headless: "new",
      use_chrome: true,
      powered_by: "Gestor de Serviços",
      homolog: false
    });

    await saveSession(
      session,
      result.status || (qrCodeFrom(result) ? "notLogged" : "started"),
      result.message || "Sessão iniciada.",
      qrCodeFrom(result)
    );
    return json(200, { accepted: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp.";
    const status = error instanceof ApiBrasilError ? error.code : "error";
    try {
      await saveSession(session, status, message);
    } catch (saveError) {
      console.error("Falha ao salvar o erro da sessão:", saveError);
    }
    return json(500, { error: message });
  }
};

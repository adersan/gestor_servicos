import {
  ApiBrasilError,
  ApiBrasilWhatsAppClient
} from "./_shared/apibrasil-whatsapp.mjs";
import { env, json, requireAdmin } from "./_shared/server.mjs";

function optionalEnv(name, fallback = "") {
  return globalThis.Netlify?.env?.get(name) || process.env[name] || fallback;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const input = await request.json().catch(() => ({}));
    const siteUrl = optionalEnv("URL", new URL(request.url).origin).replace(/\/+$/, "");
    const webhookSecret = env("WHATSAPP_WEBHOOK_SECRET");
    const webhookUrl = `${siteUrl}/.netlify/functions/whatsapp-status-webhook?token=${encodeURIComponent(webhookSecret)}`;
    const session = optionalEnv("APIBRASIL_WHATSAPP_SESSION", "gestor_servicos");

    const client = new ApiBrasilWhatsAppClient({
      deviceToken: env("APIBRASIL_DEVICE_TOKEN"),
      bearerToken: env("APIBRASIL_BEARER_TOKEN"),
      baseUrl: optionalEnv("APIBRASIL_BASE_URL", "https://gateway.apibrasil.io/api/v2"),
      timeoutMs: 30000
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

    return json(200, result);
  } catch (error) {
    console.error(error);
    if (error instanceof ApiBrasilError) {
      return json(error.status, {
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
    return json(500, {
      error: error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp."
    });
  }
};

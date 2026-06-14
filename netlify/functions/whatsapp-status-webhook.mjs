import { env, json, supabase } from "./_shared/server.mjs";

function messageText(body) {
  return [
    body?.text,
    body?.body,
    body?.content,
    body?.message?.text,
    body?.message?.body,
    body?.message?.content,
    body?.data?.text,
    body?.data?.body,
    body?.data?.message?.text,
    body?.data?.message?.body,
    body?.data?.message?.content,
    body?.data?.message?._data?.body,
    body?.event?.message?.body
  ].find((value) => typeof value === "string") || "";
}

function webhookAuthorized(request) {
  const authorization = request.headers.get("authorization") || "";
  const queryToken = new URL(request.url).searchParams.get("token") || "";
  const expected = env("WHATSAPP_WEBHOOK_SECRET");
  return authorization === `Bearer ${expected}` || queryToken === expected;
}

function isOutgoingMessage(body) {
  return [
    body?.fromMe,
    body?.message?.fromMe,
    body?.message?._data?.id?.fromMe,
    body?.data?.fromMe,
    body?.data?.message?.fromMe,
    body?.data?.message?._data?.id?.fromMe
  ].some((value) => value === true);
}

function sessionUpdate(body) {
  const session = [
    body?.session,
    body?.data?.session,
    body?.instance,
    body?.data?.instance
  ].find((value) => typeof value === "string" && value.trim());
  const status = [
    body?.status,
    body?.event,
    body?.type,
    body?.data?.status,
    body?.data?.event,
    body?.data?.type
  ].find((value) => typeof value === "string" && value.trim());
  const qrCode = [
    body?.qrcode,
    body?.qrCode,
    body?.data?.qrcode,
    body?.data?.qrCode,
    body?.data?.base64
  ].find((value) => typeof value === "string" && value.trim());
  const message = [
    body?.message,
    body?.data?.message,
    body?.description,
    body?.data?.description
  ].find((value) => typeof value === "string" && value.trim());
  return { session, status, qrCode, message };
}

async function saveSessionUpdate(body) {
  const update = sessionUpdate(body);
  if (!update.session || (!update.status && !update.qrCode)) return false;
  await supabase("/rest/v1/whatsapp_sessions?on_conflict=session", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      session: update.session,
      status: update.status || "notLogged",
      message: update.message || (update.qrCode ? "QR Code disponível." : "Status atualizado."),
      qr_code: update.qrCode || null,
      updated_at: new Date().toISOString()
    })
  });
  return true;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    if (!webhookAuthorized(request)) {
      return json(401, { error: "Webhook não autorizado." });
    }

    const body = await request.json();
    const sessionUpdated = await saveSessionUpdate(body);
    if (isOutgoingMessage(body)) {
      return json(202, { processed: false, reason: "Mensagem de saída ignorada." });
    }
    const match = messageText(body).trim().toUpperCase().match(/\bRECEBIDO\s+([A-Z0-9]{6})\b/);
    if (!match) {
      return json(202, {
        processed: sessionUpdated,
        reason: sessionUpdated
          ? "Status da sessão atualizado."
          : "Evento recebido sem confirmação de entrega."
      });
    }

    const code = encodeURIComponent(match[1]);
    const services = await supabase(
      `/rest/v1/service_entries?delivery_code=eq.${code}&status=eq.Pronto&select=id&limit=1`
    );
    if (!services.length) return json(404, { error: "Serviço pendente não encontrado." });

    await supabase(`/rest/v1/service_entries?id=eq.${encodeURIComponent(services[0].id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({
        status: "Entregue",
        delivered_at: new Date().toISOString(),
        delivery_source: "WhatsApp"
      })
    });
    return json(200, { processed: true, serviceId: services[0].id });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message });
  }
};

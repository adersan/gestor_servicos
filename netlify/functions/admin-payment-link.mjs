import { json, requireAdmin, supabase } from "./_shared/server.mjs";
import { createPreference, MercadoPagoError } from "./_shared/mercadopago.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);

    const { clientId, amount } = await request.json();
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    if (!clientId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return json(400, { error: "Informe cliente e valor válidos." });
    }

    const clients = await supabase(`/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=id,name&limit=1`);
    const client = clients[0];
    if (!client) return json(404, { error: "Cliente não encontrado." });

    const linkId = crypto.randomUUID();
    await supabase("/rest/v1/payment_links", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({ id: linkId, client_id: client.id, amount: parsedAmount, status: "pending" })
    });

    const origin = new URL(request.url).origin;
    let preference;
    try {
      preference = await createPreference({
        title: `Pagamento antecipado - ${client.name}`,
        amount: parsedAmount,
        externalReference: `advance:${linkId}`,
        backUrls: {
          success: `${origin}/cliente.html?payment=success`,
          pending: `${origin}/cliente.html?payment=pending`,
          failure: `${origin}/cliente.html?payment=failure`
        },
        notificationUrl: `${origin}/.netlify/functions/mercadopago-webhook`
      });
    } catch (error) {
      await supabase(`/rest/v1/payment_links?id=eq.${encodeURIComponent(linkId)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      }).catch(() => {});
      throw error;
    }

    return json(200, { initPoint: preference.init_point });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error(error);
      return json(502, { error: "Não foi possível gerar o link de pagamento agora." });
    }
    console.error(error);
    return json(401, { error: error.message });
  }
};

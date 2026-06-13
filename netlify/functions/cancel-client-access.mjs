import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
    const { billingId } = await request.json();
    if (!billingId) return json(400, { error: "Cobrança não informada." });

    await supabase(`/rest/v1/client_access_credentials?billing_id=eq.${encodeURIComponent(billingId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ active: false })
    });
    return json(200, { success: true });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

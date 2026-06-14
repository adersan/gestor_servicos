import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const body = await request.json();
    const links = await supabase(`/rest/v1/supplier_portal_links?token_hash=eq.${accessCodeHash(body.accessCode)}&active=eq.true&can_edit=eq.true&select=*&limit=1`);
    const link = links[0];
    if (!link || new Date(link.expires_at) <= new Date()) return json(403, { error: "Este acesso não permite alterações." });
    if (!body.date || body.date < link.period_start || body.date > link.period_end) return json(400, { error: "A data está fora do período autorizado." });
    const services = await supabase(`/rest/v1/supplier_services?id=eq.${encodeURIComponent(body.serviceId)}&supplier_id=eq.${encodeURIComponent(link.supplier_id)}&active=eq.true&select=id,name,default_cost&limit=1`);
    if (!services.length) return json(400, { error: "Serviço inválido." });
    const payload = {
      supplier_id: link.supplier_id, supplier_service_id: services[0].id,
      service_date: body.date, service_name: services[0].name,
      reference: String(body.reference || "").trim() || null,
      amount: Number(body.amount), status: ["A fazer", "Feito"].includes(body.status) ? body.status : "A fazer",
      source: "Fornecedor", notes: String(body.notes || "").trim() || null
    };
    if (!Number.isFinite(payload.amount) || payload.amount < 0) return json(400, { error: "Valor inválido." });
    if (body.entryId) {
      const existing = await supabase(`/rest/v1/supplier_entries?id=eq.${encodeURIComponent(body.entryId)}&supplier_id=eq.${encodeURIComponent(link.supplier_id)}&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}&payable_id=is.null&select=id&limit=1`);
      if (!existing.length) return json(403, { error: "Este lançamento não pode ser alterado." });
      await supabase(`/rest/v1/supplier_entries?id=eq.${encodeURIComponent(body.entryId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await supabase("/rest/v1/supplier_entries", { method: "POST", prefer: "return=minimal", body: JSON.stringify(payload) });
    }
    return json(200, { success: true });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível salvar o lançamento." });
  }
};

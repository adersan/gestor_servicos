import { accessCodeHash, json, randomAccessCode, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    await requireAdmin(request);
    const {
      supplierId,
      startDate,
      endDate,
      validDays = 30,
      canEdit = false,
      canMarkDone = false,
      canCancel = false,
      showLinkedNotes = false
    } = await request.json();
    if (!supplierId || !startDate || !endDate || endDate < startDate) {
      return json(400, { error: "Fornecedor e período válidos são obrigatórios." });
    }
    const suppliers = await supabase(`/rest/v1/suppliers?id=eq.${encodeURIComponent(supplierId)}&active=eq.true&select=id,name&limit=1`);
    if (!suppliers.length) return json(404, { error: "Fornecedor não encontrado." });
    await supabase(`/rest/v1/supplier_portal_links?supplier_id=eq.${encodeURIComponent(supplierId)}&active=eq.true`, {
      method: "PATCH", body: JSON.stringify({ active: false })
    });
    const accessCode = randomAccessCode();
    const days = Math.min(90, Math.max(1, Number(validDays) || 30));
    await supabase("/rest/v1/supplier_portal_links", {
      method: "POST", prefer: "return=minimal",
      body: JSON.stringify({
        supplier_id: supplierId, token_hash: accessCodeHash(accessCode),
        period_start: startDate, period_end: endDate,
        can_edit: Boolean(canEdit),
        can_mark_done: Boolean(canMarkDone),
        can_cancel: Boolean(canCancel),
        show_linked_notes: Boolean(showLinkedNotes),
        expires_at: new Date(Date.now() + days * 86400000).toISOString(), active: true
      })
    });
    return json(200, { accessCode, supplierName: suppliers[0].name });
  } catch (error) {
    console.error(error);
    const unauthorized = /administrativo não autorizado/i.test(error.message || "");
    return json(unauthorized ? 401 : 500, {
      error: error.message || "Não foi possível gerar o link do fornecedor."
    });
  }
};

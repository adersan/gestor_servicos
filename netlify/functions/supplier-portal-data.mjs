import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

async function validLink(accessCode) {
  const links = await supabase(`/rest/v1/supplier_portal_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=*&limit=1`);
  const link = links[0];
  if (!link || new Date(link.expires_at) <= new Date()) throw new Error("Este link expirou ou foi substituído.");
  return link;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const { accessCode } = await request.json();
    if (!accessCode || String(accessCode).length < 32) return json(400, { error: "Link inválido." });
    const link = await validLink(accessCode);
    const supplierId = encodeURIComponent(link.supplier_id);
    const [suppliers, services, entries, payables, payments] = await Promise.all([
      supabase(`/rest/v1/suppliers?id=eq.${supplierId}&select=id,name&limit=1`),
      supabase(`/rest/v1/supplier_services?supplier_id=eq.${supplierId}&active=eq.true&select=id,code,name,default_cost&order=name`),
      supabase(`/rest/v1/supplier_entries?supplier_id=eq.${supplierId}&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}&select=id,supplier_service_id,service_date,service_name,reference,amount,status,source,notes,cancellation_reason,cancellation_original_amount,last_changed_by,updated_at&order=service_date.desc`),
      supabase(`/rest/v1/supplier_payables?supplier_id=eq.${supplierId}&period_end=gte.${link.period_start}&period_start=lte.${link.period_end}&status=neq.Cancelada&select=id,period_start,period_end,total_due,status,snapshot&order=period_end.desc`),
      supabase(`/rest/v1/supplier_payments?supplier_id=eq.${supplierId}&payment_date=gte.${link.period_start}&payment_date=lte.${link.period_end}&select=id,payable_id,payment_date,amount,method,notes&order=payment_date.desc`)
    ]);
    await supabase(`/rest/v1/supplier_portal_links?id=eq.${link.id}`, { method: "PATCH", body: JSON.stringify({ last_access_at: new Date().toISOString() }) });
    const showEntries = link.show_entries !== false;
    const portalEntries = showEntries
      ? entries
      : entries.map((item) => ({ service_name: item.service_name, amount: item.amount, status: item.status }));
    return json(200, {
      supplier: suppliers[0], services, entries: portalEntries, payables, payments,
      period: { startDate: link.period_start, endDate: link.period_end },
      permissions: {
        canEdit: Boolean(link.can_edit),
        canMarkDone: Boolean(link.can_mark_done),
        canCancel: Boolean(link.can_cancel),
        showLinkedNotes: Boolean(link.show_linked_notes),
        showEntries
      },
      expiresAt: link.expires_at
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

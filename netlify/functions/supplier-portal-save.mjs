import { accessCodeHash, json, supabase } from "./_shared/server.mjs";

async function validLink(accessCode) {
  const links = await supabase(`/rest/v1/supplier_portal_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=*&limit=1`);
  const link = links[0];
  if (!link || new Date(link.expires_at) <= new Date()) {
    throw new Error("Este link expirou ou foi substituído.");
  }
  return link;
}

async function editableEntry(link, entryId) {
  const entries = await supabase(
    `/rest/v1/supplier_entries?id=eq.${encodeURIComponent(entryId)}`
    + `&supplier_id=eq.${encodeURIComponent(link.supplier_id)}`
    + `&service_date=gte.${link.period_start}&service_date=lte.${link.period_end}`
    + "&payable_id=is.null&select=id,amount,status,source&limit=1"
  );
  return entries[0];
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const body = await request.json();
    const link = await validLink(body.accessCode);
    const action = body.action || "save";

    if (action === "mark_done") {
      if (!link.can_mark_done) return json(403, { error: "Este acesso não permite marcar serviços como feitos." });
      const entry = await editableEntry(link, body.entryId);
      if (!entry || entry.status === "Cancelado") return json(403, { error: "Este serviço não pode ter o status alterado." });
      await supabase(`/rest/v1/supplier_entries?id=eq.${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Feito", last_changed_by: "Fornecedor" })
      });
      return json(200, { success: true });
    }

    if (action === "cancel") {
      if (!link.can_cancel) return json(403, { error: "Este acesso não permite cancelar serviços." });
      const reason = String(body.reason || "").trim();
      if (!reason) return json(400, { error: "Informe o motivo do cancelamento." });
      const entry = await editableEntry(link, body.entryId);
      if (!entry) return json(403, { error: "Este serviço não pode ser cancelado." });
      await supabase(`/rest/v1/supplier_entries?id=eq.${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Cancelado",
          cancellation_reason: reason,
          cancellation_original_amount: Number(entry.amount),
          amount: 0,
          last_changed_by: "Fornecedor"
        })
      });
      return json(200, { success: true });
    }

    if (!link.can_edit) return json(403, { error: "Este acesso não permite lançar ou editar serviços." });
    if (!body.date || body.date < link.period_start || body.date > link.period_end) {
      return json(400, { error: "A data está fora do período autorizado." });
    }
    const services = await supabase(
      `/rest/v1/supplier_services?id=eq.${encodeURIComponent(body.serviceId)}`
      + `&supplier_id=eq.${encodeURIComponent(link.supplier_id)}`
      + "&active=eq.true&select=id,name,default_cost&limit=1"
    );
    if (!services.length) return json(400, { error: "Serviço inválido." });

    const existing = body.entryId ? await editableEntry(link, body.entryId) : null;
    if (body.entryId && !existing) return json(403, { error: "Este lançamento não pode ser alterado." });
    const requestedStatus = ["A fazer", "Feito"].includes(body.status) ? body.status : "A fazer";
    const permittedStatus = link.can_mark_done
      ? requestedStatus
      : existing?.status || "A fazer";
    const payload = {
      supplier_id: link.supplier_id,
      supplier_service_id: services[0].id,
      service_date: body.date,
      service_name: services[0].name,
      reference: String(body.reference || "").trim() || null,
      amount: Number(body.amount),
      status: permittedStatus,
      notes: String(body.notes || "").trim() || null,
      last_changed_by: "Fornecedor"
    };
    if (!Number.isFinite(payload.amount) || payload.amount < 0) return json(400, { error: "Valor inválido." });

    if (body.entryId) {
      await supabase(`/rest/v1/supplier_entries?id=eq.${encodeURIComponent(body.entryId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } else {
      await supabase("/rest/v1/supplier_entries", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({ ...payload, source: "Fornecedor" })
      });
    }
    return json(200, { success: true });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Não foi possível salvar o lançamento." });
  }
};

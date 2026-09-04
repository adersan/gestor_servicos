import {
  accessCodeHash,
  currentAppPeriodSettings,
  json,
  operationalWeekFor,
  operationalWeekWithOffset,
  resolveTrackingTier,
  supabase
} from "./_shared/server.mjs";

const WEEK_MS = 7 * 86400000;

function weeksBetween(fromDateKey, toDateKey) {
  return Math.round((new Date(`${fromDateKey}T12:00:00Z`) - new Date(`${toDateKey}T12:00:00Z`)) / WEEK_MS);
}

async function findLink(accessCode) {
  const fullSelect = "id,supplier_id,token_hash,period_start,period_end,expires_at,can_edit,can_mark_done,"
    + "can_cancel,show_linked_notes,show_entries,identifier_hash,password_hash,active";
  const legacySelect = "id,supplier_id,token_hash,period_start,period_end,expires_at,can_edit,can_mark_done,"
    + "can_cancel,show_linked_notes,show_entries,active";
  try {
    const links = await supabase(`/rest/v1/supplier_portal_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=${fullSelect}&limit=1`);
    return links[0];
  } catch (error) {
    if (!/identifier_hash|password_hash|schema cache|Could not find/i.test(error.message || "")) throw error;
    const links = await supabase(`/rest/v1/supplier_portal_links?token_hash=eq.${accessCodeHash(accessCode)}&active=eq.true&select=${legacySelect}&limit=1`);
    if (links[0]) { links[0].identifier_hash = null; links[0].password_hash = null; }
    return links[0];
  }
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const { accessCode, identifier, password, weekOffset: requestedWeekOffset } = await request.json();
    if (!accessCode || String(accessCode).length < 32) return json(400, { error: "Link inválido." });
    const link = await findLink(accessCode);
    if (!link || (link.expires_at && new Date(link.expires_at) <= new Date())) {
      throw new Error("Este link expirou ou foi substituído.");
    }

    const linkMode = link.identifier_hash ? "gated" : "legacy";
    const tier = resolveTrackingTier(link, { identifier, password });
    const includeFinancial = tier !== "restricted";

    // Mesma logica do acompanhamento do cliente (service-tracking-data.mjs): a janela de
    // lancamentos exibida e sempre a semana operacional atual (ou uma anterior navegada pelo
    // fornecedor), nao mais o periodo fixo gravado na criacao do link.
    const { weekStartDay, weekEndDay } = await currentAppPeriodSettings();
    const currentWeek = operationalWeekWithOffset(weekStartDay, weekEndDay, 0);
    const earliestWeek = operationalWeekFor(link.period_start, weekStartDay, weekEndDay);
    const earliestOffset = weeksBetween(earliestWeek.startDate, currentWeek.startDate);
    let weekOffset = Math.trunc(Number(requestedWeekOffset)) || 0;
    weekOffset = Math.min(0, Math.max(weekOffset, earliestOffset));
    const period = operationalWeekWithOffset(weekStartDay, weekEndDay, weekOffset);
    const canGoForward = weekOffset < 0;
    const canGoBack = weekOffset > earliestOffset;

    const supplierId = encodeURIComponent(link.supplier_id);
    const [suppliers, services, entriesRaw] = await Promise.all([
      supabase(`/rest/v1/suppliers?id=eq.${supplierId}&select=id,name&limit=1`),
      supabase(`/rest/v1/supplier_services?supplier_id=eq.${supplierId}&active=eq.true&select=id,code,name,default_cost&order=name`),
      supabase(`/rest/v1/supplier_entries?supplier_id=eq.${supplierId}&service_date=gte.${period.startDate}&service_date=lte.${period.endDate}&select=id,supplier_service_id,service_date,service_name,reference,amount,status,source,notes,cancellation_reason,cancellation_original_amount,last_changed_by,updated_at&order=service_date.desc`)
    ]);
    if (!suppliers.length) return json(404, { error: "Fornecedor não encontrado." });

    const showEntries = link.show_entries !== false;
    let entries = showEntries
      ? entriesRaw
      : entriesRaw.map((item) => ({ service_name: item.service_name, amount: item.amount, status: item.status }));
    if (!includeFinancial) {
      entries = entries.map((item) => ({ ...item, amount: 0, cancellation_original_amount: null }));
    }

    // Conta a pagar mostrada e sempre a mais recente do fornecedor, independente da semana em
    // navegacao - mesmo principio da cobranca mais recente exibida pro cliente, ja que uma conta
    // a pagar normalmente cobre um periodo maior que uma semana e nao teria como "navegar" nela.
    let payables = [];
    let payments = [];
    if (includeFinancial) {
      const latestPayables = await supabase(
        `/rest/v1/supplier_payables?supplier_id=eq.${supplierId}&status=neq.Cancelada&select=id,period_start,period_end,total_due,status,snapshot&order=period_end.desc,created_at.desc&limit=1`
      );
      payables = latestPayables;
      if (latestPayables[0]) {
        payments = await supabase(
          `/rest/v1/supplier_payments?payable_id=eq.${encodeURIComponent(latestPayables[0].id)}&select=id,payable_id,payment_date,amount,method,notes&order=payment_date.desc`
        );
      }
    }

    await supabase(`/rest/v1/supplier_portal_links?id=eq.${link.id}`, { method: "PATCH", body: JSON.stringify({ last_access_at: new Date().toISOString() }) });

    return json(200, {
      supplier: suppliers[0], services, entries, payables, payments,
      period, weekOffset, canGoBack, canGoForward,
      permissions: {
        canEdit: Boolean(link.can_edit),
        canMarkDone: Boolean(link.can_mark_done),
        canCancel: Boolean(link.can_cancel),
        showLinkedNotes: Boolean(link.show_linked_notes),
        showEntries
      },
      linkMode,
      tier,
      includeFinancial,
      expiresAt: link.expires_at
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

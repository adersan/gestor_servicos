import {
  accessCodeHash,
  identifierHash,
  json,
  passwordHash,
  randomAccessCode,
  randomIdentifier,
  randomPassword,
  requireAdmin,
  supabase
} from "./_shared/server.mjs";

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
      showLinkedNotes = false,
      showEntries = true,
      replaceExisting = true
    } = await request.json();
    if (!supplierId || !startDate || !endDate || endDate < startDate) {
      return json(400, { error: "Fornecedor e período válidos são obrigatórios." });
    }
    const suppliers = await supabase(`/rest/v1/suppliers?id=eq.${encodeURIComponent(supplierId)}&active=eq.true&select=id,name&limit=1`);
    if (!suppliers.length) return json(404, { error: "Fornecedor não encontrado." });
    if (replaceExisting) {
      // So pode existir um link ativo por fornecedor: gerar um novo invalida o anterior
      // e apaga as credenciais em texto do anterior (nao ficam recuperaveis).
      await supabase(`/rest/v1/supplier_portal_links?supplier_id=eq.${encodeURIComponent(supplierId)}&active=eq.true`, {
        method: "PATCH",
        body: JSON.stringify({
          active: false,
          plain_access_code: null,
          plain_identifier: null,
          plain_password: null
        })
      });
    }
    const accessCode = randomAccessCode();
    const identifier = randomIdentifier();
    const password = randomPassword();
    const days = Math.min(90, Math.max(1, Number(validDays) || 30));
    const payload = {
      supplier_id: supplierId, token_hash: accessCodeHash(accessCode),
      period_start: startDate, period_end: endDate,
      can_edit: Boolean(canEdit),
      can_mark_done: Boolean(canMarkDone),
      can_cancel: Boolean(canCancel),
      show_linked_notes: Boolean(showLinkedNotes),
      show_entries: Boolean(showEntries),
      identifier_hash: identifierHash(identifier),
      password_hash: passwordHash(password),
      plain_access_code: accessCode,
      plain_identifier: identifier,
      plain_password: password,
      expires_at: new Date(Date.now() + days * 86400000).toISOString(), active: true
    };
    try {
      await supabase("/rest/v1/supplier_portal_links", {
        method: "POST", prefer: "return=minimal",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const message = error.message || "";
      if (!/identifier_hash|password_hash|plain_access_code|plain_identifier|plain_password|schema cache|Could not find/i.test(message)) throw error;
      throw new Error("Execute o SQL supplier_portal_recoverable_credentials.sql no Supabase antes de gerar links com senha.");
    }
    return json(200, { accessCode, identifier, password, supplierName: suppliers[0].name });
  } catch (error) {
    console.error(error);
    const unauthorized = /administrativo não autorizado/i.test(error.message || "");
    return json(unauthorized ? 401 : 500, {
      error: error.message || "Não foi possível gerar o link do fornecedor."
    });
  }
};

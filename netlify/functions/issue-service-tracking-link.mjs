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
      clientId, startDate, endDate, validDays = 30, allowRequests = false, showAmounts = true,
      visibleServiceIds = []
    } = await request.json();
    const days = Math.min(90, Math.max(1, Number(validDays) || 30));
    if (!clientId || !startDate || !endDate) {
      return json(400, { error: "Cliente e período são obrigatórios." });
    }
    if (endDate < startDate) return json(400, { error: "A data final deve ser igual ou posterior à inicial." });

    const clients = await supabase(`/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&active=eq.true&select=id,name&limit=1`);
    if (!clients.length) return json(404, { error: "Cliente não encontrado." });

    // So pode existir um link ativo por cliente: gerar um novo invalida o anterior
    // e apaga tambem as credenciais em texto do anterior (nao ficam recuperaveis).
    await supabase(
      `/rest/v1/service_tracking_links?client_id=eq.${encodeURIComponent(clientId)}&active=eq.true`,
      {
        method: "PATCH",
        body: JSON.stringify({
          active: false,
          plain_access_code: null,
          plain_full_token: null,
          plain_identifier: null,
          plain_password: null
        })
      }
    );

    const accessCode = randomAccessCode();
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

    // Todo link novo ja nasce com acesso completo embutido (sem tela de senha)
    // e tambem com identificador/senha, caso precise ser digitado manualmente.
    // Financeiro e Relatorio de cobranca ficam sempre fora desse acesso completo.
    const fullAccessCode = randomAccessCode();
    const identifier = randomIdentifier();
    const password = randomPassword();

    const payload = {
      client_id: clientId,
      token_hash: accessCodeHash(accessCode),
      period_start: startDate,
      period_end: endDate,
      expires_at: expiresAt,
      allow_requests: Boolean(allowRequests),
      show_amounts: Boolean(showAmounts),
      identifier_hash: identifierHash(identifier),
      password_hash: passwordHash(password),
      full_token_hash: accessCodeHash(fullAccessCode),
      full_show_financial: false,
      full_show_billing: false,
      visible_service_ids: Array.isArray(visibleServiceIds) ? visibleServiceIds : [],
      plain_access_code: accessCode,
      plain_full_token: fullAccessCode,
      plain_identifier: identifier,
      plain_password: password,
      active: true
    };
    try {
      await supabase("/rest/v1/service_tracking_links", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const message = error.message || "";
      if (/plain_access_code|plain_full_token|plain_identifier|plain_password/i.test(message)) {
        throw new Error("Execute o SQL tracking_links_recoverable_credentials.sql no Supabase antes de gerar links.");
      }
      if (/identifier_hash|password_hash|full_token_hash|full_show_financial|full_show_billing|visible_service_ids/i.test(message)) {
        throw new Error("Execute o SQL service_tracking_links.sql no Supabase antes de gerar links com este acesso completo/senha.");
      }
      if (!/allow_requests|show_amounts|schema cache|Could not find/i.test(message)) throw error;
      if (allowRequests || !showAmounts) {
        throw new Error("Execute o SQL service_tracking_links.sql no Supabase antes de liberar pedidos neste link.");
      }
      const { allow_requests, show_amounts, ...compatiblePayload } = payload;
      await supabase("/rest/v1/service_tracking_links", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(compatiblePayload)
      });
    }

    return json(200, {
      accessCode,
      fullAccessCode,
      identifier,
      password,
      clientName: clients[0].name,
      allowRequests: Boolean(allowRequests),
      showAmounts: Boolean(showAmounts),
      expiresAt
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message });
  }
};

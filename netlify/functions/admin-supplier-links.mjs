import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method === "DELETE") {
    try {
      await requireAdmin(request);
      const { id } = await request.json();
      if (!id) return json(400, { error: "Link não informado." });
      await supabase(`/rest/v1/supplier_portal_links?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({
          active: false,
          plain_access_code: null,
          plain_identifier: null,
          plain_password: null
        })
      });
      return json(200, { ok: true });
    } catch (error) {
      console.error(error);
      return json(401, { error: error.message || "Não foi possível excluir o link." });
    }
  }

  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);

    const links = await supabase(
      "/rest/v1/supplier_portal_links?active=eq.true"
      + "&select=id,supplier_id,period_start,period_end,expires_at,can_edit,can_mark_done,can_cancel,created_at,"
      + "plain_access_code,plain_identifier,plain_password"
      + "&order=created_at.desc"
    );
    if (!links.length) return json(200, { links: [] });

    const supplierIds = [...new Set(links.map((item) => item.supplier_id))];
    const suppliers = await supabase(
      `/rest/v1/suppliers?id=in.(${supplierIds.map(encodeURIComponent).join(",")})&select=id,name`
    );
    const supplierNameById = new Map(suppliers.map((item) => [item.id, item.name]));

    return json(200, {
      links: links.map((item) => ({
        id: item.id,
        supplierId: item.supplier_id,
        supplierName: supplierNameById.get(item.supplier_id) || "Fornecedor",
        periodStart: item.period_start,
        periodEnd: item.period_end,
        expiresAt: item.expires_at,
        canEdit: item.can_edit,
        canMarkDone: item.can_mark_done,
        canCancel: item.can_cancel,
        createdAt: item.created_at,
        accessCode: item.plain_access_code,
        identifier: item.plain_identifier,
        password: item.plain_password
      }))
    });
  } catch (error) {
    console.error(error);
    const message = /plain_access_code|plain_identifier|plain_password/i.test(error.message || "")
      ? "Execute o SQL supplier_portal_recoverable_credentials.sql no Supabase antes de listar os links gerados."
      : error.message;
    return json(401, { error: message });
  }
};

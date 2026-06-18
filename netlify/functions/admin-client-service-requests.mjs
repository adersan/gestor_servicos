import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  try {
    await requireAdmin(request);

    if (request.method === "GET") {
      const rows = await supabase(
        "/rest/v1/client_service_requests?select=*&order=created_at.desc"
      );
      return json(200, { requests: rows });
    }

    if (request.method === "PATCH") {
      const { id, values = {} } = await request.json();
      if (!id) return json(400, { error: "Pedido nao informado." });
      const allowed = {};
      if (values.status) allowed.status = values.status;
      if (Array.isArray(values.imported_entry_ids)) allowed.imported_entry_ids = values.imported_entry_ids;
      if (values.imported_at !== undefined) allowed.imported_at = values.imported_at;
      if (values.updated_at !== undefined) allowed.updated_at = values.updated_at;
      await supabase(`/rest/v1/client_service_requests?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify(allowed)
      });
      return json(200, { ok: true });
    }

    if (request.method === "DELETE") {
      const { id } = await request.json();
      if (!id) return json(400, { error: "Pedido nao informado." });
      await supabase(`/rest/v1/client_service_requests?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
      return json(200, { ok: true });
    }

    return json(405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Nao foi possivel gerenciar os pedidos." });
  }
};

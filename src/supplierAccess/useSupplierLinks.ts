import { useCallback, useEffect, useState } from "react";

import type { SupplierLink } from "@/types/global";

interface SupplierLinksResponse {
  links?: SupplierLink[];
  error?: string;
}

async function authorizedFetch(path: string, init?: RequestInit) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${accessToken}` }
  });
}

// Espelha useTrackingLinks.ts (Fase 8) - mesmo formato de fetch autenticado,
// so trocando o endpoint (admin-supplier-links) e o formato de URL
// (fornecedor.html?acesso=... em vez de acompanhamento.html?access=...).
export function useSupplierLinks(active: boolean) {
  const [links, setLinks] = useState<SupplierLink[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authorizedFetch("/.netlify/functions/admin-supplier-links");
      const result: SupplierLinksResponse = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os links gerados.");
      setLinks(result.links || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && links === null && !loading) refresh();
  }, [active, links, loading, refresh]);

  const removeLink = useCallback(async (id: string) => {
    const confirmed = await window.showAppConfirm("Excluir este link? O acesso e a senha deixam de funcionar imediatamente.");
    if (!confirmed) return;
    try {
      const response = await authorizedFetch("/.netlify/functions/admin-supplier-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result: SupplierLinksResponse = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o link.");
      window.showAppAlert("Link excluído.", { type: "success" });
      setLinks((current) => (current || []).filter((item) => item.id !== id));
    } catch (err) {
      window.showAppAlert(err instanceof Error ? err.message : String(err), { type: "error" });
    }
  }, []);

  return { links, loading, error, refresh, removeLink };
}

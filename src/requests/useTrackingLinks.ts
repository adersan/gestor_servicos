import { useCallback, useEffect, useState } from "react";

import type { TrackingLink } from "@/types/global";

interface TrackingLinksResponse {
  links?: TrackingLink[];
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

// Diferente de useRequestsData (le window.getAppState() sincrono): links
// gerados vem de fetch autenticado (admin-tracking-links), sem espelho local
// em state - por isso o hook cuida do proprio ciclo de carregar/remover, sem
// depender do renderTrackingLinksPanel() vanilla (que so re-renderiza o DOM
// vanilla, nao o root React). Ver Fase 8.
export function useTrackingLinks(active: boolean) {
  const [links, setLinks] = useState<TrackingLink[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authorizedFetch("/.netlify/functions/admin-tracking-links");
      const result: TrackingLinksResponse = await response.json().catch(() => ({}));
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
      const response = await authorizedFetch("/.netlify/functions/admin-tracking-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result: TrackingLinksResponse = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o link.");
      window.showAppAlert("Link excluído.", { type: "success" });
      setLinks((current) => (current || []).filter((item) => item.id !== id));
    } catch (err) {
      window.showAppAlert(err instanceof Error ? err.message : String(err), { type: "error" });
    }
  }, []);

  return { links, loading, error, refresh, removeLink };
}

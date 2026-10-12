import { useCallback, useEffect, useRef, useState } from "react";

import { fetchTrackingData, saveTrackingRequester, sendTrackingServiceRequest } from "@/acompanhamento/api";
import { AccessChoice } from "@/acompanhamento/components/AccessChoice";
import { BillingTab } from "@/acompanhamento/components/BillingTab";
import { FinancialTab } from "@/acompanhamento/components/FinancialTab";
import { ServicesTab } from "@/acompanhamento/components/ServicesTab";
import { formatDate } from "@/acompanhamento/format";
import {
  clearStoredChoice,
  getStoredAccessCode,
  getStoredChoice,
  getStoredFullCredentials,
  setStoredAccessCode,
  setStoredChoice,
  setStoredFullAccessCode,
  setStoredFullIdentityCredentials
} from "@/acompanhamento/storage";
import type { TrackingApiResponse, TrackingView } from "@/acompanhamento/types";

type Phase = "loading" | "error" | "access-choice" | "ready";

const POLL_INTERVAL_MS = 20000;

export function Acompanhamento() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<TrackingApiResponse | null>(null);
  const [activeView, setActiveView] = useState<TrackingView>("services");
  const [refreshing, setRefreshing] = useState(false);
  const [navBusy, setNavBusy] = useState(false);

  const accessCodeRef = useRef("");
  const weekOffsetRef = useRef(0);
  const dataRef = useRef<TrackingApiResponse | null>(null);
  const pendingRestrictedDataRef = useRef<TrackingApiResponse | null>(null);
  const busyRef = useRef(false);
  const passwordFormVisibleRef = useRef(false);

  dataRef.current = data;

  const performLoad = useCallback(async (weekOffsetOverride?: number) => {
    const storedChoice = getStoredChoice();
    const credentials = storedChoice === "full" ? getStoredFullCredentials() : {};
    const result = await fetchTrackingData(
      accessCodeRef.current,
      weekOffsetOverride ?? weekOffsetRef.current,
      credentials
    );
    if (result.linkMode === "gated" && !storedChoice) {
      pendingRestrictedDataRef.current = result;
      setPhase("access-choice");
      return;
    }
    if (result.linkMode === "gated") setStoredChoice(result.tier);
    weekOffsetRef.current = Number.isInteger(result.weekOffset) ? result.weekOffset : 0;
    setData(result);
    setPhase("ready");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryCode = params.get("access");
    const queryFull = params.get("full");
    if (queryCode) {
      setStoredAccessCode(queryCode);
      if (queryFull) setStoredFullAccessCode(queryFull);
      history.replaceState({}, "", location.pathname);
    }
    const code = queryCode || getStoredAccessCode();
    if (!code) {
      setErrorMessage("Este link de acompanhamento é inválido.");
      setPhase("error");
      return;
    }
    accessCodeRef.current = code;
    performLoad().catch((err) => {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    });
  }, [performLoad]);

  const refresh = useCallback(
    async (manual: boolean) => {
      if (busyRef.current) return;
      if (passwordFormVisibleRef.current) return;
      busyRef.current = true;
      if (manual) setRefreshing(true);
      try {
        await performLoad();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase("error");
      } finally {
        busyRef.current = false;
        if (manual) setRefreshing(false);
      }
    },
    [performLoad]
  );

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh(false);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      refresh(false);
    }, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function navigateWeek(delta: number) {
    if (busyRef.current) return;
    const next = weekOffsetRef.current + delta;
    weekOffsetRef.current = next;
    busyRef.current = true;
    setNavBusy(true);
    try {
      await performLoad(next);
    } catch (err) {
      weekOffsetRef.current -= delta;
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    } finally {
      busyRef.current = false;
      setNavBusy(false);
    }
  }

  function enterRestricted() {
    const restricted = pendingRestrictedDataRef.current || dataRef.current;
    if (!restricted) return;
    setStoredChoice("restricted");
    pendingRestrictedDataRef.current = null;
    passwordFormVisibleRef.current = false;
    weekOffsetRef.current = Number.isInteger(restricted.weekOffset) ? restricted.weekOffset : 0;
    setData(restricted);
    setPhase("ready");
  }

  async function enterFullAccess(identifier: string, password: string) {
    const result = await fetchTrackingData(accessCodeRef.current, weekOffsetRef.current, { identifier, password });
    if (result.tier !== "full") throw new Error("Identificador ou senha inválidos.");
    setStoredFullIdentityCredentials(identifier, password);
    setStoredChoice("full");
    pendingRestrictedDataRef.current = null;
    passwordFormVisibleRef.current = false;
    weekOffsetRef.current = Number.isInteger(result.weekOffset) ? result.weekOffset : 0;
    setData(result);
    setPhase("ready");
  }

  function switchToFullAccess() {
    clearStoredChoice();
    setPhase("access-choice");
  }

  async function submitServiceRequest(payload: {
    serviceId: string;
    references: string;
    requestedBy: string;
    notes: string;
  }) {
    await sendTrackingServiceRequest({ accessCode: accessCodeRef.current, ...payload });
    await refresh(false);
  }

  async function addRequester(name: string) {
    const result = await saveTrackingRequester({ accessCode: accessCodeRef.current, name });
    setData((current) => {
      if (!current) return current;
      return { ...current, clientRequesters: [...(current.clientRequesters || []), result.requester] };
    });
    return result.requester;
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 text-center text-muted">Carregando serviços...</div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center text-danger">{errorMessage}</div>
      </div>
    );
  }

  if (phase === "access-choice") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <AccessChoice
          onEnterRestricted={enterRestricted}
          onEnterFull={enterFullAccess}
          onPasswordFormVisibleChange={(visible) => {
            passwordFormVisibleRef.current = visible;
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  const periodSuffix = data.weekOffset === 0 ? " · Semana atual" : "";
  const showSwitchToFull = data.linkMode === "gated" && data.tier === "restricted";

  const tabs: Array<{ key: TrackingView; label: string; visible: boolean }> = [
    { key: "services", label: "Serviços", visible: true },
    { key: "financial", label: "Financeiro", visible: data.showAmounts !== false },
    { key: "billing", label: "Relatório de cobrança", visible: Boolean(data.billing) }
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-ink">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Consulta somente leitura</span>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{data.client.name}</h2>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Semana anterior"
              disabled={data.canGoBack === false || navBusy}
              onClick={() => navigateWeek(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:opacity-60"
            >
              ‹
            </button>
            <p className="text-sm text-muted">
              {formatDate(data.period.startDate)} a {formatDate(data.period.endDate)}
              {periodSuffix}
            </p>
            <button
              type="button"
              aria-label="Próxima semana"
              disabled={data.canGoForward === false || navBusy}
              onClick={() => navigateWeek(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:opacity-60"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-right">
            <span className="block text-[11px] text-muted">Atualizado em</span>
            <strong className="block text-xs text-ink">{new Date(data.updatedAt).toLocaleString("pt-BR")}</strong>
          </div>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:opacity-60"
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {showSwitchToFull && (
        <button
          type="button"
          onClick={switchToFullAccess}
          className="mb-4 text-xs font-semibold text-muted hover:text-ink hover:underline"
        >
          Tenho senha, quero acesso completo
        </button>
      )}

      <nav aria-label="Areas do acompanhamento" className="mb-5 flex flex-wrap gap-2">
        {tabs
          .filter((tab) => tab.visible)
          .map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveView(tab.key)}
              className={
                activeView === tab.key
                  ? "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-soft"
              }
            >
              {tab.label}
            </button>
          ))}
      </nav>

      {activeView === "services" && (
        <ServicesTab data={data} onSubmitRequest={submitServiceRequest} onAddRequester={addRequester} />
      )}
      {activeView === "financial" && data.showAmounts !== false && <FinancialTab data={data} />}
      {activeView === "billing" && data.billing && <BillingTab client={data.client} billing={data.billing} />}

      <p className="mt-6 text-center text-xs text-muted">
        Link válido até {new Date(data.expiresAt).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";

import { SettingsCard } from "@/settings/components/SettingsCard";
import type { PushToggleState } from "@/types/global";

const INITIAL_STATE: PushToggleState = { supported: true, disabled: true, label: "Carregando...", status: "" };

// Nao reaproveita os ids do vanilla (settingsPushToggle/settingsPushStatus)
// de proposito - evita ids duplicados no documento (a copia vanilla continua
// no DOM, so escondida) e mantem o estado 100% local ao componente, sem
// depender de updatePushToggleButton() mutar o DOM por fora do React.
export function PushSettingsCard() {
  const [state, setState] = useState<PushToggleState>(INITIAL_STATE);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setState(await window.pushToggleState());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleClick = async () => {
    setBusy(true);
    try {
      await window.togglePushNotifications();
    } catch (error) {
      window.showAppAlert((error as Error).message, { type: "warning" });
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      eyebrow="Alertas"
      title="Notificações push"
      description="Receba avisos de pedido novo e atrasos mesmo com o app fechado neste aparelho. No iPhone, adicione o app à Tela de Início antes de ativar (iOS 16.4 ou mais novo)."
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={state.disabled || busy}
        className="self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {state.label}
      </button>
      {state.status && <p className="text-sm text-muted">{state.status}</p>}
    </SettingsCard>
  );
}

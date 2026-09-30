import { useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";

import { SettingsCard } from "@/settings/components/SettingsCard";
import { PeriodSettingsCard } from "@/settings/components/PeriodSettingsCard";
import { ToggleSettingsCard } from "@/settings/components/ToggleSettingsCard";
import { PushSettingsCard } from "@/settings/components/PushSettingsCard";

const THEMES = [
  { value: "verde", label: "Verde", color: "#173f35" },
  { value: "azul", label: "Azul", color: "#1b3f66" },
  { value: "grafite", label: "Grafite", color: "#3a464d" },
  { value: "dark", label: "Dark", color: "#0f1613" },
  { value: "bluedark", label: "Blue Dark", color: "#0d1420" }
];

// Fase 17 da migracao React: "Configuracoes" (vanilla #settings, app.js).
// Mutacoes que antes eram listeners diretos por id (fragil se o DOM fosse
// recriado pelo React) foram extraidas em funcoes reutilizaveis no bridge
// (updatePeriodMode/updateWeekDays/updateAskEntryContinuation/
// updateOfferSupplierShare/pushToggleState/togglePushNotifications,
// getSystemSettings) - ver refactor em app.js. Tema (data-theme-option) e
// som (data-settings-sound-shortcut) continuam 100% delegados, nenhuma
// mudanca necessaria alem de reaproveitar os mesmos atributos/classes
// vanilla (nao ids, pra nao colidir com a copia escondida).
export function Settings() {
  const settings = window.getSystemSettings();

  useEffect(() => {
    window.applyTheme();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <SettingsIcon className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Preferências</span>
          <h2 className="text-xl font-bold text-brand-ink">Configurações</h2>
          <p className="text-sm text-muted">Central para os padrões gerais do sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PeriodSettingsCard />

        <SettingsCard eyebrow="Alertas" title="Som e notificações" description="Use o sino no topo para ligar ou desligar alertas sonoros neste aparelho.">
          <button
            type="button"
            data-settings-sound-shortcut
            className="self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Alternar som dos alertas
          </button>
        </SettingsCard>

        <SettingsCard eyebrow="WhatsApp" title="Conexão APIBrasil" description="Inicie ou consulte a sessão do WhatsApp pela área de configurações.">
          <button
            type="button"
            data-dialog="whatsappDialog"
            className="self-start rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Conectar WhatsApp
          </button>
        </SettingsCard>

        <ToggleSettingsCard
          eyebrow="Lançamento"
          title="Continuar após salvar"
          description="Ao terminar um lançamento novo, perguntar se quer lançar de novo para o mesmo cliente ou para outro."
          checkboxLabel="Perguntar após cada lançamento novo"
          initialChecked={settings.askEntryContinuation}
          onToggle={(checked) => window.updateAskEntryContinuation(checked)}
        />

        <ToggleSettingsCard
          eyebrow="Fornecedor"
          title="Enviar serviço agora"
          description="Ao lançar um serviço com fornecedor vinculado, oferecer o envio da solicitação pelo WhatsApp na hora."
          checkboxLabel="Perguntar após cada lançamento com fornecedor"
          initialChecked={settings.offerSupplierShare}
          onToggle={(checked) => window.updateOfferSupplierShare(checked)}
        />

        <SettingsCard eyebrow="Aparência" title="Tema de cores" description="Escolha o tema deste aparelho. Os portais de cliente e fornecedor seguirão o tema em breve.">
          <div className="theme-options">
            {THEMES.map((theme) => (
              <button key={theme.value} type="button" data-theme-option={theme.value}>
                <i style={{ background: theme.color }} />
                {theme.label}
              </button>
            ))}
          </div>
        </SettingsCard>

        <PushSettingsCard />

        <SettingsCard eyebrow="Sobre" title="Sobre o aplicativo">
          <div className="about-brand">
            <img src="logo.svg" alt="" aria-hidden="true" />
            <div>
              <strong>AS TECH SOLUTIONS LTDA.</strong>
              <span>Todos os direitos reservados.</span>
              <a className="about-brand-github" href="https://github.com/adersan" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.1.79-.25.79-.56v-2.01c-3.22.7-3.9-1.38-3.9-1.38-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.18.08 1.8 1.21 1.8 1.21 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.72 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.47.11-3.06 0 0 .98-.31 3.17 1.18a10.98 10.98 0 0 1 5.78 0c2.19-1.49 3.16-1.18 3.16-1.18.64 1.59.24 2.77.12 3.06.75.81 1.2 1.84 1.2 3.1 0 4.45-2.71 5.43-5.29 5.72.42.36.79 1.08.79 2.17v3.02c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

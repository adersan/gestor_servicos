import { useEffect } from "react";

import { IconToolbar } from "@/extras/components/IconToolbar";
import { ToolProperties } from "@/extras/components/ToolProperties";
import { ActionBar } from "@/extras/components/ActionBar";

// Espelha #extrasEditorPanel. A area do canvas (#extrasCanvasWrap e os dois
// <canvas> do Fabric) AINDA NAO e renderizada aqui de proposito - Fase 19b e
// so a casca (toolbar/propriedades/acoes); a Fase 19c troca este placeholder
// pela "ilha" de canvas adotada via ref do DOM vanilla (nunca recriada, pra
// nao perder a instancia do fabric.Canvas ja inicializada no boot). Ate la,
// esta tela so fica acessivel via ?newExtras=1 (opt-in), nao e o padrao.
export function EditorPanel() {
  // initializeExtrasTools() ja rodou uma vez no boot, contra o DOM vanilla
  // (que existia antes do React montar) - a marcacao JSX estatica acima
  // reproduz os defaults do HTML original, que nem sempre batem com o estado
  // correto da ferramenta padrao ("select"). Resincroniza contra os nos
  // React de verdade assim que montam, reaproveitando a MESMA funcao que ja
  // faz isso (sem duplicar a logica de quais grupos cada ferramenta mostra).
  useEffect(() => {
    window.extrasSyncToolOptionsVisibility?.();
  }, []);

  return (
    <div id="extrasEditorPanel" className="extras-editor hidden">
      <div className="extras-canvas-wrap" id="rdExtrasCanvasPlaceholder">
        <p className="meta" style={{ padding: 24, textAlign: "center" }}>
          Editor de canvas em construção (Fase 19c) — use o link sem <code>?newExtras=1</code> por enquanto.
        </p>
      </div>

      <IconToolbar />
      <ToolProperties />
      <ActionBar />
    </div>
  );
}

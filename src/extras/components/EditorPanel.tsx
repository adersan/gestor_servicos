import { useEffect } from "react";

import { CanvasIsland } from "@/extras/components/CanvasIsland";
import { IconToolbar } from "@/extras/components/IconToolbar";
import { ToolProperties } from "@/extras/components/ToolProperties";
import { ActionBar } from "@/extras/components/ActionBar";

// Espelha #extrasEditorPanel. A area do canvas e adotada (nao recriada) do
// DOM vanilla - ver CanvasIsland.tsx pro porque e como.
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
      <CanvasIsland />
      <IconToolbar />
      <ToolProperties />
      <ActionBar />
    </div>
  );
}

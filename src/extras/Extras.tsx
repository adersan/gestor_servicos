import { UploadPanel } from "@/extras/components/UploadPanel";
import { PreviewPanel } from "@/extras/components/PreviewPanel";
import { LoadingPanel } from "@/extras/components/LoadingPanel";
import { BeforeAfterPanel } from "@/extras/components/BeforeAfterPanel";
import { ErrorPanel } from "@/extras/components/ErrorPanel";
import { EditorPanel } from "@/extras/components/EditorPanel";

// Fase 19b da migracao React: casca do Extras (vanilla #extras, index.html).
// Renderiza os 6 paineis (upload/preview/loading/antes-depois/erro/editor)
// com os MESMOS ids/classes do HTML vanilla, sem nenhum estado React pra
// controlar qual aparece - extrasShowPanel()/EXTRAS_PANEL_IDS (app.js) ja
// alternam a classe "hidden" por id, funcionando identico independente de
// quem renderizou o DOM (mesmo principio ja usado em toda a migracao: nunca
// duplicar logica, so trocar o motor de renderizacao). Canvas/Fabric ainda
// nao funcionam aqui - ver EditorPanel.tsx e a Fase 19c.
export function Extras() {
  return (
    <div className="flex flex-col gap-4">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Ferramentas</span>
          <h2>Extras</h2>
          <p className="meta">Remova o fundo de uma foto com IA e ajuste o resultado antes de baixar.</p>
        </div>
      </div>

      <UploadPanel />
      <PreviewPanel />
      <LoadingPanel />
      <BeforeAfterPanel />
      <ErrorPanel />
      <EditorPanel />
    </div>
  );
}

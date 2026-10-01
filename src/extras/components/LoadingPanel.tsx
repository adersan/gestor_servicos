// Espelha #extrasLoadingPanel 1:1. Textos iniciais batem com o vanilla;
// extrasProceedRemoveBg()/extrasProceedGenerateHandwriting() (app.js) trocam
// extrasLoadingTitle/extrasLoadingSubtitle via textContent conforme o fluxo.
export function LoadingPanel() {
  return (
    <div id="extrasLoadingPanel" className="panel extras-loading-panel hidden">
      <span className="extras-spinner" aria-hidden="true" />
      <strong id="extrasLoadingTitle">Processando a imagem…</strong>
      <span className="meta" id="extrasLoadingSubtitle">
        Isso leva alguns segundos.
      </span>
    </div>
  );
}

// Espelha #extrasErrorPanel 1:1.
export function ErrorPanel() {
  return (
    <div id="extrasErrorPanel" className="panel extras-error-panel hidden">
      <strong>Não foi possível processar a imagem</strong>
      <p className="meta" id="extrasErrorMessage" />
      <button className="secondary" type="button" data-extras-action="retry">
        Tentar novamente
      </button>
    </div>
  );
}

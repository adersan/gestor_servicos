// Espelha #extrasPreviewPanel 1:1 (ver UploadPanel.tsx pro principio geral).
export function PreviewPanel() {
  return (
    <div id="extrasPreviewPanel" className="panel extras-preview-panel hidden">
      <img id="extrasPreviewImage" alt="Imagem escolhida" />
      <div id="extrasPreviewActions" className="extras-preview-menu">
        <button type="button" className="secondary" data-extras-preview-action="edit">
          Editar imagem
        </button>
        <button type="button" className="secondary" data-extras-preview-action="generate-handwriting">
          Gerar com IA (experimental)
        </button>
        <button type="button" className="primary" data-extras-preview-action="remove-bg">
          Remover fundo
        </button>
        <button type="button" className="secondary" data-extras-preview-action="cancel">
          Cancelar
        </button>
      </div>
      <div id="extrasHandwritingForm" className="extras-handwriting-form hidden">
        <p className="meta">Experimental: a IA pode não reproduzir fielmente a caligrafia da imagem enviada.</p>
        <label>
          Texto a gerar
          <input type="text" id="extrasHandwritingText" maxLength={60} placeholder="Ex.: João Silva" />
        </label>
        <div className="extras-preview-actions">
          <button type="button" className="secondary" id="extrasHandwritingCancelButton">
            Cancelar
          </button>
          <button type="button" className="primary" id="extrasHandwritingGenerateButton">
            Gerar
          </button>
        </div>
      </div>
    </div>
  );
}

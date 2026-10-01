// Espelha #extrasBeforeAfterPanel 1:1.
export function BeforeAfterPanel() {
  return (
    <div id="extrasBeforeAfterPanel" className="panel extras-before-after-panel hidden">
      <div className="extras-before-after-grid">
        <figure>
          <img id="extrasBeforeImage" alt="Antes" />
          <figcaption>Antes</figcaption>
        </figure>
        <figure>
          <img id="extrasAfterImage" alt="Depois" />
          <figcaption>Depois</figcaption>
        </figure>
      </div>
      <label className="extras-range-label extras-sensitivity-label">
        Sensibilidade do recorte (mais alto = bordas mais rígidas)
        <input type="range" id="extrasSensitivity" min={0} max={100} defaultValue={0} />
      </label>
      <div className="extras-preview-actions">
        <button type="button" className="secondary" data-extras-action="cancel-before-after">
          Cancelar
        </button>
        <button type="button" className="secondary hidden" id="extrasSaveSignatureButton">
          Salvar assinatura
        </button>
        <button type="button" className="primary" data-extras-action="continue-edit">
          Continuar editando
        </button>
      </div>
      <div id="extrasSaveSignatureForm" className="signature-rename-row hidden">
        <input type="text" id="extrasSaveSignatureName" maxLength={60} placeholder="Nome da assinatura" />
        <button type="button" className="secondary" id="extrasSaveSignatureCancelButton">
          Cancelar
        </button>
        <button type="button" className="primary" id="extrasSaveSignatureConfirmButton">
          Salvar
        </button>
      </div>
    </div>
  );
}

// Espelha #extrasUploadPanel (index.html) 1:1 - mesmas classes/ids/data-*
// vanilla, reaproveitando o CSS .extras-* ja existente em vez de Tailwind.
// Sem onClick/onChange: toda interacao (clique no dropzone, escolha de
// arquivo, arrastar/soltar, colar) e tratada pela delegacao generica de
// document.addEventListener ja existente em app.js (Fase 19a).
export function UploadPanel() {
  return (
    <div id="extrasUploadPanel" className="panel extras-upload-panel">
      <div id="extrasDropzone" className="extras-dropzone" tabIndex={0} role="button" aria-label="Escolher ou soltar uma imagem">
        <span className="extras-dropzone-icon" aria-hidden="true">
          🖼
        </span>
        <strong>Toque para escolher uma imagem</strong>
        <span className="meta">ou arraste e solte, ou cole com Ctrl+V — PNG ou JPG, até 10MB</span>
        <input type="file" id="extrasFileInput" accept="image/png,image/jpeg,image/webp" hidden />
      </div>
      <button type="button" className="extras-signature-entry" data-dialog="signatureDialog">
        <span aria-hidden="true">✒️</span>
        <span>
          <strong>Escrita personalizada</strong>
          <small>Gere um texto ou assinatura estilizada e exporte em PNG transparente</small>
        </span>
      </button>
      <button type="button" className="extras-signature-entry" data-dialog="savedSignaturesDialog">
        <span aria-hidden="true">🗂️</span>
        <span>
          <strong>Minhas assinaturas</strong>
          <small>Veja, renomeie ou reutilize assinaturas digitalizadas/geradas anteriormente</small>
        </span>
      </button>
    </div>
  );
}

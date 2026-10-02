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
          <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="9" cy="9" r="1.7"/><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20"/></svg>
        </span>
        <strong>Toque para escolher uma imagem</strong>
        <span className="meta">ou arraste e solte, ou cole com Ctrl+V — PNG ou JPG, até 10MB</span>
        <input type="file" id="extrasFileInput" accept="image/png,image/jpeg,image/webp" hidden />
      </div>
      <button type="button" className="extras-signature-entry" data-dialog="signatureDialog">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
        </span>
        <span>
          <strong>Escrita personalizada</strong>
          <small>Gere um texto ou assinatura estilizada e exporte em PNG transparente</small>
        </span>
      </button>
      <button type="button" className="extras-signature-entry" data-dialog="savedSignaturesDialog">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
        </span>
        <span>
          <strong>Minhas assinaturas</strong>
          <small>Veja, renomeie ou reutilize assinaturas digitalizadas/geradas anteriormente</small>
        </span>
      </button>
    </div>
  );
}

// Espelha .extras-icon-toolbar 1:1. Cada categoria/botao casa exatamente com
// o HTML vanilla (icone, title, aria-label, data-extras-tool/data-dialog).
export function IconToolbar() {
  return (
    <div className="extras-icon-toolbar panel">
      <div className="extras-icon-category">
        <span className="extras-category-label">Selecionar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn active" data-extras-tool="select" title="Seleção" aria-label="Seleção">
            <svg viewBox="0 0 24 24"><path d="M5 3 19 12 12 14 9 21 5 3Z"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Retocar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="erase" title="Apagar" aria-label="Apagar">
            <svg viewBox="0 0 24 24"><path d="M21 21H8a2 2 0 0 1-1.4-.6l-4.8-4.7a2 2 0 0 1 0-2.8l10-10a2 2 0 0 1 2.8 0l5.8 5.7a2 2 0 0 1 0 2.8L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="restore" title="Restaurar" aria-label="Restaurar">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="marker" title="Marcador" aria-label="Marcador">
            <svg viewBox="0 0 24 24"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Desenhar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="pencil" title="Lápis" aria-label="Lápis">
            <svg viewBox="0 0 24 24"><path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="signature" title="Caneta (assinatura)" aria-label="Caneta">
            <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.4 3.6a1 1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="rect" title="Retângulo" aria-label="Retângulo">
            <svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="ellipse" title="Elipse" aria-label="Elipse">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="text" title="Texto" aria-label="Texto">
            <svg viewBox="0 0 24 24"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Ajustar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="crop" title="Recortar" aria-label="Recortar">
            <svg viewBox="0 0 24 24"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-action="rotate" title="Girar 90°" aria-label="Girar 90°">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="background" title="Fundo" aria-label="Fundo">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></svg>
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="adjust" title="Brilho e contraste" aria-label="Brilho e contraste">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Filtros</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="filters" title="Filtros" aria-label="Filtros">
            <svg viewBox="0 0 24 24"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><circle cx="12" cy="4" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="20" r="2"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Molduras</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="frame" title="Molduras" aria-label="Molduras">
            <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="9" cy="9" r="1.7"/><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Adesivos</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="stickers" title="Adesivos" aria-label="Adesivos">
            <svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.2.6-4.7 4.2 1.4 6.1L12 16.4 6.5 19.5l1.4-6.1-4.7-4.2 6.2-.6Z"/></svg>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Mais</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-dialog="signatureDialog" title="Escrita personalizada" aria-label="Escrita personalizada">
            <svg viewBox="0 0 24 24"><path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

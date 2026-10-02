// Espelha .extras-action-bar 1:1.
export function ActionBar() {
  return (
    <div className="extras-action-bar panel">
      <button type="button" className="extras-icon-btn" data-extras-action="undo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
        <svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 1 1 0 10h-1"/></svg>
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="redo" title="Refazer (Ctrl+Y)" aria-label="Refazer">
        <svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5"/><path d="M20 12H9a5 5 0 1 0 0 10h1"/></svg>
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="reset" title="Reiniciar" aria-label="Reiniciar">
        <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 21v-5h5"/></svg>
      </button>
      <button type="button" className="extras-icon-btn" data-extras-tool="zoom" title="Zoom" aria-label="Zoom">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="delete-object" title="Excluir objeto selecionado (Delete)" aria-label="Excluir objeto selecionado">
        <svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>
      </button>
      <button type="button" className="secondary" data-extras-action="clear">
        Limpar
      </button>
      <button type="button" className="secondary" data-extras-action="new">
        Nova imagem
      </button>
      <button type="button" className="primary" data-extras-action="download">
        Baixar PNG
      </button>
    </div>
  );
}

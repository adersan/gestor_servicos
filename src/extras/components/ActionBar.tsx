// Espelha .extras-action-bar 1:1.
export function ActionBar() {
  return (
    <div className="extras-action-bar panel">
      <button type="button" className="extras-icon-btn" data-extras-action="undo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
        ↶
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="redo" title="Refazer (Ctrl+Y)" aria-label="Refazer">
        ↷
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="reset" title="Reiniciar" aria-label="Reiniciar">
        🧹
      </button>
      <button type="button" className="extras-icon-btn" data-extras-tool="zoom" title="Zoom" aria-label="Zoom">
        🔍
      </button>
      <button type="button" className="extras-icon-btn" data-extras-action="delete-object" title="Excluir objeto selecionado (Delete)" aria-label="Excluir objeto selecionado">
        🗑
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

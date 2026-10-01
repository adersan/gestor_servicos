// Espelha .extras-icon-toolbar 1:1. Cada categoria/botao casa exatamente com
// o HTML vanilla (icone, title, aria-label, data-extras-tool/data-dialog).
export function IconToolbar() {
  return (
    <div className="extras-icon-toolbar panel">
      <div className="extras-icon-category">
        <span className="extras-category-label">Selecionar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn active" data-extras-tool="select" title="Seleção" aria-label="Seleção">
            ↖
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Retocar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="erase" title="Apagar" aria-label="Apagar">
            ⌫
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="restore" title="Restaurar" aria-label="Restaurar">
            🩹
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="marker" title="Marcador" aria-label="Marcador">
            🖍️
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Desenhar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="pencil" title="Lápis" aria-label="Lápis">
            ✏️
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="signature" title="Caneta (assinatura)" aria-label="Caneta">
            🖋️
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="rect" title="Retângulo" aria-label="Retângulo">
            ▭
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="ellipse" title="Elipse" aria-label="Elipse">
            ◯
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="text" title="Texto" aria-label="Texto">
            <b>T</b>
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Ajustar</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="crop" title="Recortar" aria-label="Recortar">
            ✂
          </button>
          <button type="button" className="extras-icon-btn" data-extras-action="rotate" title="Girar 90°" aria-label="Girar 90°">
            🔄
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="background" title="Fundo" aria-label="Fundo">
            🎨
          </button>
          <button type="button" className="extras-icon-btn" data-extras-tool="adjust" title="Brilho e contraste" aria-label="Brilho e contraste">
            🌓
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Filtros</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="filters" title="Filtros" aria-label="Filtros">
            🎞️
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Molduras</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="frame" title="Molduras" aria-label="Molduras">
            🖼️
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Adesivos</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-extras-tool="stickers" title="Adesivos" aria-label="Adesivos">
            ⭐
          </button>
        </div>
      </div>
      <div className="extras-icon-category">
        <span className="extras-category-label">Mais</span>
        <div className="extras-icon-group">
          <button type="button" className="extras-icon-btn" data-dialog="signatureDialog" title="Escrita personalizada" aria-label="Escrita personalizada">
            ✒️
          </button>
        </div>
      </div>
    </div>
  );
}

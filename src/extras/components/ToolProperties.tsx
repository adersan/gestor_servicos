// Espelha #extrasToolProperties 1:1 - os 14 grupos de propriedade (um por
// ferramenta), cada um alternado via classList.toggle("hidden", ...) por
// extrasSyncToolOptionsVisibility() (app.js) - nenhum estado React aqui,
// so a marcacao estatica pra engine vanilla continuar controlando.
export function ToolProperties() {
  return (
    <div id="extrasToolProperties" className="extras-tool-properties panel">
      <h3 id="extrasToolPropertiesTitle" className="extras-tool-title">
        Seleção
      </h3>

      <p id="extrasSelectGroup" className="meta">
        Clique em um objeto na imagem para selecionar e usar suas propriedades. Duplo clique em um texto edita o conteúdo.
      </p>

      <label className="extras-range-label" id="extrasBrushSizeGroup">
        Tamanho do pincel
        <input type="range" id="extrasBrushSize" min={2} max={120} defaultValue={30} />
      </label>

      <div id="extrasTipShapeGroup" className="hidden">
        <span className="extras-subeyebrow">Tipo de ponta</span>
        <div className="extras-choice-options" id="extrasTipShapeOptions">
          <button type="button" data-extras-tip-shape="round" className="active">
            Redonda
          </button>
          <button type="button" data-extras-tip-shape="square">
            Quadrada
          </button>
        </div>
      </div>

      <label className="extras-range-label hidden" id="extrasOpacityGroup">
        Transparência do marcador
        <input type="range" id="extrasOpacity" min={10} max={100} defaultValue={60} />
      </label>

      <div id="extrasFillGroup" className="hidden">
        <span className="extras-subeyebrow">Preenchimento</span>
        <div className="extras-choice-options" id="extrasFillOptions">
          <button type="button" data-extras-fill="filled" className="active">
            Preenchido
          </button>
          <button type="button" data-extras-fill="outline">
            Contorno
          </button>
        </div>
      </div>

      <div id="extrasStrokeGroup" className="hidden">
        <span className="extras-subeyebrow">Cor da linha</span>
        <div className="extras-choice-options extras-color-options" id="extrasStrokeColorOptions">
          <button type="button" data-extras-stroke-color="#000000" className="active" style={{ background: "#000000" }} aria-label="Preto" />
          <button type="button" data-extras-stroke-color="#e5342b" style={{ background: "#e5342b" }} aria-label="Vermelho" />
          <button type="button" data-extras-stroke-color="#f2a20c" style={{ background: "#f2a20c" }} aria-label="Laranja" />
          <button type="button" data-extras-stroke-color="#2fae4e" style={{ background: "#2fae4e" }} aria-label="Verde" />
          <button type="button" data-extras-stroke-color="#2f7de1" style={{ background: "#2f7de1" }} aria-label="Azul" />
          <button type="button" data-extras-stroke-color="#ffffff" style={{ background: "#ffffff" }} aria-label="Branco" />
        </div>
        <div className="extras-inline-actions">
          <label className="extras-range-label" style={{ flex: "1 1 auto" }}>
            Outra cor
            <input type="color" id="extrasStrokeColorInput" defaultValue="#000000" />
          </label>
          <button type="button" className="extras-icon-btn" data-extras-action="pick-stroke-color" title="Conta-gotas (clonar cor)" aria-label="Conta-gotas">
            <svg viewBox="0 0 24 24"><path d="M14.5 5.5 18 2l3 3-3.5 3.5"/><path d="M14.5 5.5 5 15l-3 6 6-3L17.5 8.5"/></svg>
          </button>
        </div>
        <label className="extras-range-label">
          Espessura da linha
          <input type="range" id="extrasStrokeWidth" min={0} max={20} defaultValue={3} />
        </label>
      </div>

      <label className="extras-range-label hidden" id="extrasTextSizeGroup">
        Tamanho do texto
        <input type="range" id="extrasTextSize" min={12} max={96} defaultValue={28} />
      </label>

      <div id="extrasTextStyleGroup" className="hidden">
        <label className="extras-range-label">
          Fonte
          <select id="extrasFontFamily">
            <option value="Arial, sans-serif">Arial</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="'Segoe UI', sans-serif">Segoe UI</option>
            <option value="'Century Gothic', sans-serif">Century Gothic</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Garamond, serif">Garamond</option>
            <option value="'Palatino Linotype', serif">Palatino</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Impact, sans-serif">Impact</option>
            <option value="'Comic Sans MS', sans-serif">Comic Sans MS</option>
            <option value="'Brush Script MT', cursive">Brush Script</option>
          </select>
        </label>
        <div className="extras-choice-options" id="extrasTextStyleOptions">
          <button type="button" data-extras-text-style="bold" title="Negrito" aria-label="Negrito">
            <b>N</b>
          </button>
          <button type="button" data-extras-text-style="italic" title="Itálico" aria-label="Itálico">
            <i>I</i>
          </button>
          <button type="button" data-extras-text-style="underline" title="Sublinhado" aria-label="Sublinhado">
            <u>S</u>
          </button>
          <button type="button" data-extras-text-style="outline" title="Contorno" aria-label="Contorno">
            Contorno
          </button>
          <button type="button" data-extras-text-style="shadow" title="Sombra" aria-label="Sombra">
            Sombra
          </button>
        </div>
      </div>

      <div id="extrasColorGroup" className="hidden">
        <span className="extras-subeyebrow">Cor</span>
        <div className="extras-choice-options extras-color-options" id="extrasDrawColorOptions">
          <button type="button" data-extras-draw-color="#e5342b" className="active" style={{ background: "#e5342b" }} aria-label="Vermelho" />
          <button type="button" data-extras-draw-color="#f2a20c" style={{ background: "#f2a20c" }} aria-label="Laranja" />
          <button type="button" data-extras-draw-color="#f6e02f" style={{ background: "#f6e02f" }} aria-label="Amarelo" />
          <button type="button" data-extras-draw-color="#2fae4e" style={{ background: "#2fae4e" }} aria-label="Verde" />
          <button type="button" data-extras-draw-color="#2f7de1" style={{ background: "#2f7de1" }} aria-label="Azul" />
          <button type="button" data-extras-draw-color="#9b4fe0" style={{ background: "#9b4fe0" }} aria-label="Roxo" />
          <button type="button" data-extras-draw-color="#000000" style={{ background: "#000000" }} aria-label="Preto" />
          <button type="button" data-extras-draw-color="#ffffff" style={{ background: "#ffffff" }} aria-label="Branco" />
        </div>
        <div className="extras-inline-actions">
          <label className="extras-range-label" style={{ flex: "1 1 auto" }}>
            Outra cor
            <input type="color" id="extrasDrawColorInput" defaultValue="#e5342b" />
          </label>
          <button type="button" className="extras-icon-btn" data-extras-action="pick-draw-color" title="Conta-gotas (clonar cor)" aria-label="Conta-gotas">
            <svg viewBox="0 0 24 24"><path d="M14.5 5.5 18 2l3 3-3.5 3.5"/><path d="M14.5 5.5 5 15l-3 6 6-3L17.5 8.5"/></svg>
          </button>
        </div>
      </div>

      <div id="extrasCropGroup" className="hidden extras-inline-actions">
        <button type="button" className="primary" data-extras-action="crop-apply">
          Aplicar corte
        </button>
        <button type="button" className="secondary" data-extras-action="crop-cancel">
          Cancelar
        </button>
      </div>

      <div id="extrasBackgroundGroup" className="hidden">
        <span className="extras-subeyebrow">Cor de fundo</span>
        <div className="extras-choice-options extras-color-options" id="extrasBackgroundOptions">
          <button type="button" data-extras-bg="" className="active extras-bg-none" aria-label="Sem fundo" />
          <button type="button" data-extras-bg="#ffffff" style={{ background: "#ffffff" }} aria-label="Branco" />
          <button type="button" data-extras-bg="#000000" style={{ background: "#000000" }} aria-label="Preto" />
          <button type="button" data-extras-bg="#e7efeb" style={{ background: "#e7efeb" }} aria-label="Cinza claro" />
          <button type="button" data-extras-bg="#7a8892" style={{ background: "#7a8892" }} aria-label="Cinza escuro" />
          <button type="button" data-extras-bg="#2f7de1" style={{ background: "#2f7de1" }} aria-label="Azul" />
          <button type="button" data-extras-bg="#e5342b" style={{ background: "#e5342b" }} aria-label="Vermelho" />
          <button type="button" data-extras-bg="#2fae4e" style={{ background: "#2fae4e" }} aria-label="Verde" />
          <button type="button" data-extras-bg="#f2a20c" style={{ background: "#f2a20c" }} aria-label="Amarelo" />
        </div>
        <div className="extras-inline-actions">
          <label className="extras-range-label" style={{ flex: "1 1 auto" }}>
            Outra cor
            <input type="color" id="extrasBackgroundColorInput" defaultValue="#ffffff" />
          </label>
          <button type="button" className="extras-icon-btn" data-extras-action="pick-background-color" title="Conta-gotas (clonar cor)" aria-label="Conta-gotas">
            <svg viewBox="0 0 24 24"><path d="M14.5 5.5 18 2l3 3-3.5 3.5"/><path d="M14.5 5.5 5 15l-3 6 6-3L17.5 8.5"/></svg>
          </button>
        </div>
        <span className="extras-subeyebrow">Imagem de fundo</span>
        <div className="extras-inline-actions">
          <button type="button" className="secondary" data-extras-action="background-image-upload">
            Carregar imagem de fundo
          </button>
          <input type="file" id="extrasBackgroundImageInput" accept="image/png,image/jpeg,image/webp" hidden />
        </div>
        <div id="extrasBackgroundImagePreview" className="extras-background-image-preview hidden">
          <img id="extrasBackgroundImageThumb" alt="Imagem de fundo carregada" />
          <button type="button" className="table-action" data-extras-action="background-image-remove">
            Remover imagem de fundo
          </button>
        </div>
      </div>

      <div id="extrasAdjustGroup" className="hidden">
        <label className="extras-range-label">
          Brilho
          <input type="range" id="extrasBrightness" min={50} max={150} defaultValue={100} />
        </label>
        <label className="extras-range-label">
          Contraste
          <input type="range" id="extrasContrast" min={50} max={150} defaultValue={100} />
        </label>
        <label className="extras-range-label">
          Saturação
          <input type="range" id="extrasSaturate" min={0} max={200} defaultValue={100} />
        </label>
        <label className="extras-range-label">
          Matiz
          <input type="range" id="extrasHue" min={0} max={360} defaultValue={0} />
        </label>
        <label className="extras-range-label">
          Desfoque
          <input type="range" id="extrasBlur" min={0} max={20} defaultValue={0} />
        </label>
        <div className="extras-inline-actions">
          <button type="button" className="primary" data-extras-action="apply-adjust">
            Aplicar ajuste
          </button>
          <button type="button" className="secondary" data-extras-action="adjust-cancel">
            Cancelar
          </button>
        </div>
      </div>

      {/* Sem controle manual visivel - so guardam o valor que os presets de
          Filtros (abaixo) ajustam, reaproveitando o mesmo pipeline de
          extrasAdjustFilterString()/extrasApplyAdjust() do Ajuste manual. */}
      <input type="hidden" id="extrasGrayscale" defaultValue="0" />
      <input type="hidden" id="extrasSepia" defaultValue="0" />

      <div id="extrasFiltersGroup" className="hidden">
        <span className="extras-subeyebrow">Filtros com 1 clique</span>
        <div className="extras-choice-options" id="extrasFilterOptions">
          <button type="button" data-extras-filter="original" className="active">
            Original
          </button>
          <button type="button" data-extras-filter="bw">
            Preto e branco
          </button>
          <button type="button" data-extras-filter="vintage">
            Vintage
          </button>
          <button type="button" data-extras-filter="vivid">
            Vívido
          </button>
          <button type="button" data-extras-filter="warm">
            Quente
          </button>
          <button type="button" data-extras-filter="cool">
            Frio
          </button>
          <button type="button" data-extras-filter="soft">
            Suave
          </button>
        </div>
      </div>

      <div id="extrasFrameGroup" className="hidden">
        <span className="extras-subeyebrow">Estilo</span>
        <div className="extras-choice-options" id="extrasFrameStyleOptions">
          <button type="button" data-extras-frame-style="solid" className="active">
            Simples
          </button>
          <button type="button" data-extras-frame-style="shadow">
            Sombra
          </button>
        </div>
        <div id="extrasFrameColorGroup">
          <span className="extras-subeyebrow">Cor da moldura</span>
          <div className="extras-choice-options extras-color-options" id="extrasFrameColorOptions">
            <button type="button" data-extras-frame-color="#ffffff" className="active" style={{ background: "#ffffff" }} aria-label="Branco" />
            <button type="button" data-extras-frame-color="#000000" style={{ background: "#000000" }} aria-label="Preto" />
            <button type="button" data-extras-frame-color="#173f35" style={{ background: "#173f35" }} aria-label="Verde" />
            <button type="button" data-extras-frame-color="#d89b45" style={{ background: "#d89b45" }} aria-label="Dourado" />
            <button type="button" data-extras-frame-color="#a6483e" style={{ background: "#a6483e" }} aria-label="Vermelho" />
          </div>
          <label className="extras-range-label" style={{ flex: "1 1 auto" }}>
            Outra cor
            <input type="color" id="extrasFrameColorInput" defaultValue="#ffffff" />
          </label>
        </div>
        <label className="extras-range-label">
          Espessura da moldura
          <input type="range" id="extrasFrameWidth" min={4} max={60} defaultValue={20} />
        </label>
        <button type="button" className="primary" data-extras-action="apply-frame">
          Aplicar moldura
        </button>
      </div>

      <div id="extrasStickersGroup" className="hidden">
        <span className="extras-subeyebrow">Toque para adicionar ao centro da imagem</span>
        <div className="extras-choice-options" id="extrasStickerOptions">
          <button type="button" data-extras-sticker="arrow">
            <span aria-hidden="true">➜</span> Seta
          </button>
          <button type="button" data-extras-sticker="star">
            <span aria-hidden="true">★</span> Estrela
          </button>
          <button type="button" data-extras-sticker="heart">
            <span aria-hidden="true">♥</span> Coração
          </button>
          <button type="button" data-extras-sticker="check">
            <span aria-hidden="true">✔</span> Check
          </button>
          <button type="button" data-extras-sticker="banner">
            <span aria-hidden="true">🎗️</span> Faixa
          </button>
          <button type="button" data-extras-sticker="speech">
            <span aria-hidden="true">💬</span> Balão
          </button>
        </div>
      </div>

      <div id="extrasZoomGroup" className="hidden extras-inline-actions">
        <button type="button" className="extras-icon-btn" id="extrasZoomPanToggle" data-extras-action="zoom-pan-toggle" title="Mão (arrastar para navegar)" aria-label="Mão">
          <svg viewBox="0 0 24 24"><path d="M12 3v7M12 21v-7M3 12h7M21 12h-7"/><path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M3 12l2-2M3 12l2 2M21 12l-2-2M21 12l-2 2"/></svg>
        </button>
        <button type="button" className="extras-icon-btn" data-extras-action="zoom-out" title="Diminuir zoom" aria-label="Diminuir zoom">
          −
        </button>
        <span id="extrasZoomLabel">100%</span>
        <button type="button" className="extras-icon-btn" data-extras-action="zoom-in" title="Aumentar zoom" aria-label="Aumentar zoom">
          +
        </button>
        <button type="button" className="table-action" data-extras-action="zoom-reset">
          Ajustar zoom
        </button>
      </div>
    </div>
  );
}

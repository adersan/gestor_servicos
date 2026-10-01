import { useEffect, useRef } from "react";

// Fase 19c: adota (move, nao recria) o no vanilla #extrasCanvasWrap - os dois
// <canvas> do Fabric, cursor do pincel, preview de forma e overlay/handles de
// recorte. Mover em vez de recriar preserva a instancia fabric.Canvas ja
// inicializada em initializeExtrasFabricLayer() no boot (dispose()/recriacao
// do Fabric 6.6.0 e assincrono - ver plano, decisao de usar a Opcao B
// justamente pra nao precisar disso).
//
// Este componente e um FOLHA deliberada na arvore React: nunca declara
// filhos via JSX, entao o React jamais tenta reconciliar o conteudo desta
// div - a unica coisa que move o no pra dentro/fora dela e o efeito abaixo,
// sem risco de o React "brigar" com essa mutacao manual num re-render futuro.
//
// grid-area:canvas aplicado AQUI (no slot, nao no no adotado) porque
// .extras-editor usa CSS Grid com areas nomeadas (ver styles.css) - exige
// que o item fique filho DIRETO do grid container. O no real adotado
// (.extras-canvas-wrap, com seu proprio grid-area:canvas) fica um nivel mais
// fundo, dentro deste slot - a regra dele vira inerte (sem efeito, inofensiva)
// mas o slot em si ocupa a area certa, entao o layout final bate com o
// vanilla.
export function CanvasIsland() {
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const slot = slotRef.current;
    const island = document.getElementById("extrasCanvasWrap");
    if (!slot || !island) return;
    if (island.parentElement !== slot) slot.appendChild(island);
  }, []);

  return <div ref={slotRef} style={{ gridArea: "canvas", minWidth: 0 }} />;
}

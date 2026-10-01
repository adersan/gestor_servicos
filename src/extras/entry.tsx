import { createRoot } from "react-dom/client";

import { Extras } from "@/extras/Extras";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-extras" esta ligada (opt-in via ?newExtras=1 ate a
// Fase 19c estar pronta - ver plano em .claude/plans). Ver Fase 19b.
window.mountReactExtras = (root: HTMLElement) => {
  createRoot(root).render(<Extras />);
};

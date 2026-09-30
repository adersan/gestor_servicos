import { createRoot } from "react-dom/client";

import { Help } from "@/help/Help";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-help" esta ligada. Ver Fase 18.
window.mountReactHelp = (root: HTMLElement) => {
  createRoot(root).render(<Help />);
};

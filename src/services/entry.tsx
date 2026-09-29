import { createRoot } from "react-dom/client";

import { Services } from "@/services/Services";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-services" esta ligada. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md, Fase 7.
window.mountReactServices = (root: HTMLElement) => {
  createRoot(root).render(<Services />);
};

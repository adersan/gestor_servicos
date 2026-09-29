import { createRoot } from "react-dom/client";

import { Catalog } from "@/catalog/Catalog";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-catalog" esta ligada. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md, Fase 6.
window.mountReactCatalog = (root: HTMLElement) => {
  createRoot(root).render(<Catalog />);
};

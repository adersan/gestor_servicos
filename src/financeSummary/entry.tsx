import { createRoot } from "react-dom/client";

import { FinanceSummary } from "@/financeSummary/FinanceSummary";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-financeSummary" esta ligada. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md.
window.mountReactFinanceSummary = (root: HTMLElement) => {
  createRoot(root).render(<FinanceSummary />);
};

import { createRoot } from "react-dom/client";

import { Billing } from "@/billing/Billing";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-billing" esta ligada. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md.
window.mountReactBilling = (root: HTMLElement) => {
  createRoot(root).render(<Billing />);
};

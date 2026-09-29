import { createRoot } from "react-dom/client";

import { Payments } from "@/payments/Payments";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-payments" esta ligada. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md.
window.mountReactPayments = (root: HTMLElement) => {
  createRoot(root).render(<Payments />);
};

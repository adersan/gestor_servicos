import { createRoot } from "react-dom/client";

import { Dashboard } from "@/dashboard/Dashboard";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-dashboard" esta ligada. Nunca roda no caminho vanilla
// padrao - ver plano em .claude/plans/breezy-coalescing-sonnet.md.
window.mountReactDashboard = (root: HTMLElement) => {
  createRoot(root).render(<Dashboard />);
};

import { createRoot } from "react-dom/client";

import { Reports } from "@/reports/Reports";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-reports" esta ligada. Ver Fase 16.
window.mountReactReports = (root: HTMLElement) => {
  createRoot(root).render(<Reports />);
};

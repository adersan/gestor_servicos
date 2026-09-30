import { createRoot } from "react-dom/client";

import { SupplierDashboard } from "@/supplierDashboard/SupplierDashboard";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierDashboard" esta ligada. Ver Fase 14.
window.mountReactSupplierDashboard = (root: HTMLElement) => {
  createRoot(root).render(<SupplierDashboard />);
};

import { createRoot } from "react-dom/client";

import { SupplierAccess } from "@/supplierAccess/SupplierAccess";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierAccess" esta ligada. Ver Fase 11.
window.mountReactSupplierAccess = (root: HTMLElement) => {
  createRoot(root).render(<SupplierAccess />);
};

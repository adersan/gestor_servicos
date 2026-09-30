import { createRoot } from "react-dom/client";

import { SupplierPayables } from "@/supplierPayables/SupplierPayables";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierPayables" esta ligada. Ver Fase 12.
window.mountReactSupplierPayables = (root: HTMLElement) => {
  createRoot(root).render(<SupplierPayables />);
};

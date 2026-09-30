import { createRoot } from "react-dom/client";

import { SupplierEntries } from "@/supplierEntries/SupplierEntries";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierEntries" esta ligada. Ver Fase 10.
window.mountReactSupplierEntries = (root: HTMLElement) => {
  createRoot(root).render(<SupplierEntries />);
};

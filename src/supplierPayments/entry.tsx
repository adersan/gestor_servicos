import { createRoot } from "react-dom/client";

import { SupplierPayments } from "@/supplierPayments/SupplierPayments";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierPayments" esta ligada. Ver Fase 13.
window.mountReactSupplierPayments = (root: HTMLElement) => {
  createRoot(root).render(<SupplierPayments />);
};

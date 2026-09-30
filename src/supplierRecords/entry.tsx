import { createRoot } from "react-dom/client";

import { SupplierRecords } from "@/supplierRecords/SupplierRecords";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-supplierRecords" esta ligada. Ver Fase 9.
window.mountReactSupplierRecords = (root: HTMLElement) => {
  createRoot(root).render(<SupplierRecords />);
};

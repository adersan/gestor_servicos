import { createRoot } from "react-dom/client";

import { PaymentMethods } from "@/paymentMethods/PaymentMethods";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-paymentMethods" esta ligada. Ver Fase 15.
window.mountReactPaymentMethods = (root: HTMLElement) => {
  createRoot(root).render(<PaymentMethods />);
};

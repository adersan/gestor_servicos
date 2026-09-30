import { createRoot } from "react-dom/client";

import { Requests } from "@/requests/Requests";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-requests" esta ligada. Ver Fase 8.
window.mountReactRequests = (root: HTMLElement) => {
  createRoot(root).render(<Requests />);
};

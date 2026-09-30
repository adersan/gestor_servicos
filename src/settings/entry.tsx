import { createRoot } from "react-dom/client";

import { Settings } from "@/settings/Settings";
import "@/index.css";

// Chamado pelo script inline no fim do index.html, so quando a flag
// "gestor-servicos-react-settings" esta ligada. Ver Fase 17.
window.mountReactSettings = (root: HTMLElement) => {
  createRoot(root).render(<Settings />);
};

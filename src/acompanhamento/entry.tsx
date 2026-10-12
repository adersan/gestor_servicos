import { createRoot } from "react-dom/client";

import { Acompanhamento } from "@/acompanhamento/Acompanhamento";
import "@/index.css";

// Chamado pelo script inline no fim do acompanhamento.html, so quando a flag
// "gestor-servicos-react-acompanhamento" esta ligada.
window.mountReactAcompanhamento = (root: HTMLElement) => {
  createRoot(root).render(<Acompanhamento />);
};

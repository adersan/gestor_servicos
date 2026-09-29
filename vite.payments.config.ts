import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.config.ts (bundle da tela de Pagamentos) - config separado
// porque Rollup nao suporta multiplas entradas num build iife/UMD ("code
// splitting" nao e permitido nesses formatos). emptyOutDir:false e proposital:
// a pasta "react/" e compartilhada com o bundle do Dashboard (vite.config.ts
// roda primeiro e limpa a pasta; este roda depois e so adiciona os arquivos
// dele, sem apagar o que ja foi gerado).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: ".",
  define: {
    "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development")
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "react",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: "src/payments/entry.tsx",
      name: "GestorReactPayments",
      formats: ["iife"],
      fileName: () => "payments.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "payments.[ext]"
      }
    }
  }
}));

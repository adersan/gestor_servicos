import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.help.config.ts - mesmo motivo de config separado e mesmo
// emptyOutDir:false. Primeira fase da migracao React dos portais publicos
// (fora do index.html do admin) - ver plano em .claude/plans.
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
      entry: "src/acompanhamento/entry.tsx",
      name: "GestorReactAcompanhamento",
      formats: ["iife"],
      fileName: () => "acompanhamento.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "acompanhamento.[ext]"
      }
    }
  }
}));

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.requests.config.ts - mesmo motivo de config separado e mesmo
// emptyOutDir:false.
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
      entry: "src/supplierRecords/entry.tsx",
      name: "GestorReactSupplierRecords",
      formats: ["iife"],
      fileName: () => "supplierRecords.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "supplierRecords.[ext]"
      }
    }
  }
}));

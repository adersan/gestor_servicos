import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Espelha vite.supplierDashboard.config.ts - mesmo motivo de config separado e
// mesmo emptyOutDir:false.
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
      entry: "src/paymentMethods/entry.tsx",
      name: "GestorReactPaymentMethods",
      formats: ["iife"],
      fileName: () => "paymentMethods.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "paymentMethods.[ext]"
      }
    }
  }
}));

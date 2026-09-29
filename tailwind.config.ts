import type { Config } from "tailwindcss";

// Preflight desligado e "important" escopado na classe .rd-root (presente em
// TODA raiz de montagem React - #rdDashboardRoot, #rdPaymentsRoot etc.): o
// Tailwind nunca reseta elementos fora dessas raizes, e nenhum utilitario
// gerado consegue casar com nada fora delas - convive com o reset proprio do
// styles.css vanilla sem colidir. Uma classe compartilhada (em vez de um id
// fixo) permite que cada tela nova migrada reaproveite o mesmo config sem
// precisar trocar essa string a cada fase (ver plano em .claude/plans, Fase 2).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  important: ".rd-root",
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        muted: "var(--muted)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        "brand-soft": "var(--brand-soft)",
        accent: "var(--accent)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        danger: "var(--danger)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)"
        },
        border: "var(--border)",
        destructive: "var(--destructive)"
      }
    }
  },
  plugins: []
};

export default config;

import type { Config } from "tailwindcss";

// Preflight desligado e "important" escopado em #rdDashboardRoot: o Tailwind
// nunca reseta elementos fora da raiz de montagem do React, e nenhum utilitario
// gerado consegue casar com nada fora dela - convive com o reset proprio do
// styles.css vanilla sem colidir (ver plano em .claude/plans, secao Fase 0).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  important: "#rdDashboardRoot",
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

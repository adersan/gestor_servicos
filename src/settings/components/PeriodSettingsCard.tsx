import { useState } from "react";

import { SettingsCard } from "@/settings/components/SettingsCard";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// Nao reaproveita os ids do vanilla (periodMode/weekStartDay/weekEndDay) -
// estado local proprio, gravado a cada mudanca via
// window.updatePeriodMode/updateWeekDays (extraidos dos listeners diretos
// que so existiam antes, ver Fase 17). A copia vanilla (escondida) continua
// reagindo aos proprios listeners, sem conflito de id.
export function PeriodSettingsCard() {
  const initial = window.getSystemSettings();
  const [periodMode, setPeriodMode] = useState<"week" | "month">(initial.periodMode);
  const [weekStartDay, setWeekStartDay] = useState(initial.weekStartDay);
  const [weekEndDay, setWeekEndDay] = useState(initial.weekEndDay);

  const handlePeriodMode = (mode: "week" | "month") => {
    setPeriodMode(mode);
    window.updatePeriodMode(mode);
  };
  const handleWeekDays = (startDay: number, endDay: number) => {
    setWeekStartDay(startDay);
    setWeekEndDay(endDay);
    window.updateWeekDays(startDay, endDay);
  };

  return (
    <SettingsCard eyebrow="Semana operacional" title="Período padrão" description="Escolha o início e o fim da semana usada nos filtros e fechamentos operacionais.">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Tipo de período
        <select
          value={periodMode}
          onChange={(event) => handlePeriodMode(event.target.value as "week" | "month")}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
        >
          <option value="week">Semanal</option>
          <option value="month">Mensal</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          Começa em
          <select
            value={weekStartDay}
            disabled={periodMode === "month"}
            onChange={(event) => handleWeekDays(Number(event.target.value), weekEndDay)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            {WEEKDAYS.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          Termina em
          <select
            value={weekEndDay}
            disabled={periodMode === "month"}
            onChange={(event) => handleWeekDays(weekStartDay, Number(event.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            {WEEKDAYS.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </SettingsCard>
  );
}

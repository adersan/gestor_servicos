import { useState } from "react";

import { SettingsCard } from "@/settings/components/SettingsCard";

export function ToggleSettingsCard({
  eyebrow,
  title,
  description,
  checkboxLabel,
  initialChecked,
  onToggle
}: {
  eyebrow: string;
  title: string;
  description: string;
  checkboxLabel: string;
  initialChecked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(initialChecked);

  return (
    <SettingsCard eyebrow={eyebrow} title={title} description={description}>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
            onToggle(event.target.checked);
          }}
        />
        {checkboxLabel}
      </label>
    </SettingsCard>
  );
}

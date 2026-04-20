"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { STYLE_OPTIONS, SaveStatus, type SectionStatus } from "../settings-shared";

export function WriterStyleSection({
  styleName,
  currentStyle,
  isSaving,
  status,
  onSave,
}: {
  styleName: string;
  currentStyle: typeof STYLE_OPTIONS[number] | undefined;
  isSaving: boolean;
  status: SectionStatus;
  onSave: (styleName: string) => void;
}) {
  const [localStyle, setLocalStyle] = React.useState(styleName);

  React.useEffect(() => {
    setLocalStyle(styleName);
  }, [styleName]);

  const selected = STYLE_OPTIONS.find((s) => s.value === localStyle);

  return (
    <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Icon name="palette" size={16} /> 写作风格
      </h3>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">选择写手</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localStyle}
          onChange={(e) => setLocalStyle(e.target.value)}
          data-testid="settings-style-select"
        >
          <option value="">— 请选择 —</option>
          {STYLE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground leading-relaxed">{selected.desc}</p>
      )}
      {!selected && currentStyle && (
        <p className="text-xs text-muted-foreground leading-relaxed">{currentStyle.desc}</p>
      )}
      <SaveStatus success={status.success} error={status.error} />
      <Button size="sm" onClick={() => onSave(localStyle)} disabled={isSaving} className="w-full">
        保存
      </Button>
    </section>
  );
}

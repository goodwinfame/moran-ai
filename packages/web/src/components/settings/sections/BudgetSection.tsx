"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { SaveStatus, type SectionStatus } from "../settings-shared";

export function BudgetSection({
  budgetLimitUsd,
  budgetBehavior,
  isSaving,
  status,
  onSave,
}: {
  budgetLimitUsd: number | undefined;
  budgetBehavior: "pause" | "warn" | undefined;
  isSaving: boolean;
  status: SectionStatus;
  onSave: (limitUsd: number | undefined, behavior: "pause" | "warn" | undefined) => void;
}) {
  const [localLimit, setLocalLimit] = React.useState(
    budgetLimitUsd !== undefined ? String(budgetLimitUsd) : "",
  );
  const [localBehavior, setLocalBehavior] = React.useState<"pause" | "warn" | "">(
    budgetBehavior ?? "",
  );
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalLimit(budgetLimitUsd !== undefined ? String(budgetLimitUsd) : "");
    setLocalBehavior(budgetBehavior ?? "");
  }, [budgetLimitUsd, budgetBehavior]);

  function handleSave() {
    const limitNum = localLimit !== "" ? Number(localLimit) : undefined;
    if (limitNum !== undefined && (isNaN(limitNum) || limitNum < 0)) {
      setValidationError("预算上限必须 >= 0");
      return;
    }
    setValidationError(null);
    onSave(limitNum, localBehavior || undefined);
  }

  return (
    <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Icon name="payments" size={16} /> 成本预算
      </h3>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">已消耗</span>
        <span className="font-mono font-medium text-primary">—</span>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">预算上限 (USD)</label>
        <input
          type="number"
          min={0}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localLimit}
          onChange={(e) => setLocalLimit(e.target.value)}
          data-testid="settings-budget-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">超限行为</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localBehavior}
          onChange={(e) => setLocalBehavior(e.target.value as "pause" | "warn" | "")}
          data-testid="settings-budget-behavior-select"
        >
          <option value="">— 请选择 —</option>
          <option value="pause">暂停工作并提醒</option>
          <option value="warn">仅提醒，继续工作</option>
        </select>
      </div>
      {validationError && (
        <p className="text-xs text-destructive" role="alert">{validationError}</p>
      )}
      <SaveStatus success={status.success} error={status.error} />
      <Button size="sm" onClick={handleSave} disabled={isSaving} className="w-full">
        保存
      </Button>
    </section>
  );
}

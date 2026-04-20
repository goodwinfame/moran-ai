"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { SaveStatus, type SectionStatus } from "../settings-shared";

export function WritingParamsSection({
  chapterWordCount,
  reviewThreshold,
  isSaving,
  status,
  onSave,
}: {
  chapterWordCount: number | undefined;
  reviewThreshold: number | undefined;
  isSaving: boolean;
  status: SectionStatus;
  onSave: (wordCount: number | undefined, threshold: number | undefined) => void;
}) {
  const [localWordCount, setLocalWordCount] = React.useState(
    chapterWordCount !== undefined ? String(chapterWordCount) : "",
  );
  const [localThreshold, setLocalThreshold] = React.useState(
    reviewThreshold !== undefined ? String(reviewThreshold) : "",
  );
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalWordCount(chapterWordCount !== undefined ? String(chapterWordCount) : "");
    setLocalThreshold(reviewThreshold !== undefined ? String(reviewThreshold) : "");
  }, [chapterWordCount, reviewThreshold]);

  function handleSave() {
    const wc = localWordCount !== "" ? Number(localWordCount) : undefined;
    const rt = localThreshold !== "" ? Number(localThreshold) : undefined;
    if (wc !== undefined && (isNaN(wc) || wc <= 0)) {
      setValidationError("单章字数必须 > 0");
      return;
    }
    setValidationError(null);
    onSave(wc, rt);
  }

  return (
    <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Icon name="tune" size={16} /> 写作参数
      </h3>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">单章目标字数</label>
        <input
          type="number"
          min={1}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localWordCount}
          onChange={(e) => setLocalWordCount(e.target.value)}
          data-testid="settings-word-count-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">审校及格阈值</label>
        <input
          type="number"
          min={0}
          max={100}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localThreshold}
          onChange={(e) => setLocalThreshold(e.target.value)}
          data-testid="settings-threshold-input"
        />
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

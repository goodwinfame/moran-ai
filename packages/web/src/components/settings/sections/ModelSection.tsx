"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { MODEL_OPTIONS, SaveStatus, type SectionStatus } from "../settings-shared";

export function ModelSection({
  writerModel,
  reviewerModel,
  isSaving,
  status,
  onSave,
}: {
  writerModel: string;
  reviewerModel: string;
  isSaving: boolean;
  status: SectionStatus;
  onSave: (writerModel: string, reviewerModel: string) => void;
}) {
  const [localWriterModel, setLocalWriterModel] = React.useState(writerModel);
  const [localReviewerModel, setLocalReviewerModel] = React.useState(reviewerModel);

  React.useEffect(() => {
    setLocalWriterModel(writerModel);
    setLocalReviewerModel(reviewerModel);
  }, [writerModel, reviewerModel]);

  return (
    <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Icon name="memory" size={16} /> 模型配置
      </h3>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">写作模型</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localWriterModel}
          onChange={(e) => setLocalWriterModel(e.target.value)}
          data-testid="settings-writer-model-select"
        >
          <option value="">— 使用默认 —</option>
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">审校模型</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localReviewerModel}
          onChange={(e) => setLocalReviewerModel(e.target.value)}
          data-testid="settings-reviewer-model-select"
        >
          <option value="">— 使用默认 —</option>
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <SaveStatus success={status.success} error={status.error} />
      <Button size="sm" onClick={() => onSave(localWriterModel, localReviewerModel)} disabled={isSaving} className="w-full">
        保存
      </Button>
    </section>
  );
}

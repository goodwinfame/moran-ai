"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { SaveStatus, type SectionStatus } from "../settings-shared";

export function BasicInfoSection({
  title,
  genre,
  subGenre,
  createdAt,
  isSaving,
  status,
  onSave,
}: {
  title: string;
  genre: string | null;
  subGenre: string | null;
  createdAt: string | null;
  isSaving: boolean;
  status: SectionStatus;
  onSave: (patch: { title?: string; genre?: string; subGenre?: string }) => void;
}) {
  const [localTitle, setLocalTitle] = React.useState(title);
  const [localGenre, setLocalGenre] = React.useState(genre ?? "");
  const [localSubGenre, setLocalSubGenre] = React.useState(subGenre ?? "");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalTitle(title);
    setLocalGenre(genre ?? "");
    setLocalSubGenre(subGenre ?? "");
  }, [title, genre, subGenre]);

  function handleSave() {
    if (!localTitle.trim()) {
      setValidationError("项目名称不能为空");
      return;
    }
    setValidationError(null);
    onSave({
      title: localTitle.trim(),
      genre: localGenre || undefined,
      subGenre: localSubGenre || undefined,
    });
  }

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : "—";

  return (
    <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
      <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
        <Icon name="info" size={16} /> 基本信息
      </h3>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">项目名称</label>
        <input
          type="text"
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          data-testid="settings-title-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">题材</label>
        <input
          type="text"
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localGenre}
          onChange={(e) => setLocalGenre(e.target.value)}
          data-testid="settings-genre-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">子题材</label>
        <input
          type="text"
          className="w-full border rounded px-2 py-1 text-sm bg-background"
          value={localSubGenre}
          onChange={(e) => setLocalSubGenre(e.target.value)}
          data-testid="settings-subgenre-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">创建时间</label>
        <input
          type="text"
          className="w-full border rounded px-2 py-1 text-sm bg-muted cursor-not-allowed"
          readOnly
          value={formattedDate}
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

"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { value: "云墨", label: "执笔·云墨", desc: "均衡万用、自然流畅" },
  { value: "剑心", label: "执笔·剑心", desc: "冷峻简约、短句、白描、动作化叙事" },
  { value: "星河", label: "执笔·星河", desc: "精确、技术感、理性叙述" },
  { value: "素手", label: "执笔·素手", desc: "温暖细腻、长句、情感细写、氛围渲染" },
  { value: "烟火", label: "执笔·烟火", desc: "市井烟火气、口语化、快节奏" },
  { value: "暗棋", label: "执笔·暗棋", desc: "层层递进、信息控制、悬念留白" },
  { value: "青史", label: "执笔·青史", desc: "典雅庄重、文白混用、时代语感" },
  { value: "夜阑", label: "执笔·夜阑", desc: "压抑、感官描写密集、心理暗示" },
  { value: "谐星", label: "执笔·谐星", desc: "轻快、节奏明快、反差幽默" },
];

const MODEL_OPTIONS = [
  "claude-sonnet-4",
  "kimi-k2",
  "gpt-4o",
  "claude-opus",
  "gemma4",
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProjectSettingsDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onProjectDeleted?: () => void;
}

// ── Inline status message ──────────────────────────────────────────────────────

function SaveStatus({ success, error }: { success: boolean; error: string | null }) {
  if (error) {
    return <p className="text-xs text-destructive mt-1" role="alert">{error}</p>;
  }
  if (success) {
    return <p className="text-xs text-green-600 mt-1" role="status">已保存</p>;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectSettingsDrawer({
  projectId,
  open,
  onClose,
  onProjectDeleted,
}: ProjectSettingsDrawerProps) {
  const {
    basicInfo,
    settings,
    isLoading,
    isSaving,
    loadSettings,
    updateSettings,
    reset,
  } = useSettingsStore();

  // Section-level save status
  const [sectionStatus, setSectionStatus] = React.useState<
    Record<string, { success: boolean; error: string | null }>
  >({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Load on open
  React.useEffect(() => {
    if (open) {
      void loadSettings(projectId);
    } else {
      reset();
      setSectionStatus({});
    }
  }, [open, projectId, loadSettings, reset]);

  // Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    if (open) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  async function save(section: string, patch: Parameters<typeof updateSettings>[1]) {
    setSectionStatus((prev) => ({ ...prev, [section]: { success: false, error: null } }));
    const ok = await updateSettings(projectId, patch);
    setSectionStatus((prev) => ({
      ...prev,
      [section]: { success: ok, error: ok ? null : useSettingsStore.getState().error },
    }));
  }

  async function handleDelete() {
    try {
      interface ApiRes { ok: boolean; error?: { message?: string } }
      const res = await api.delete<ApiRes>(`/api/projects/${projectId}`);
      if (res.ok) {
        onClose();
        onProjectDeleted?.();
      } else {
        setSectionStatus((prev) => ({
          ...prev,
          danger: { success: false, error: res.error?.message ?? "删除失败" },
        }));
      }
    } catch {
      setSectionStatus((prev) => ({
        ...prev,
        danger: { success: false, error: "网络错误" },
      }));
    }
  }

  async function handleArchive() {
    const ok = await updateSettings(projectId, { status: "completed" });
    setSectionStatus((prev) => ({
      ...prev,
      danger: { success: ok, error: ok ? null : useSettingsStore.getState().error },
    }));
    if (ok) {
      onClose();
    }
  }

  if (!open) return null;

  const writerStyleName = settings.writerStyle?.styleName ?? "";
  const currentStyle = STYLE_OPTIONS.find((s) => s.value === writerStyleName);
  const writerModel = settings.writerStyle?.model ?? "";
  const reviewerModel = settings.modelOverrides?.["mingjing"] ?? "";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 animate-in fade-in duration-300"
        onClick={onClose}
        data-testid="settings-backdrop"
      />
      <div
        className="fixed top-0 right-0 bottom-0 w-[400px] bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300 animate-in slide-in-from-right"
        data-testid="settings-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Icon name="settings" size={24} filled />
            项目设置
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <Icon name="close" size={20} filled />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2" data-testid="settings-loading">
              <Icon name="progress_activity" size={20} />
              加载中…
            </div>
          ) : (
            <>
              {/* 基本信息 */}
              <BasicInfoSection
                title={basicInfo.title}
                genre={basicInfo.genre}
                subGenre={basicInfo.subGenre}
                createdAt={basicInfo.createdAt}
                isSaving={isSaving}
                status={sectionStatus["basic"] ?? { success: false, error: null }}
                onSave={(patch) => save("basic", patch)}
              />

              {/* 写作风格 */}
              <WriterStyleSection
                styleName={writerStyleName}
                currentStyle={currentStyle}
                isSaving={isSaving}
                status={sectionStatus["style"] ?? { success: false, error: null }}
                onSave={(styleName) =>
                  save("style", { settings: { writerStyle: { ...settings.writerStyle, styleName } } })
                }
              />

              {/* 模型配置 */}
              <ModelSection
                writerModel={writerModel}
                reviewerModel={reviewerModel}
                isSaving={isSaving}
                status={sectionStatus["model"] ?? { success: false, error: null }}
                onSave={(wm, rm) =>
                  save("model", {
                    settings: {
                      writerStyle: { ...settings.writerStyle, styleName: writerStyleName || "云墨", model: wm || undefined },
                      modelOverrides: { ...settings.modelOverrides, ...(rm ? { mingjing: rm } : {}) },
                    },
                  })
                }
              />

              {/* 成本预算 */}
              <BudgetSection
                budgetLimitUsd={settings.budgetLimitUsd}
                budgetBehavior={settings.budgetBehavior}
                isSaving={isSaving}
                status={sectionStatus["budget"] ?? { success: false, error: null }}
                onSave={(limitUsd, behavior) =>
                  save("budget", {
                    settings: {
                      budgetLimitUsd: limitUsd,
                      budgetBehavior: behavior,
                    },
                  })
                }
              />

              {/* 写作参数 */}
              <WritingParamsSection
                chapterWordCount={settings.writingParams?.chapterWordCount}
                reviewThreshold={settings.writingParams?.reviewThreshold}
                isSaving={isSaving}
                status={sectionStatus["params"] ?? { success: false, error: null }}
                onSave={(wordCount, threshold) =>
                  save("params", {
                    settings: {
                      writingParams: {
                        ...settings.writingParams,
                        chapterWordCount: wordCount,
                        reviewThreshold: threshold,
                      },
                    },
                  })
                }
              />

              {/* 危险操作 */}
              <section className="space-y-4 bg-red-50/50 rounded-xl border border-red-100 p-4 shadow-sm">
                <h3 className="font-medium text-sm text-red-600 border-b border-red-100 pb-2 flex items-center gap-2">
                  <Icon name="warning" size={16} /> 危险操作
                </h3>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-between hover:bg-yellow-50 hover:text-yellow-600 border-yellow-200"
                    onClick={handleArchive}
                    disabled={isSaving}
                  >
                    归档项目 <Icon name="archive" size={18} />
                  </Button>
                  <p className="text-xs text-muted-foreground">归档后项目变为只读状态，可随时恢复。</p>
                </div>
                <div className="space-y-3">
                  <Button
                    variant="destructive"
                    className="w-full justify-between"
                    onClick={() => setDeleteOpen(true)}
                    data-testid="delete-project-btn"
                  >
                    删除项目 <Icon name="delete_forever" size={18} />
                  </Button>
                  <p className="text-xs text-red-500/70">删除操作不可逆，将永久丢失所有数据！</p>
                </div>
                <SaveStatus
                  success={sectionStatus["danger"]?.success ?? false}
                  error={sectionStatus["danger"]?.error ?? null}
                />
              </section>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除项目"
        description="此操作不可逆，将永久丢失所有数据。确认删除此项目吗？"
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Sub-sections ───────────────────────────────────────────────────────────────

interface SectionStatus {
  success: boolean;
  error: string | null;
}

function BasicInfoSection({
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

function WriterStyleSection({
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

function ModelSection({
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

function BudgetSection({
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

function WritingParamsSection({
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

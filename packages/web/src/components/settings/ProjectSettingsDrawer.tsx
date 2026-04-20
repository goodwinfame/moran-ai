"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/lib/api";
import { STYLE_OPTIONS, SaveStatus } from "./settings-shared";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { WriterStyleSection } from "./sections/WriterStyleSection";
import { ModelSection } from "./sections/ModelSection";
import { BudgetSection } from "./sections/BudgetSection";
import { WritingParamsSection } from "./sections/WritingParamsSection";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProjectSettingsDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onProjectDeleted?: () => void;
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

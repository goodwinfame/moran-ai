"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Save,
  Trash2,
  BookOpen,
  FileText,
  Loader2,
  ChevronRight,
  ListTree,
  Pencil,
} from "lucide-react";
import { useOutline, type ArcData } from "@/hooks/use-outline";

interface OutlineEditorProps {
  projectId: string | null;
}

/**
 * M3.7-D: Outline editor — synopsis + arc-chapter tree view.
 */
export function OutlineEditor({ projectId }: OutlineEditorProps) {
  const {
    outline,
    arcs,
    loading,
    updateOutline,
    createArc,
    updateArc,
    deleteArc,
  } = useOutline(projectId);

  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [synopsisText, setSynopsisText] = useState("");
  const [themesText, setThemesText] = useState("");

  const [selectedArcIdx, setSelectedArcIdx] = useState<number | null>(null);
  const [editingArc, setEditingArc] = useState(false);
  const [creatingArc, setCreatingArc] = useState(false);
  const [saving, setSaving] = useState(false);

  const [arcForm, setArcForm] = useState({
    title: "",
    description: "",
    startChapter: 0,
    endChapter: 0,
    detailedPlan: "",
  });

  const selectedArc = arcs.find((a) => a.arcIndex === selectedArcIdx) ?? null;

  // ── Synopsis editing ──────────────────────────

  const startEditSynopsis = () => {
    if (!outline) return;
    setSynopsisText(outline.synopsis);
    setThemesText(outline.themes.join("\n"));
    setEditingSynopsis(true);
  };

  const saveSynopsis = async () => {
    setSaving(true);
    await updateOutline({
      synopsis: synopsisText,
      themes: themesText.split("\n").filter((t) => t.trim()),
    });
    setEditingSynopsis(false);
    setSaving(false);
  };

  // ── Arc management ────────────────────────────

  const handleSelectArc = (arc: ArcData) => {
    setSelectedArcIdx(arc.arcIndex);
    setEditingArc(false);
    setCreatingArc(false);
  };

  const startEditArc = () => {
    if (!selectedArc) return;
    setArcForm({
      title: selectedArc.title,
      description: selectedArc.description,
      startChapter: selectedArc.startChapter,
      endChapter: selectedArc.endChapter,
      detailedPlan: selectedArc.detailedPlan,
    });
    setEditingArc(true);
  };

  const saveArc = async () => {
    if (!selectedArc) return;
    setSaving(true);
    await updateArc(selectedArc.arcIndex, {
      title: arcForm.title,
      description: arcForm.description,
      startChapter: arcForm.startChapter,
      endChapter: arcForm.endChapter,
      detailedPlan: arcForm.detailedPlan,
    });
    setEditingArc(false);
    setSaving(false);
  };

  const handleCreateArc = async () => {
    if (!arcForm.title.trim()) return;
    setSaving(true);
    const result = await createArc({
      title: arcForm.title.trim(),
      description: arcForm.description,
      startChapter: arcForm.startChapter,
      endChapter: arcForm.endChapter,
      detailedPlan: arcForm.detailedPlan,
    });
    if (result) {
      setSelectedArcIdx(result.arcIndex);
      setCreatingArc(false);
      resetArcForm();
    }
    setSaving(false);
  };

  const handleDeleteArc = async (arcIndex: number) => {
    await deleteArc(arcIndex);
    if (selectedArcIdx === arcIndex) {
      setSelectedArcIdx(null);
      setEditingArc(false);
    }
  };

  const startCreatingArc = () => {
    resetArcForm();
    setCreatingArc(true);
    setSelectedArcIdx(null);
    setEditingArc(false);
  };

  const resetArcForm = () => {
    setArcForm({
      title: "",
      description: "",
      startChapter: 0,
      endChapter: 0,
      detailedPlan: "",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Synopsis section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              故事梗概
            </CardTitle>
            {!editingSynopsis && (
              <Button size="sm" variant="outline" onClick={startEditSynopsis}>
                <Pencil className="mr-1 h-3 w-3" />
                编辑
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingSynopsis ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">梗概</label>
                <textarea
                  value={synopsisText}
                  onChange={(e) => setSynopsisText(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  主题标签（每行一个）
                </label>
                <textarea
                  value={themesText}
                  onChange={(e) => setThemesText(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void saveSynopsis()}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingSynopsis(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {outline?.synopsis ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {outline.synopsis}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">暂无梗概</p>
              )}
              {outline?.themes && outline.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {outline.themes.map((theme, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {theme}
                    </Badge>
                  ))}
                </div>
              )}
              {outline?.structureType && (
                <div className="text-xs text-muted-foreground">
                  结构类型: <span className="font-medium">{outline.structureType}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Arc list + detail */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 360 }}>
        {/* Left: Arc list */}
        <div className="col-span-1 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <ListTree className="h-4 w-4" />
              弧段列表
            </h3>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={startCreatingArc}
            >
              <Plus className="mr-1 h-3 w-3" />
              新增
            </Button>
          </div>

          {arcs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无弧段
            </p>
          )}

          {arcs.map((arc) => {
            const isSelected = selectedArcIdx === arc.arcIndex;
            return (
              <div
                key={arc.arcIndex}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2.5 transition-colors cursor-pointer group",
                  "hover:bg-accent",
                  isSelected && "border-primary/50 bg-accent/80",
                )}
                onClick={() => handleSelectArc(arc)}
                role="button"
                tabIndex={0}
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    isSelected && "rotate-90",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="text-muted-foreground mr-1">#{arc.arcIndex}</span>
                    {arc.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ch.{arc.startChapter} — Ch.{arc.endChapter}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteArc(arc.arcIndex);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Right: Arc detail / editor */}
        <div className="col-span-2">
          {/* Create arc form */}
          {creatingArc && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">新建弧段</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  placeholder="弧段标题"
                  value={arcForm.title}
                  onChange={(e) => setArcForm({ ...arcForm, title: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  placeholder="弧段简介"
                  value={arcForm.description}
                  onChange={(e) =>
                    setArcForm({ ...arcForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">起始章节</label>
                    <input
                      type="number"
                      value={arcForm.startChapter}
                      onChange={(e) =>
                        setArcForm({
                          ...arcForm,
                          startChapter: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">结束章节</label>
                    <input
                      type="number"
                      value={arcForm.endChapter}
                      onChange={(e) =>
                        setArcForm({
                          ...arcForm,
                          endChapter: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <textarea
                  placeholder="详细规划（支持 Markdown）"
                  value={arcForm.detailedPlan}
                  onChange={(e) =>
                    setArcForm({ ...arcForm, detailedPlan: e.target.value })
                  }
                  rows={8}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleCreateArc()}
                    disabled={!arcForm.title.trim() || saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    创建
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCreatingArc(false)}
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Arc view mode */}
          {!creatingArc && selectedArc && !editingArc && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-muted-foreground">#{selectedArc.arcIndex}</span>
                    {selectedArc.title}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={startEditArc}>
                    编辑
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ch.{selectedArc.startChapter} — Ch.{selectedArc.endChapter} (
                  {selectedArc.endChapter - selectedArc.startChapter + 1} 章)
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedArc.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      简介
                    </p>
                    <p className="text-sm leading-relaxed">
                      {selectedArc.description}
                    </p>
                  </div>
                )}
                {selectedArc.detailedPlan && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      详细规划
                    </p>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3">
                      {selectedArc.detailedPlan}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Arc edit mode */}
          {!creatingArc && selectedArc && editingArc && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  编辑 — #{selectedArc.arcIndex} {selectedArc.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  placeholder="弧段标题"
                  value={arcForm.title}
                  onChange={(e) => setArcForm({ ...arcForm, title: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  placeholder="弧段简介"
                  value={arcForm.description}
                  onChange={(e) =>
                    setArcForm({ ...arcForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">起始章节</label>
                    <input
                      type="number"
                      value={arcForm.startChapter}
                      onChange={(e) =>
                        setArcForm({
                          ...arcForm,
                          startChapter: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">结束章节</label>
                    <input
                      type="number"
                      value={arcForm.endChapter}
                      onChange={(e) =>
                        setArcForm({
                          ...arcForm,
                          endChapter: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <textarea
                  placeholder="详细规划（支持 Markdown）"
                  value={arcForm.detailedPlan}
                  onChange={(e) =>
                    setArcForm({ ...arcForm, detailedPlan: e.target.value })
                  }
                  rows={10}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void saveArc()}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingArc(false)}
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!creatingArc && !selectedArc && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              选择左侧弧段查看详情，或点击「新增」创建
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

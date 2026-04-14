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
  Palette,
  Lock,
  GitFork,
  Loader2,
  ChevronRight,
  Sliders,
  BookText,
  Eye,
} from "lucide-react";
import {
  useStyles,
  useStyleDetail,
  type StyleListItem,
} from "@/hooks/use-styles";

interface StyleEditorProps {
  projectId: string | null;
}

const sourceLabels: Record<string, { label: string; color: string }> = {
  builtin: { label: "内置", color: "bg-emerald-100 text-emerald-700" },
  user: { label: "自定义", color: "bg-blue-100 text-blue-700" },
  fork: { label: "Fork", color: "bg-amber-100 text-amber-700" },
};

const toneLabels: Record<string, string> = {
  humor: "幽默",
  tension: "紧张",
  romance: "浪漫",
  dark: "暗黑",
};

const weightLabels: Record<string, string> = {
  world: "世界观",
  character: "角色",
  plot: "剧情",
};

/**
 * M3.7-E: Style configuration editor.
 * Browse builtin presets (read-only), fork them, create custom styles, manage tone/weights.
 */
export function StyleEditor({ projectId }: StyleEditorProps) {
  const { styles, loading: listLoading, refetch } = useStyles(projectId);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const {
    style: detail,
    loading: detailLoading,
    forkStyle,
    createStyle,
    updateStyle,
    deleteStyle,
  } = useStyleDetail(projectId, selectedStyleId);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    displayName: "",
    genre: "",
    description: "",
    proseGuide: "",
    examples: "",
  });

  const [editForm, setEditForm] = useState<{
    displayName: string;
    genre: string;
    description: string;
    proseGuide: string;
    examples: string;
    tone: Record<string, number>;
    contextWeights: Record<string, number>;
    encouraged: string;
    forbiddenWords: string;
  }>({
    displayName: "",
    genre: "",
    description: "",
    proseGuide: "",
    examples: "",
    tone: {},
    contextWeights: {},
    encouraged: "",
    forbiddenWords: "",
  });

  const handleSelect = (s: StyleListItem) => {
    setSelectedStyleId(s.styleId);
    setEditing(false);
    setCreating(false);
  };

  const handleFork = async () => {
    if (!detail) return;
    setSaving(true);
    const forked = await forkStyle();
    if (forked) {
      await refetch();
      setSelectedStyleId(forked.styleId);
    }
    setSaving(false);
  };

  const startCreate = () => {
    setCreateForm({ displayName: "", genre: "", description: "", proseGuide: "", examples: "" });
    setCreating(true);
    setSelectedStyleId(null);
    setEditing(false);
  };

  const handleCreate = async () => {
    if (!createForm.displayName.trim()) return;
    setSaving(true);
    const result = await createStyle({
      displayName: createForm.displayName.trim(),
      genre: createForm.genre || undefined,
      description: createForm.description || undefined,
      proseGuide: createForm.proseGuide || undefined,
      examples: createForm.examples || undefined,
    });
    if (result) {
      await refetch();
      setSelectedStyleId(result.styleId);
      setCreating(false);
    }
    setSaving(false);
  };

  const startEdit = () => {
    if (!detail || detail.source === "builtin") return;
    setEditForm({
      displayName: detail.displayName,
      genre: detail.genre,
      description: detail.description,
      proseGuide: detail.proseGuide,
      examples: detail.examples,
      tone: { ...detail.tone },
      contextWeights: { ...detail.contextWeights },
      encouraged: detail.encouraged.join("\n"),
      forbiddenWords: (detail.forbidden.words ?? []).join("\n"),
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!detail) return;
    setSaving(true);
    await updateStyle({
      displayName: editForm.displayName,
      genre: editForm.genre,
      description: editForm.description,
      proseGuide: editForm.proseGuide,
      examples: editForm.examples,
      tone: editForm.tone,
      contextWeights: editForm.contextWeights,
      encouraged: editForm.encouraged.split("\n").filter((s) => s.trim()),
      forbidden: {
        words: editForm.forbiddenWords.split("\n").filter((s) => s.trim()),
      },
    });
    setEditing(false);
    setSaving(false);
  };

  const handleDelete = async (styleId: string) => {
    await deleteStyle(styleId);
    await refetch();
    if (selectedStyleId === styleId) {
      setSelectedStyleId(null);
      setEditing(false);
    }
  };

  const updateTone = (key: string, value: number) => {
    setEditForm({
      ...editForm,
      tone: { ...editForm.tone, [key]: value },
    });
  };

  const updateWeight = (key: string, value: number) => {
    setEditForm({
      ...editForm,
      contextWeights: { ...editForm.contextWeights, [key]: value },
    });
  };

  if (listLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 480 }}>
      {/* Left: Style list */}
      <div className="col-span-1 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            风格列表
          </h3>
          <Button size="sm" variant="outline" className="h-7" onClick={startCreate}>
            <Plus className="mr-1 h-3 w-3" />
            自定义
          </Button>
        </div>

        {styles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无风格</p>
        )}

        {styles.map((s) => {
          const isSelected = selectedStyleId === s.styleId;
          const src = sourceLabels[s.source] ?? { label: s.source, color: "bg-gray-100 text-gray-700" };
          return (
            <div
              key={s.styleId}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 transition-colors cursor-pointer group",
                "hover:bg-accent",
                isSelected && "border-primary/50 bg-accent/80",
              )}
              onClick={() => handleSelect(s)}
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
                <p className="text-sm font-medium truncate">{s.displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={cn("h-4 px-1.5 text-[10px]", src.color)}>
                    {src.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{s.genre}</span>
                </div>
              </div>
              {s.source === "builtin" && (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              {s.source !== "builtin" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(s.styleId);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Detail / Editor */}
      <div className="col-span-2 overflow-auto" style={{ maxHeight: 600 }}>
        {/* Create form */}
        {creating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">创建自定义风格</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="风格名称"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="适用题材"
                  value={createForm.genre}
                  onChange={(e) => setCreateForm({ ...createForm, genre: e.target.value })}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <textarea
                placeholder="风格描述"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />
              <textarea
                placeholder="文笔指南 (prose guide)"
                value={createForm.proseGuide}
                onChange={(e) => setCreateForm({ ...createForm, proseGuide: e.target.value })}
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />
              <textarea
                placeholder="示例段落"
                value={createForm.examples}
                onChange={(e) => setCreateForm({ ...createForm, examples: e.target.value })}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!createForm.displayName.trim() || saving}
                >
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  创建
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detail loading */}
        {!creating && selectedStyleId && detailLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* View mode */}
        {!creating && detail && !detailLoading && !editing && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  {detail.displayName}
                </CardTitle>
                <div className="flex gap-2">
                  {detail.source === "builtin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleFork()}
                      disabled={saving}
                    >
                      <GitFork className="mr-1 h-3 w-3" />
                      Fork
                    </Button>
                  )}
                  {detail.source !== "builtin" && (
                    <Button size="sm" variant="outline" onClick={startEdit}>
                      编辑
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("w-fit", (sourceLabels[detail.source] ?? { color: "bg-gray-100 text-gray-700" }).color)}>
                  {(sourceLabels[detail.source] ?? { label: detail.source }).label}
                </Badge>
                <span className="text-xs text-muted-foreground">{detail.genre}</span>
                {detail.forkedFrom && (
                  <span className="text-xs text-muted-foreground">
                    (Fork from {detail.forkedFrom})
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.description && (
                <p className="text-sm leading-relaxed">{detail.description}</p>
              )}

              {/* Tone sliders (read-only) */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Sliders className="h-3 w-3" />
                  语调控制
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(detail.tone).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10">
                        {toneLabels[key] ?? key}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(val as number) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-8 text-right">
                        {(val as number).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Context weights (read-only) */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  上下文权重
                </p>
                <div className="flex gap-4">
                  {Object.entries(detail.contextWeights).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div className="text-lg font-semibold">{(val as number).toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {weightLabels[key] ?? key}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prose guide */}
              {detail.proseGuide && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <BookText className="h-3 w-3" />
                    文笔指南
                  </p>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3">
                    {detail.proseGuide}
                  </div>
                </div>
              )}

              {/* Examples */}
              {detail.examples && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">示例</p>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 italic">
                    {detail.examples}
                  </div>
                </div>
              )}

              {/* Forbidden / Encouraged */}
              <div className="grid grid-cols-2 gap-4">
                {detail.encouraged.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">鼓励使用</p>
                    <div className="flex flex-wrap gap-1">
                      {detail.encouraged.map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(detail.forbidden.words ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">禁止使用</p>
                    <div className="flex flex-wrap gap-1">
                      {(detail.forbidden.words ?? []).map((w, i) => (
                        <Badge key={i} variant="outline" className="text-xs text-destructive">
                          {w}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modules */}
              {detail.modules.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">加载模块</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.modules.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit mode */}
        {!creating && detail && !detailLoading && editing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">编辑 — {detail.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="风格名称"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="题材"
                  value={editForm.genre}
                  onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <textarea
                placeholder="风格描述"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />

              {/* Tone sliders */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Sliders className="h-3 w-3" />
                  语调控制
                </p>
                <div className="space-y-2">
                  {Object.entries(editForm.tone).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-10">
                        {toneLabels[key] ?? key}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={val}
                        onChange={(e) => updateTone(key, parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono w-8 text-right">
                        {val.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Context weights */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  上下文权重
                </p>
                <div className="space-y-2">
                  {Object.entries(editForm.contextWeights).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-10">
                        {weightLabels[key] ?? key}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={val}
                        onChange={(e) => updateWeight(key, parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono w-8 text-right">
                        {val.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                placeholder="文笔指南"
                value={editForm.proseGuide}
                onChange={(e) => setEditForm({ ...editForm, proseGuide: e.target.value })}
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />

              <textarea
                placeholder="示例段落"
                value={editForm.examples}
                onChange={(e) => setEditForm({ ...editForm, examples: e.target.value })}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">鼓励使用（每行一条）</label>
                  <textarea
                    value={editForm.encouraged}
                    onChange={(e) => setEditForm({ ...editForm, encouraged: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">禁止词汇（每行一条）</label>
                  <textarea
                    value={editForm.forbiddenWords}
                    onChange={(e) => setEditForm({ ...editForm, forbiddenWords: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => void handleSaveEdit()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!creating && !selectedStyleId && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            选择左侧风格查看详情，或点击「自定义」创建新风格
          </div>
        )}
      </div>
    </div>
  );
}

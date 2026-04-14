"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Save, Trash2, Globe, FileText, Loader2, ChevronRight } from "lucide-react";
import { useWorldSettings, type WorldSetting } from "@/hooks/use-world-settings";

interface WorldEditorProps {
  projectId: string | null;
}

const sectionLabels: Record<string, { label: string; color: string }> = {
  rules: { label: "基础法则", color: "bg-red-100 text-red-700" },
  "subsystem:power": { label: "修炼体系", color: "bg-purple-100 text-purple-700" },
  "subsystem:social": { label: "社会结构", color: "bg-blue-100 text-blue-700" },
  "subsystem:geography": { label: "地理环境", color: "bg-green-100 text-green-700" },
  "subsystem:economy": { label: "经济体系", color: "bg-amber-100 text-amber-700" },
  "subsystem:history": { label: "历史背景", color: "bg-gray-100 text-gray-700" },
  "subsystem:magic": { label: "魔法体系", color: "bg-indigo-100 text-indigo-700" },
  "subsystem:technology": { label: "科技体系", color: "bg-cyan-100 text-cyan-700" },
};

function getSectionLabel(section: string) {
  const info = sectionLabels[section];
  if (info) return info;
  const name = section.replace("subsystem:", "");
  return { label: name, color: "bg-gray-100 text-gray-700" };
}

/**
 * §5.3.6 — World setting editor with open-ended subsystem management.
 */
export function WorldEditor({ projectId }: WorldEditorProps) {
  const { settings, loading, createSetting, updateSetting, deleteSetting } =
    useWorldSettings(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSection, setNewSection] = useState("subsystem:");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = settings.find((s) => s.id === selectedId) ?? null;

  const handleSelect = (setting: WorldSetting) => {
    setSelectedId(setting.id);
    setEditing(false);
    setCreating(false);
  };

  const handleEdit = () => {
    if (!selected) return;
    setEditContent(selected.content);
    setEditName(selected.name);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await updateSetting(selected.id, { content: editContent, name: editName });
    setEditing(false);
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    setSaving(true);
    const result = await createSetting({
      section: newSection.trim(),
      name: newName.trim(),
      content: newContent.trim(),
    });
    if (result) {
      setSelectedId(result.id);
      setCreating(false);
      setNewSection("subsystem:");
      setNewName("");
      setNewContent("");
    }
    setSaving(false);
  };

  const handleDelete = async (settingId: string) => {
    await deleteSetting(settingId);
    if (selectedId === settingId) {
      setSelectedId(null);
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 420 }}>
      {/* Left: Subsystem list */}
      <div className="col-span-1 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            子系统列表
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
              setEditing(false);
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            新增
          </Button>
        </div>

        {settings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无世界设定
          </p>
        )}

        {settings.map((setting) => {
          const info = getSectionLabel(setting.section);
          const isSelected = selectedId === setting.id;
          return (
            <div
              key={setting.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 transition-colors cursor-pointer group",
                "hover:bg-accent",
                isSelected && "border-primary/50 bg-accent/80",
              )}
              onClick={() => handleSelect(setting)}
              role="button"
              tabIndex={0}
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isSelected && "rotate-90")}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{setting.name}</p>
                <Badge className={cn("mt-0.5 h-4 px-1.5 text-[10px]", info.color)}>
                  {info.label}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(setting.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Right: Detail/Editor */}
      <div className="col-span-2">
        {creating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">新建世界设定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="text"
                placeholder="子系统标识（如 subsystem:power）"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="名称（如 修炼体系）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                placeholder="设定内容（支持 Markdown）"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={12}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!newName.trim() || !newContent.trim() || saving}
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

        {!creating && selected && !editing && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {selected.name}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={handleEdit}>
                  编辑
                </Button>
              </div>
              <Badge className={cn("w-fit", getSectionLabel(selected.section).color)}>
                {getSectionLabel(selected.section).label}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {selected.content}
              </div>
            </CardContent>
          </Card>
        )}

        {!creating && selected && editing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">编辑 — {selected.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={16}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
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

        {!creating && !selected && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            选择左侧子系统查看详情，或点击「新增」创建
          </div>
        )}
      </div>
    </div>
  );
}

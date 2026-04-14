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
  Users,
  User,
  ChevronRight,
  Loader2,
  Dna,
  Heart,
  Target,
  Brain,
  Shield,
} from "lucide-react";
import { useCharacters, type Character, type CharacterDNA } from "@/hooks/use-characters";

interface CharacterEditorProps {
  projectId: string | null;
}

const roleConfig: Record<
  string,
  { label: string; color: string; icon: typeof User }
> = {
  protagonist: { label: "主角", color: "bg-red-100 text-red-700", icon: Target },
  antagonist: { label: "反派", color: "bg-purple-100 text-purple-700", icon: Shield },
  supporting: { label: "配角", color: "bg-blue-100 text-blue-700", icon: Users },
  minor: { label: "龙套", color: "bg-gray-100 text-gray-700", icon: User },
};

const dnaLabels: { key: keyof CharacterDNA; label: string; icon: typeof Dna }[] = [
  { key: "ghost", label: "幽灵 (Ghost)", icon: Brain },
  { key: "wound", label: "伤痕 (Wound)", icon: Heart },
  { key: "lie", label: "谎言 (Lie)", icon: Shield },
  { key: "want", label: "表层欲望 (Want)", icon: Target },
  { key: "need", label: "深层需求 (Need)", icon: Dna },
];

function getRoleInfo(role: string) {
  return roleConfig[role] ?? { label: role, color: "bg-gray-100 text-gray-700", icon: User };
}

/**
 * M3.7-C: Character editor with DNA model, role-sorted list, and CRUD.
 */
export function CharacterEditor({ projectId }: CharacterEditorProps) {
  const { characters, loading, createCharacter, updateCharacter, deleteCharacter } =
    useCharacters(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    role: "minor" as Character["role"],
    description: "",
    personality: "",
    background: "",
    goals: "",
    arc: "",
    dna: null as CharacterDNA | null,
  });

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  const handleSelect = (ch: Character) => {
    setSelectedId(ch.id);
    setEditing(false);
    setCreating(false);
  };

  const handleEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      role: selected.role,
      description: selected.description,
      personality: selected.personality,
      background: selected.background,
      goals: selected.goals.join("\n"),
      arc: selected.arc ?? "",
      dna: selected.dna ? { ...selected.dna } : null,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await updateCharacter(selected.id, {
      name: editForm.name,
      role: editForm.role,
      description: editForm.description,
      personality: editForm.personality,
      background: editForm.background,
      goals: editForm.goals.split("\n").filter((g) => g.trim()),
      arc: editForm.arc || null,
      dna: editForm.dna,
    });
    setEditing(false);
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    const result = await createCharacter({
      name: editForm.name.trim(),
      role: editForm.role,
      description: editForm.description,
    });
    if (result) {
      setSelectedId(result.id);
      setCreating(false);
      resetForm();
    }
    setSaving(false);
  };

  const handleDelete = async (charId: string) => {
    await deleteCharacter(charId);
    if (selectedId === charId) {
      setSelectedId(null);
      setEditing(false);
    }
  };

  const resetForm = () => {
    setEditForm({
      name: "",
      role: "minor",
      description: "",
      personality: "",
      background: "",
      goals: "",
      arc: "",
      dna: null,
    });
  };

  const startCreating = () => {
    resetForm();
    setCreating(true);
    setSelectedId(null);
    setEditing(false);
  };

  const toggleDna = () => {
    if (editForm.dna) {
      setEditForm({ ...editForm, dna: null });
    } else {
      setEditForm({
        ...editForm,
        dna: {
          ghost: "",
          wound: "",
          lie: "",
          want: "",
          need: "",
          arcType: "positive",
          defaultMode: "",
          stressResponse: "",
          tell: "",
        },
      });
    }
  };

  const updateDnaField = (key: string, value: string) => {
    if (!editForm.dna) return;
    setEditForm({
      ...editForm,
      dna: { ...editForm.dna, [key]: value },
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
    <div className="grid grid-cols-3 gap-4" style={{ minHeight: 480 }}>
      {/* Left: Character list */}
      <div className="col-span-1 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            角色列表
          </h3>
          <Button size="sm" variant="outline" className="h-7" onClick={startCreating}>
            <Plus className="mr-1 h-3 w-3" />
            新增
          </Button>
        </div>

        {characters.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无角色</p>
        )}

        {characters.map((ch) => {
          const info = getRoleInfo(ch.role);
          const isSelected = selectedId === ch.id;
          return (
            <div
              key={ch.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 transition-colors cursor-pointer group",
                "hover:bg-accent",
                isSelected && "border-primary/50 bg-accent/80",
              )}
              onClick={() => handleSelect(ch)}
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
                <p className="text-sm font-medium truncate">{ch.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={cn("h-4 px-1.5 text-[10px]", info.color)}>
                    {info.label}
                  </Badge>
                  {ch.dna && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                      DNA
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(ch.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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
              <CardTitle className="text-base">新建角色</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="text"
                placeholder="角色名称"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as Character["role"] })
                }
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="protagonist">主角</option>
                <option value="antagonist">反派</option>
                <option value="supporting">配角</option>
                <option value="minor">龙套</option>
              </select>
              <textarea
                placeholder="角色简介"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={!editForm.name.trim() || saving}
                >
                  {saving ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
                  创建
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View mode */}
        {!creating && selected && !editing && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {selected.name}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={handleEdit}>
                  编辑
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("w-fit", getRoleInfo(selected.role).color)}>
                  {getRoleInfo(selected.role).label}
                </Badge>
                {selected.aliases.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    别称: {selected.aliases.join(", ")}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">简介</p>
                  <p className="text-sm leading-relaxed">{selected.description}</p>
                </div>
              )}

              {selected.personality && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">性格</p>
                  <p className="text-sm leading-relaxed">{selected.personality}</p>
                </div>
              )}

              {selected.background && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">背景</p>
                  <p className="text-sm leading-relaxed">{selected.background}</p>
                </div>
              )}

              {selected.goals.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">目标</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {selected.goals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.arc && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">角色弧</p>
                  <p className="text-sm leading-relaxed">{selected.arc}</p>
                </div>
              )}

              {/* DNA display */}
              {selected.dna && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Dna className="h-3 w-3" />
                    角色 DNA (四维心理模型)
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {dnaLabels.map(({ key, label, icon: Icon }) => {
                      const val = selected.dna?.[key];
                      if (!val) return null;
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-2 rounded-md bg-muted/50 p-2"
                        >
                          <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {label}
                            </p>
                            <p className="text-sm">{val}</p>
                          </div>
                        </div>
                      );
                    })}
                    {selected.dna.arcType && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs">弧类型:</span>
                        <Badge variant="outline" className="text-xs">
                          {selected.dna.arcType}
                        </Badge>
                      </div>
                    )}
                    {selected.dna.defaultMode && (
                      <div className="text-sm">
                        <span className="text-muted-foreground text-xs">默认模式: </span>
                        {selected.dna.defaultMode}
                      </div>
                    )}
                    {selected.dna.stressResponse && (
                      <div className="text-sm">
                        <span className="text-muted-foreground text-xs">压力反应: </span>
                        {selected.dna.stressResponse}
                      </div>
                    )}
                    {selected.dna.tell && (
                      <div className="text-sm">
                        <span className="text-muted-foreground text-xs">小动作: </span>
                        {selected.dna.tell}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit mode */}
        {!creating && selected && editing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">编辑 — {selected.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="角色名称"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as Character["role"] })
                  }
                  className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="protagonist">主角</option>
                  <option value="antagonist">反派</option>
                  <option value="supporting">配角</option>
                  <option value="minor">龙套</option>
                </select>
              </div>

              <textarea
                placeholder="角色简介"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />

              <textarea
                placeholder="性格描写"
                value={editForm.personality}
                onChange={(e) => setEditForm({ ...editForm, personality: e.target.value })}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />

              <textarea
                placeholder="背景故事"
                value={editForm.background}
                onChange={(e) => setEditForm({ ...editForm, background: e.target.value })}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
              />

              <textarea
                placeholder="目标（每行一条）"
                value={editForm.goals}
                onChange={(e) => setEditForm({ ...editForm, goals: e.target.value })}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              />

              <input
                type="text"
                placeholder="角色弧线"
                value={editForm.arc}
                onChange={(e) => setEditForm({ ...editForm, arc: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />

              {/* DNA section */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Dna className="h-3 w-3" />
                    角色 DNA (四维心理模型)
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={toggleDna}>
                    {editForm.dna ? "移除 DNA" : "添加 DNA"}
                  </Button>
                </div>

                {editForm.dna && (
                  <div className="space-y-2">
                    {dnaLabels.map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-[11px] text-muted-foreground">{label}</label>
                        <input
                          type="text"
                          value={(editForm.dna as CharacterDNA)[key] as string}
                          onChange={(e) => updateDnaField(key, e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground">弧类型</label>
                        <select
                          value={editForm.dna.arcType}
                          onChange={(e) => updateDnaField("arcType", e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="positive">正向弧 (positive)</option>
                          <option value="negative">负向弧 (negative)</option>
                          <option value="flat">平弧 (flat)</option>
                          <option value="corruption">堕落弧 (corruption)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground">小动作 (Tell)</label>
                        <input
                          type="text"
                          value={editForm.dna.tell}
                          onChange={(e) => updateDnaField("tell", e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">默认模式</label>
                      <input
                        type="text"
                        value={editForm.dna.defaultMode}
                        onChange={(e) => updateDnaField("defaultMode", e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">压力反应</label>
                      <input
                        type="text"
                        value={editForm.dna.stressResponse}
                        onChange={(e) => updateDnaField("stressResponse", e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
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
        {!creating && !selected && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            选择左侧角色查看详情，或点击「新增」创建
          </div>
        )}
      </div>
    </div>
  );
}

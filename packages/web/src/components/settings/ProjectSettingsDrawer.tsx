"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface ProjectSettingsDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ProjectSettingsDrawer({ open, onClose }: ProjectSettingsDrawerProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

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

        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* 基本信息 */}
          <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="info" size={16} /> 基本信息
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">项目名称</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm bg-background" defaultValue="未命名项目" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">题材</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm bg-background" defaultValue="奇幻" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">创建时间</label>
              <input type="text" className="w-full border rounded px-2 py-1 text-sm bg-muted cursor-not-allowed" readOnly value="2026-04-19 12:00:00" />
            </div>
          </section>

          {/* 写作风格 */}
          <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="palette" size={16} /> 写作风格
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">执笔·剑心</span>
              <Button variant="outline" size="sm">切换</Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">冷峻简约、短句、白描、动作化叙事</p>
          </section>

          {/* 模型配置 */}
          <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="memory" size={16} /> 模型配置
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">写作模型</label>
              <select className="w-full border rounded px-2 py-1 text-sm bg-background">
                <option>Claude Sonnet 4</option>
                <option>Kimi K2</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">审校模型</label>
              <select className="w-full border rounded px-2 py-1 text-sm bg-background">
                <option>Claude Sonnet 4</option>
              </select>
            </div>
          </section>

          {/* 成本预算 */}
          <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="payments" size={16} /> 成本预算
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">已消耗 Token</span>
              <span className="font-mono font-medium text-primary">124,500</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">预算上限 (Token)</label>
              <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" defaultValue="1000000" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">超限行为</label>
              <select className="w-full border rounded px-2 py-1 text-sm bg-background">
                <option>暂停工作并提醒</option>
                <option>仅提醒，继续工作</option>
              </select>
            </div>
          </section>

          {/* 写作参数 */}
          <section className="space-y-3 bg-card rounded-xl border p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="tune" size={16} /> 写作参数
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">单章目标字数</label>
              <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" defaultValue="3000" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">审校及格阈值</label>
              <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" defaultValue="80" />
            </div>
          </section>

          {/* 危险操作 */}
          <section className="space-y-4 bg-red-50/50 rounded-xl border border-red-100 p-4 shadow-sm">
            <h3 className="font-medium text-sm text-red-600 border-b border-red-100 pb-2 flex items-center gap-2">
              <Icon name="warning" size={16} /> 危险操作
            </h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-between hover:bg-yellow-50 hover:text-yellow-600 border-yellow-200">
                归档项目 <Icon name="archive" size={18} />
              </Button>
              <p className="text-xs text-muted-foreground">归档后项目变为只读状态，可随时恢复。</p>
            </div>
            <div className="space-y-3">
              <Button variant="destructive" className="w-full justify-between">
                删除项目 <Icon name="delete_forever" size={18} />
              </Button>
              <p className="text-xs text-red-500/70">删除操作不可逆，将永久丢失所有数据！</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

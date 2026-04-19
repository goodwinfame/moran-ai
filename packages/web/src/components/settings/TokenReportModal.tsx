"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface TokenReportModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function TokenReportModal({ open, onClose, projectId }: TokenReportModalProps) {
  // Placeholder data
  console.log("Token report for project", projectId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="analytics" size={24} filled />
            Token 使用报告
          </DialogTitle>
          <DialogDescription>
            项目当前各类 Agent 和章节的 Token 消耗情况概览。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Agent 分布 */}
          <section className="space-y-3 bg-card border rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="groups" size={18} /> Agent 分布
            </h3>
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">Agent</th>
                    <th className="px-4 py-2 font-medium">角色</th>
                    <th className="px-4 py-2 font-medium text-right">消耗 Token</th>
                    <th className="px-4 py-2 font-medium text-right">占比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">墨衡</td>
                    <td className="px-4 py-2 text-muted-foreground">协调器</td>
                    <td className="px-4 py-2 text-right font-mono">45,200</td>
                    <td className="px-4 py-2 text-right">36%</td>
                  </tr>
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">执笔·剑心</td>
                    <td className="px-4 py-2 text-muted-foreground">主写手</td>
                    <td className="px-4 py-2 text-right font-mono">38,150</td>
                    <td className="px-4 py-2 text-right">31%</td>
                  </tr>
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">明镜</td>
                    <td className="px-4 py-2 text-muted-foreground">审校</td>
                    <td className="px-4 py-2 text-right font-mono">24,800</td>
                    <td className="px-4 py-2 text-right">20%</td>
                  </tr>
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">灵犀</td>
                    <td className="px-4 py-2 text-muted-foreground">脑暴</td>
                    <td className="px-4 py-2 text-right font-mono">16,350</td>
                    <td className="px-4 py-2 text-right">13%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 章节分布 */}
          <section className="space-y-3 bg-card border rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="auto_stories" size={18} /> 章节分布
            </h3>
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">章节</th>
                    <th className="px-4 py-2 font-medium">标题</th>
                    <th className="px-4 py-2 font-medium text-right">消耗 Token</th>
                    <th className="px-4 py-2 font-medium text-right">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">第 1 章</td>
                    <td className="px-4 py-2 text-muted-foreground">命运的齿轮</td>
                    <td className="px-4 py-2 text-right font-mono">12,400</td>
                    <td className="px-4 py-2 text-right text-green-600">已完结</td>
                  </tr>
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">第 2 章</td>
                    <td className="px-4 py-2 text-muted-foreground">潜伏的阴影</td>
                    <td className="px-4 py-2 text-right font-mono">15,800</td>
                    <td className="px-4 py-2 text-right text-green-600">已完结</td>
                  </tr>
                  <tr className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2 font-medium">第 3 章</td>
                    <td className="px-4 py-2 text-muted-foreground">未命名</td>
                    <td className="px-4 py-2 text-right font-mono">8,200</td>
                    <td className="px-4 py-2 text-right text-blue-600">写作中</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 费用趋势 */}
          <section className="space-y-3 bg-card border rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
              <Icon name="monitoring" size={18} /> 费用趋势
            </h3>
            <div className="h-32 flex items-center justify-center bg-secondary/20 rounded-lg border border-dashed">
              <span className="text-muted-foreground text-sm">趋势图表 (待实现)</span>
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-2 mt-2">
          <Button onClick={onClose} variant="default" className="px-6">
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

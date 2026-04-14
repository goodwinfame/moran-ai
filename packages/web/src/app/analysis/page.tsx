import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";

export default function AnalysisPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="📊 分析"
        description="参考作品深度分析 — 九维文学分析框架"
        actions={
          <Button size="sm">提交新分析</Button>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Analysis tasks */}
        <aside className="w-72 border-r border-border bg-muted/30 p-4 overflow-auto">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">分析历史</h3>
          <p className="text-sm text-muted-foreground">暂无分析记录</p>
        </aside>

        {/* Right: Analysis report */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-lg text-muted-foreground">
                提交参考作品进行九维分析
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                叙事结构 · 角色设计 · 世界观 · 伏笔技巧 · 节奏张力 · 爽感机制 · 文风指纹 · 对话声音 · 章末钩子
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

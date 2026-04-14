import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function WritePage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="✍️ 写作"
        description="触发写作、监控写作过程、人工干预"
        actions={
          <div className="flex gap-2">
            <Button size="sm">写下一章</Button>
            <Button size="sm" variant="outline">连续写作</Button>
          </div>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Live writing area */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-lg text-muted-foreground">
                点击「写下一章」开始写作
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                执笔将以流式方式实时输出章节内容
              </p>
            </div>
          </div>
        </div>

        {/* Right: Context overview */}
        <aside className="hidden w-72 border-l border-border bg-muted/30 p-4 overflow-auto lg:block">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">上下文概览</h3>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Token 预算</p>
              <p>等待写作开始...</p>
            </div>
            <div>
              <p className="font-medium text-foreground">出场角色</p>
              <p>-</p>
            </div>
            <div>
              <p className="font-medium text-foreground">实时字数</p>
              <p>0 字</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom: Progress bar */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground min-w-[4rem]">空闲</span>
          <Progress value={0} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

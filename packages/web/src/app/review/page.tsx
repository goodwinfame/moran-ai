import { TopBar } from "@/components/layout/top-bar";
import { Badge } from "@/components/ui/badge";

export default function ReviewPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="🔍 审校" description="查看审校结果、人工批注、确认/驳回修改" />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chapter text with annotations */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-2xl">
            <p className="text-muted-foreground">选择章节查看审校结果</p>
          </div>
        </div>

        {/* Right: Review report */}
        <aside className="hidden w-80 border-l border-border bg-muted/30 p-4 overflow-auto lg:block">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">审校报告</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">严重度</span>
              <Badge variant="destructive" className="text-[10px]">CRITICAL</Badge>
              <Badge className="bg-orange-500 text-[10px]">MAJOR</Badge>
              <Badge className="bg-yellow-500 text-[10px]">MINOR</Badge>
            </div>
            <p className="text-sm text-muted-foreground">暂无审校数据</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

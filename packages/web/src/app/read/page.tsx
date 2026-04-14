import { TopBar } from "@/components/layout/top-bar";

export default function ReadPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="📖 阅读" description="浏览已完成的章节，像读小说一样" />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chapter TOC */}
        <aside className="w-64 border-r border-border bg-muted/30 p-4 overflow-auto">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">章节目录</h3>
          <p className="text-sm text-muted-foreground">暂无章节</p>
        </aside>

        {/* Center: Chapter content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-2xl">
            <p className="text-muted-foreground">选择左侧章节开始阅读</p>
          </div>
        </div>

        {/* Right: Info panel (collapsible) */}
        <aside className="hidden w-72 border-l border-border bg-muted/30 p-4 overflow-auto xl:block">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">章节信息</h3>
          <p className="text-sm text-muted-foreground">角色状态、伏笔追踪、章节摘要</p>
        </aside>
      </div>
    </div>
  );
}

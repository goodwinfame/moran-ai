import { TopBar } from "@/components/layout/top-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="⚙️ 设定" description="世界观、角色、大纲、风格与系统配置" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="world" className="w-full">
          <TabsList>
            <TabsTrigger value="world">世界观</TabsTrigger>
            <TabsTrigger value="characters">角色</TabsTrigger>
            <TabsTrigger value="outline">大纲</TabsTrigger>
            <TabsTrigger value="style">风格</TabsTrigger>
            <TabsTrigger value="agents">Agent 配置</TabsTrigger>
            <TabsTrigger value="knowledge">知识库</TabsTrigger>
            <TabsTrigger value="system">系统</TabsTrigger>
          </TabsList>

          <TabsContent value="world" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">世界观编辑器 — 开放式子系统管理</p>
            </div>
          </TabsContent>

          <TabsContent value="characters" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">角色管理 — 四维心理模型 + 关系图谱</p>
            </div>
          </TabsContent>

          <TabsContent value="outline" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">大纲树 — 弧段-章节两级规划</p>
            </div>
          </TabsContent>

          <TabsContent value="style" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">风格配置 — 内置预设 + 自定义风格</p>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">Agent 模型配置 — 每个 Agent 独立选择模型/温度</p>
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">知识库管理 — 写作技巧/题材知识/经验教训</p>
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">系统设置 — API Key、上下文预算、导出设置</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

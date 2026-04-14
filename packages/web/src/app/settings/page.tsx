"use client";

import { TopBar } from "@/components/layout/top-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectStore } from "@/stores/project-store";
import { WorldEditor } from "@/components/settings/world-editor";
import { CharacterEditor } from "@/components/settings/character-editor";
import { OutlineEditor } from "@/components/settings/outline-editor";
import { StyleEditor } from "@/components/settings/style-editor";

export default function SettingsPage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="设定"
        description={currentProject ? currentProject.name : "世界观、角色、大纲、风格与系统配置"}
      />
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
            <WorldEditor projectId={projectId} />
          </TabsContent>

          <TabsContent value="characters" className="mt-4">
            <CharacterEditor projectId={projectId} />
          </TabsContent>

          <TabsContent value="outline" className="mt-4">
            <OutlineEditor projectId={projectId} />
          </TabsContent>

          <TabsContent value="style" className="mt-4">
            <StyleEditor projectId={projectId} />
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

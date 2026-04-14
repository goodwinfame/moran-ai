import { TopBar } from "@/components/layout/top-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VisualizePage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="🗺️ 可视化" description="人物关系网络、地理位置层级、事件时间线" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="characters" className="w-full">
          <TabsList>
            <TabsTrigger value="characters">人物关系图</TabsTrigger>
            <TabsTrigger value="locations">地点层级树</TabsTrigger>
            <TabsTrigger value="timeline">事件时间线</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="mt-4">
            <div className="flex h-[calc(100vh-14rem)] items-center justify-center rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-lg text-muted-foreground">人物关系图</p>
                <p className="mt-1 text-sm text-muted-foreground">Cytoscape.js — 力导向布局</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="locations" className="mt-4">
            <div className="flex h-[calc(100vh-14rem)] items-center justify-center rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-lg text-muted-foreground">地点层级树</p>
                <p className="mt-1 text-sm text-muted-foreground">D3.js — 可折叠树</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <div className="flex h-[calc(100vh-14rem)] items-center justify-center rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-lg text-muted-foreground">事件时间线</p>
                <p className="mt-1 text-sm text-muted-foreground">vis-timeline — 分组时间轴</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

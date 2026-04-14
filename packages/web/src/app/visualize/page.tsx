"use client";

import { TopBar } from "@/components/layout/top-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RelationshipGraph } from "@/components/visualize/relationship-graph";
import { LocationTree } from "@/components/visualize/location-tree";
import { EventTimeline } from "@/components/visualize/event-timeline";
import { useProjectStore } from "@/stores/project-store";

export default function VisualizePage() {
  const projectId = useProjectStore((s) => s.currentProject?.id ?? null);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="\u{1f5fa}\ufe0f 可视化" description="人物关系网络、地理位置层级、事件时间线" />
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="characters" className="flex h-full w-full flex-col">
          <TabsList>
            <TabsTrigger value="characters">人物关系图</TabsTrigger>
            <TabsTrigger value="locations">地点层级树</TabsTrigger>
            <TabsTrigger value="timeline">事件时间线</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="mt-4 flex-1">
            <div className="h-[calc(100vh-14rem)]">
              <RelationshipGraph projectId={projectId} />
            </div>
          </TabsContent>

          <TabsContent value="locations" className="mt-4 flex-1">
            <div className="h-[calc(100vh-14rem)]">
              <LocationTree projectId={projectId} />
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 flex-1">
            <div className="h-[calc(100vh-14rem)]">
              <EventTimeline projectId={projectId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

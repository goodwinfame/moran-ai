"use client";

import type { ForeshadowData, ForeshadowEntry } from "@/stores/panel-store-types";
import { CollapsibleSection } from "../shared/CollapsibleSection";

export function ForeshadowView({ data }: { data: ForeshadowData }) {
  return (
    <div className="space-y-6">
      {data.unresolved.length > 0 && (
        <CollapsibleSection title="未解决" badge={`${data.unresolved.length} 条`} defaultOpen>
          <div className="space-y-3">
            {data.unresolved.map((item) => (
              <ForeshadowCard key={item.id} item={item} status="unresolved" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.overdue.length > 0 && (
        <CollapsibleSection title="超期" badge={`${data.overdue.length} 条`} defaultOpen>
          <div className="space-y-3">
            {data.overdue.map((item) => (
              <ForeshadowCard key={item.id} item={item} status="overdue" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {data.resolved.length > 0 && (
        <CollapsibleSection title="已回收" badge={`${data.resolved.length} 条`} defaultOpen={false}>
          <div className="space-y-3">
            {data.resolved.map((item) => (
              <ForeshadowCard key={item.id} item={item} status="resolved" />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function ForeshadowCard({ item, status }: { item: ForeshadowEntry; status: "unresolved" | "resolved" | "overdue" }) {
  return (
    <div className={`border rounded-lg p-4 space-y-2 bg-card ${status === "overdue" ? "border-yellow-600/50 bg-yellow-600/5" : ""}`}>
      <div className="flex gap-2 items-start justify-between">
        <p className="text-sm">{item.description}</p>
        <span className="text-xs shrink-0 whitespace-nowrap pt-1">
          {status === "unresolved" && "🔴 未解决"}
          {status === "resolved" && "✅ 已回收"}
          {status === "overdue" && "⚠️ 超期"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">埋设于：</span> 第 {item.plantedChapter} 章
        </div>
        
        {status === "resolved" && item.resolvedChapter ? (
          <div>
            <span className="font-medium">回收于：</span> 第 {item.resolvedChapter} 章
          </div>
        ) : (
          item.plannedArc && (
            <div>
              <span className="font-medium">预计回收：</span> {item.plannedArc}
            </div>
          )
        )}
        
        {item.characters.length > 0 && (
          <div>
            <span className="font-medium">关联角色：</span> {item.characters.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

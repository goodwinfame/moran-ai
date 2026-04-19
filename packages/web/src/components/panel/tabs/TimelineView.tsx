"use client";

import { useState } from "react";
import type { TimelineData } from "@/stores/panel-store";

export function TimelineView({ data }: { data: TimelineData }) {
  const [characterFilter, setCharacterFilter] = useState<string>("all");

  const characters = Array.from(new Set(data.events.flatMap((e) => e.characters)));

  const filteredEvents =
    characterFilter === "all"
      ? data.events
      : data.events.filter((e) => e.characters.includes(characterFilter));

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center text-sm">
        <label className="text-muted-foreground font-medium">角色筛选：</label>
        <select
          value={characterFilter}
          onChange={(e) => setCharacterFilter(e.target.value)}
          className="border rounded-md px-2 py-1 bg-background text-foreground"
        >
          <option value="all">全部角色</option>
          {characters.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="relative border-l-2 border-border ml-4 pl-6 space-y-6">
        {filteredEvents.map((event) => (
          <div key={event.id} className="relative">
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />

            <div className="border rounded-lg p-4 bg-card shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span>{event.storyTime}</span>
                </h4>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md shrink-0">
                  第 {event.chapterNumber} 章
                </span>
              </div>
              <p className="text-sm">{event.description}</p>
              {event.characters.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">角色：</span> {event.characters.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

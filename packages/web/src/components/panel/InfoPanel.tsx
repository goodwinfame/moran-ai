/**
 * InfoPanel — right-side panel container.
 * Renders TabBar + lazy-loaded tab content.
 * Initialises panel store from IndexedDB cache on mount.
 *
 * Phase 5.3: info-panel infrastructure
 */
"use client";

import { lazy, Suspense, useEffect } from "react";
import { TabBar } from "@/components/panel/TabBar";
import { EmptyState } from "@/components/panel/EmptyState";
import { usePanelStore } from "@/stores/panel-store";
import type { TabId } from "@/stores/panel-store";

// ── Lazy tab components ────────────────────────────────────────────────────────

const TAB_COMPONENTS: Record<TabId, React.LazyExoticComponent<React.ComponentType<{ projectId: string }>>> = {
  brainstorm: lazy(() => import("./tabs/BrainstormTab").then((m) => ({ default: m.BrainstormTab }))),
  world: lazy(() => import("./tabs/WorldTab").then((m) => ({ default: m.WorldTab }))),
  character: lazy(() => import("./tabs/CharacterTab").then((m) => ({ default: m.CharacterTab }))),
  outline: lazy(() => import("./tabs/OutlineTab").then((m) => ({ default: m.OutlineTab as React.ComponentType<{ projectId: string }> }))),
  chapter: lazy(() => import("./tabs/ChapterTab").then((m) => ({ default: m.ChapterTab as React.ComponentType<{ projectId: string }> }))),
  review: lazy(() => import("./tabs/ReviewTab").then((m) => ({ default: m.ReviewTab as React.ComponentType<{ projectId: string }> }))),
  analysis: lazy(() => import("./tabs/AnalysisTab")),
  knowledge: lazy(() => import("./tabs/KnowledgeTab")),
};

// ── TabContent ─────────────────────────────────────────────────────────────────

interface TabContentProps {
  tab: TabId;
  projectId: string;
}

function TabContent({ tab, projectId }: TabContentProps) {
  const Component = TAB_COMPONENTS[tab];
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Component projectId={projectId} />
    </Suspense>
  );
}

// ── InfoPanel ──────────────────────────────────────────────────────────────────

interface InfoPanelProps {
  projectId: string;
}

export function InfoPanel({ projectId }: InfoPanelProps) {
  const activeTab = usePanelStore((s) => s.activeTab);
  const visibleTabs = usePanelStore((s) => s.visibleTabs);
  const initFromCache = usePanelStore((s) => s.initFromCache);
  const fetchInitialData = usePanelStore((s) => s.fetchInitialData);

  useEffect(() => {
    const init = async () => {
      await initFromCache(projectId);
      await fetchInitialData(projectId);
    };
    void init();
  }, [projectId, initFromCache, fetchInitialData]);

  const hasVisibleTabs = visibleTabs.length > 0;

  return (
    <div
      data-testid="info-panel"
      className="flex flex-col h-full bg-background"
    >
      {hasVisibleTabs && <TabBar />}
      <div className="flex-1 overflow-y-auto">
        {hasVisibleTabs ? (
          <TabContent tab={activeTab} projectId={projectId} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

/**
 * WorkspacePage — Main container for /projects/:id.
 * Left/right split layout with draggable splitter.
 * Switches to MobileTabBar for viewports < 768px.
 *
 * Phase 5.2: chat-ui module
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ResizableSplitter } from "@/components/workspace/ResizableSplitter";
import { MobileTabBar } from "@/components/workspace/MobileTabBar";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_LEFT_RATIO = 0.25;
const MAX_LEFT_RATIO = 0.70;
const MOBILE_BREAKPOINT = 768;

// ── useWindowWidth ─────────────────────────────────────────────────────────────

function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1024;
    return window.innerWidth;
  });

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDefaultRatio(windowWidth: number): number {
  if (windowWidth >= 1440) return 0.4;
  if (windowWidth >= 1024) return 0.45;
  return 0.5;
}

// ── WorkspacePage ─────────────────────────────────────────────────────────────

interface WorkspacePageProps {
  projectId: string;
}

export function WorkspacePage({ projectId }: WorkspacePageProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < MOBILE_BREAKPOINT;

  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (typeof window === "undefined") return 0.45;
    const saved = localStorage.getItem(`split-ratio:${projectId}`);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return getDefaultRatio(window.innerWidth);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const rafId = useRef<number | null>(null);

  // Persist split ratio to localStorage
  useEffect(() => {
    localStorage.setItem(`split-ratio:${projectId}`, String(splitRatio));
  }, [splitRatio, projectId]);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    if (rafId.current !== null) return;

    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let ratio = (e.clientX - rect.left) / rect.width;
      ratio = Math.max(MIN_LEFT_RATIO, Math.min(MAX_LEFT_RATIO, ratio));
      setSplitRatio(ratio);
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(getDefaultRatio(window.innerWidth));
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  if (isMobile) {
    return <MobileTabBar projectId={projectId} />;
  }

  return (
    <div
      ref={containerRef}
      data-testid="workspace-container"
      className="flex h-screen"
    >
      {/* Left panel — ChatPanel placeholder */}
      <div
        data-testid="left-panel"
        style={{ width: `${splitRatio * 100}%` }}
        className="flex-shrink-0 overflow-hidden"
      >
        <div className="h-full flex flex-col">
          {/* ChatPanel placeholder — Phase 5.2 Agent B */}
        </div>
      </div>

      <ResizableSplitter
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />

      {/* Right panel — InfoPanel placeholder */}
      <div
        data-testid="right-panel"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
        className="flex-1 overflow-hidden"
      >
        <div className="h-full bg-background border-l" />
      </div>
    </div>
  );
}

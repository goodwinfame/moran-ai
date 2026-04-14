"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCharacterGraph, type GraphNode, type GraphEdge } from "@/hooks/use-characters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, RefreshCw } from "lucide-react";

interface RelationshipGraphProps {
  projectId: string | null;
}

const roleLabels: Record<string, string> = {
  protagonist: "主角",
  antagonist: "反派",
  supporting: "配角",
  minor: "龙套",
};

export function RelationshipGraph({ projectId }: RelationshipGraphProps) {
  const { nodes, edges, loading, error, refetch } = useCharacterGraph(projectId);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<unknown>(null);

  const renderGraph = useCallback(async (graphNodes: GraphNode[], graphEdges: GraphEdge[]) => {
    if (!containerRef.current || graphNodes.length === 0) return;

    // Dynamic import — Cytoscape is large, only load when needed
    const cytoscape = (await import("cytoscape")).default;

    // Destroy previous instance
    if (cyRef.current) {
      (cyRef.current as { destroy: () => void }).destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graphNodes.map((n) => ({
          data: { id: n.id, label: n.label, role: n.role, color: n.color },
        })),
        ...graphEdges.map((e) => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)" as unknown as string,
            label: "data(label)",
            "text-valign": "bottom",
            "text-halign": "center",
            "font-size": "12px",
            color: "#e2e8f0",
            "text-outline-color": "#1a202c",
            "text-outline-width": 2,
            width: 40,
            height: 40,
            "border-width": 2,
            "border-color": "#4a5568",
          } as Record<string, unknown>,
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#718096",
            "line-color": "#718096",
            width: 2,
            label: "data(label)",
            "font-size": "10px",
            color: "#a0aec0",
            "text-outline-color": "#1a202c",
            "text-outline-width": 1,
            "text-rotation": "autorotate",
          } as Record<string, unknown>,
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#63b3ed",
          } as Record<string, unknown>,
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.5,
      } as unknown as cytoscape.LayoutOptions,
    });

    cyRef.current = cy;
  }, []);

  useEffect(() => {
    if (!loading && nodes.length > 0) {
      void renderGraph(nodes, edges);
    }

    return () => {
      if (cyRef.current) {
        (cyRef.current as { destroy: () => void }).destroy();
        cyRef.current = null;
      }
    };
  }, [nodes, edges, loading, renderGraph]);

  if (!projectId) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">请先选择项目</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          人物关系图
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{nodes.length} 角色</Badge>
          <Badge variant="outline">{edges.length} 关系</Badge>
          <button
            onClick={() => void refetch()}
            className="rounded p-1 hover:bg-accent"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">暂无角色数据</p>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full w-full" data-testid="cytoscape-container" />
            <div className="flex gap-3 border-t px-4 py-2">
              {Object.entries(roleLabels).map(([role, label]) => {
                const roleColors: Record<string, string> = {
                  protagonist: "#e53e3e",
                  antagonist: "#805ad5",
                  supporting: "#3182ce",
                  minor: "#718096",
                };
                return (
                  <div key={role} className="flex items-center gap-1 text-xs">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: roleColors[role] ?? "#718096" }}
                    />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

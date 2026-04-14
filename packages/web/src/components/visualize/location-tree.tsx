"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLocations, type LocationTreeNode } from "@/hooks/use-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, RefreshCw } from "lucide-react";

interface LocationTreeProps {
  projectId: string | null;
}

const typeLabels: Record<string, string> = {
  realm: "界",
  region: "域",
  city: "城",
  area: "区",
  building: "建筑",
  custom: "自定义",
};

const typeColors: Record<string, string> = {
  realm: "#e53e3e",
  region: "#dd6b20",
  city: "#38a169",
  area: "#3182ce",
  building: "#805ad5",
  custom: "#718096",
};

export function LocationTree({ projectId }: LocationTreeProps) {
  const { tree, flat, loading, error, refetch } = useLocations(projectId);
  const svgRef = useRef<SVGSVGElement>(null);

  const renderTree = useCallback(async (treeData: LocationTreeNode[]) => {
    if (!svgRef.current || treeData.length === 0) return;

    const d3 = await import("d3");
    // Re-check after async import — ref may have gone null (e.g. component unmounted)
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 500;

    // Build hierarchy — if multiple roots, wrap in a virtual root
    const rootData: LocationTreeNode =
      treeData.length === 1 && treeData[0]
        ? treeData[0]
        : { id: "virtual-root", name: "世界", type: "realm" as const, description: "", children: treeData };

    const root = d3.hierarchy(rootData);
    const treeLayout = d3.tree<LocationTreeNode>().size([height - 80, width - 200]);
    const treeRoot = treeLayout(root);

    const g = svg
      .append("g")
      .attr("transform", "translate(80, 40)");

    // Links
    g.selectAll(".link")
      .data(treeRoot.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#4a5568")
      .attr("stroke-width", 1.5)
      .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<LocationTreeNode>, d3.HierarchyPointNode<LocationTreeNode>>()
        .x((d) => d.y)
        .y((d) => d.x));

    // Nodes
    const node = g.selectAll(".node")
      .data(treeRoot.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", 8)
      .attr("fill", (d) => typeColors[d.data.type] ?? "#718096")
      .attr("stroke", "#2d3748")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dx", 14)
      .attr("dy", 4)
      .attr("font-size", "12px")
      .attr("fill", "#e2e8f0")
      .text((d) => d.data.id === "virtual-root" ? "" : d.data.name);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom);
  }, []);

  useEffect(() => {
    if (!loading && tree.length > 0) {
      void renderTree(tree);
    }
  }, [tree, loading, renderTree]);

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
          <MapPin className="h-4 w-4" />
          地点层级树
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{flat.length} 地点</Badge>
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
        {tree.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">暂无地点数据</p>
          </div>
        ) : (
          <>
            <svg ref={svgRef} className="h-full w-full" data-testid="d3-container" />
            <div className="flex gap-3 border-t px-4 py-2">
              {Object.entries(typeLabels).map(([type, label]) => (
                <div key={type} className="flex items-center gap-1 text-xs">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: typeColors[type] ?? "#718096" }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, NodeProps, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type { Character } from "@/stores/panel-store-types";

const ROLE_LABELS: Record<string, string> = {
  protagonist: "主角",
  deuteragonist: "第二主角",
  antagonist: "对手",
  supporting: "配角",
  minor: "次要",
};

const CharacterNode = ({ data }: NodeProps) => {
  const isCore = data.designTier === "核心层";
  return (
    <div 
      className={cn(
        "bg-background rounded-xl p-3 shadow-md min-w-[120px] text-center border-2 transition-transform hover:-translate-y-1 hover:shadow-lg relative",
        isCore ? "border-primary shadow-primary/10" : "border-border/50"
      )}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-primary border-none" />
      
      {isCore && (
        <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </span>
      )}
      
      <div className="w-12 h-12 bg-secondary rounded-full mx-auto border-2 border-background flex items-center justify-center text-2xl shadow-inner mb-2 z-10 relative">
        {"👤"}
      </div>
      <div className="text-sm font-black text-foreground">{data.name as string}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">
        {ROLE_LABELS[data.role as string] || (data.role as string)}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary border-none" />
    </div>
  );
};

const nodeTypes = { character: CharacterNode };

function buildGraphData(characters: Character[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Simple circle layout logic
  const cx = 300;
  const cy = 200;
  const r = 200;

  characters.forEach((char, index) => {
    const angle = (index / characters.length) * 2 * Math.PI;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    nodes.push({
      id: char.id,
      type: "character",
      position: { x, y },
      data: {
        name: char.name,
        role: char.role,
        designTier: char.designTier,
      },
    });

    // Store Character.relationships is a string, not an array.
    // Edge building requires structured relationship data from future API.
    // For now, nodes are rendered without edges.
  });

  return { nodes, edges };
}

export function RelationshipGraphInner({ characters }: { characters: Character[] }) {
  const { nodes, edges } = useMemo(() => buildGraphData(characters), [characters]);

  return (
    <div className="h-[400px] border border-border/50 rounded-xl overflow-hidden bg-background relative">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--primary)/0.05)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        className="z-10"
      >
        <Background gap={12} size={1} color="hsl(var(--primary)/0.1)" />
        <Controls className="bg-background border-border/50 fill-foreground shadow-sm rounded-lg overflow-hidden" />
        <MiniMap 
          nodeColor={(node) => {
            return node.data?.designTier === "核心层" ? "hsl(var(--primary))" : "hsl(var(--muted))";
          }}
          maskColor="hsl(var(--background)/0.7)"
          className="bg-background border-border/50 rounded-lg shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}

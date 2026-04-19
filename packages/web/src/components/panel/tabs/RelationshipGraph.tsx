"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { Character } from "@/stores/panel-store-types";

const RelationshipGraphInner = dynamic(
  () => import("./RelationshipGraphInner").then((mod) => mod.RelationshipGraphInner),
  { 
    ssr: false, 
    loading: () => <div className="h-[400px] border rounded-lg animate-pulse bg-secondary flex items-center justify-center text-muted-foreground text-sm">加载关系图...</div> 
  }
);

export function RelationshipGraph({ characters }: { characters: Character[] }) {
  return <RelationshipGraphInner characters={characters} />;
}

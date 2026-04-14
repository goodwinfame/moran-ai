"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface LocationTreeNode {
  id: string;
  name: string;
  type: "realm" | "region" | "city" | "area" | "building" | "custom";
  description: string;
  children: LocationTreeNode[];
}

export interface LocationFlat {
  id: string;
  name: string;
  parentId: string | null;
  type: LocationTreeNode["type"];
  description: string;
  attributes: Record<string, string>;
}

interface LocationsResponse {
  tree: LocationTreeNode[];
  flat: LocationFlat[];
  total: number;
}

// ── Hook ───────────────────────────────────────────

export function useLocations(projectId: string | null) {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [flat, setFlat] = useState<LocationFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!projectId) {
      setTree([]);
      setFlat([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<LocationsResponse>(
        `/api/projects/${projectId}/locations`,
      );
      setTree(data.tree);
      setFlat(data.flat);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载地点数据失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  return { tree, flat, loading, error, refetch: fetchLocations };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────

export interface CharacterDNA {
  ghost: string;
  wound: string;
  lie: string;
  want: string;
  need: string;
  arcType: "positive" | "negative" | "flat" | "corruption";
  defaultMode: string;
  stressResponse: string;
  tell: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  description: string;
  personality: string;
  background: string;
  goals: string[];
  firstAppearance: number | null;
  arc: string | null;
  profileContent: string | null;
  dna: CharacterDNA | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  role: string;
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  description: string;
}

interface CharacterListResponse {
  characters: Character[];
  total: number;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Hook: Character List ─────────────────────────

export function useCharacters(projectId: string | null) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacters = useCallback(async () => {
    if (!projectId) {
      setCharacters([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<CharacterListResponse>(
        `/api/projects/${projectId}/characters`,
      );
      setCharacters(data.characters);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载角色列表失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchCharacters();
  }, [fetchCharacters]);

  const createCharacter = useCallback(
    async (data: { name: string; role?: Character["role"]; description?: string }) => {
      if (!projectId) return null;
      try {
        const result = await api.post<Character>(
          `/api/projects/${projectId}/characters`,
          data,
        );
        await fetchCharacters();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "创建角色失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchCharacters],
  );

  const updateCharacter = useCallback(
    async (charId: string, data: Partial<Character>) => {
      if (!projectId) return null;
      try {
        const result = await api.put<Character>(
          `/api/projects/${projectId}/characters/${charId}`,
          data,
        );
        await fetchCharacters();
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "更新角色失败";
        setError(msg);
        return null;
      }
    },
    [projectId, fetchCharacters],
  );

  const deleteCharacter = useCallback(
    async (charId: string) => {
      if (!projectId) return;
      try {
        await api.delete(`/api/projects/${projectId}/characters/${charId}`);
        await fetchCharacters();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "删除角色失败";
        setError(msg);
      }
    },
    [projectId, fetchCharacters],
  );

  return { characters, loading, error, refetch: fetchCharacters, createCharacter, updateCharacter, deleteCharacter };
}

// ── Hook: Character Graph ────────────────────────

export function useCharacterGraph(projectId: string | null) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!projectId) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<GraphResponse>(
        `/api/projects/${projectId}/characters/graph`,
      );
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载关系图失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchGraph();
  }, [fetchGraph]);

  return { nodes, edges, loading, error, refetch: fetchGraph };
}

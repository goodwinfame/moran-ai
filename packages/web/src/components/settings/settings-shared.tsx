"use client";

import * as React from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

export const STYLE_OPTIONS = [
  { value: "云墨", label: "执笔·云墨", desc: "均衡万用、自然流畅" },
  { value: "剑心", label: "执笔·剑心", desc: "冷峻简约、短句、白描、动作化叙事" },
  { value: "星河", label: "执笔·星河", desc: "精确、技术感、理性叙述" },
  { value: "素手", label: "执笔·素手", desc: "温暖细腻、长句、情感细写、氛围渲染" },
  { value: "烟火", label: "执笔·烟火", desc: "市井烟火气、口语化、快节奏" },
  { value: "暗棋", label: "执笔·暗棋", desc: "层层递进、信息控制、悬念留白" },
  { value: "青史", label: "执笔·青史", desc: "典雅庄重、文白混用、时代语感" },
  { value: "夜阑", label: "执笔·夜阑", desc: "压抑、感官描写密集、心理暗示" },
  { value: "谐星", label: "执笔·谐星", desc: "轻快、节奏明快、反差幽默" },
];

export const MODEL_OPTIONS = [
  "claude-sonnet-4",
  "kimi-k2",
  "gpt-4o",
  "claude-opus",
  "gemma4",
];

// ── Shared Types ───────────────────────────────────────────────────────────────

export interface SectionStatus {
  success: boolean;
  error: string | null;
}

// ── Inline status message ──────────────────────────────────────────────────────

export function SaveStatus({ success, error }: { success: boolean; error: string | null }) {
  if (error) {
    return <p className="text-xs text-destructive mt-1" role="alert">{error}</p>;
  }
  if (success) {
    return <p className="text-xs text-green-600 mt-1" role="status">已保存</p>;
  }
  return null;
}

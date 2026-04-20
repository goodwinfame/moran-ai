import type { ServiceResult } from "./types.js";
import * as outlineService from "./outline.service.js";
import * as worldService from "./world.service.js";
import * as characterService from "./character.service.js";
import * as summaryService from "./summary.service.js";
import * as styleService from "./style.service.js";
import * as lessonService from "./lesson.service.js";
import * as threadService from "./thread.service.js";
import * as chapterService from "./chapter.service.js";

export interface ContextPayload {
  brief: string;
  worldContext: string;
  characterStates: string;
  previousSummary: string | null;
  styleConfig: string;
  lessons: string[];
  threads: string[];
  arcContext: string;
  tokenBudget: Record<string, number>;
}

const BUDGET_WRITE: Record<string, number> = {
  brief: 4000,
  previousSummary: 8000,
  worldContext: 6000,
  characterStates: 8000,
  threads: 4000,
  styleConfig: 3000,
  lessons: 2000,
  arcContext: 4000,
};

const BUDGET_REVISE: Record<string, number> = {
  brief: 4000,
  styleConfig: 3000,
  lessons: 2000,
};

const BUDGET_REWRITE: Record<string, number> = {
  brief: 4000,
  previousSummary: 6000,
  worldContext: 5000,
  characterStates: 6000,
  threads: 3000,
  styleConfig: 3000,
  lessons: 2000,
  arcContext: 4000,
};

function getBudget(mode: "write" | "revise" | "rewrite"): Record<string, number> {
  if (mode === "revise") return BUDGET_REVISE;
  if (mode === "rewrite") return BUDGET_REWRITE;
  return BUDGET_WRITE;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... [已截断]";
}

function formatBriefData(data: {
  type: string | null | undefined;
  hardConstraints: unknown;
  softGuidance: unknown;
  freeZone: string[] | null | undefined;
  emotionalLandmine: string | null | undefined;
  scenesSequelStructure: unknown;
}): string {
  const parts: string[] = [];
  if (data.type) parts.push(`[类型: ${data.type}]`);
  if (data.hardConstraints != null) {
    parts.push(`硬性约束:\n${JSON.stringify(data.hardConstraints)}`);
  }
  if (data.softGuidance != null) {
    parts.push(`软性指引:\n${JSON.stringify(data.softGuidance)}`);
  }
  if (data.freeZone && data.freeZone.length > 0) {
    parts.push(`自由区:\n${data.freeZone.join("\n")}`);
  }
  if (data.emotionalLandmine) {
    parts.push(`情感地雷:\n${data.emotionalLandmine}`);
  }
  if (data.scenesSequelStructure != null) {
    parts.push(`场景结构:\n${JSON.stringify(data.scenesSequelStructure)}`);
  }
  return parts.length > 0 ? parts.join("\n\n") : "(空 brief)";
}

export async function assemble(
  projectId: string,
  chapterNumber: number,
  mode: "write" | "revise" | "rewrite" = "write",
): Promise<ServiceResult<ContextPayload>> {
  const budget = getBudget(mode);

  // Gate 1: outline must exist
  const outlineResult = await outlineService.readOutline(projectId);
  if (!outlineResult.ok) {
    return { ok: false, error: { code: "NOT_FOUND", message: "大纲不存在" } };
  }

  // Gate 2: chapter brief must exist
  const briefResult = await chapterService.readBrief(projectId, chapterNumber);
  if (!briefResult.ok) {
    return { ok: false, error: { code: "NOT_FOUND", message: "该章节的 Brief 不存在" } };
  }

  const briefText = truncate(formatBriefData(briefResult.data), budget.brief ?? 4000);

  // Revise mode: minimal context only
  if (mode === "revise") {
    const [styleRes, lessonsRes] = await Promise.allSettled([
      styleService.list(projectId),
      lessonService.list(projectId, "active"),
    ]);

    const styleConfig =
      styleRes.status === "fulfilled" && styleRes.value.ok
        ? truncate(
            styleRes.value.data[0]?.proseGuide ??
              styleRes.value.data[0]?.description ??
              "",
            budget.styleConfig ?? 3000,
          )
        : "";

    const lessons =
      lessonsRes.status === "fulfilled" && lessonsRes.value.ok
        ? lessonsRes.value.data.map((l) => `${l.title} → ${l.description}`)
        : [];

    return {
      ok: true,
      data: {
        brief: briefText,
        worldContext: "",
        characterStates: "",
        previousSummary: null,
        styleConfig,
        lessons,
        threads: [],
        arcContext: "",
        tokenBudget: budget,
      },
    };
  }

  // Write / Rewrite mode: full parallel fetch
  const [worldRes, charRes, summaryRes, styleRes, lessonsRes, threadsRes, arcsRes] =
    await Promise.allSettled([
      worldService.listSettings(projectId),
      characterService.list(projectId),
      summaryService.listChapterSummaries(projectId),
      styleService.list(projectId),
      lessonService.list(projectId, "active"),
      threadService.list(projectId),
      outlineService.listArcs(projectId),
    ]);

  // worldContext
  const worldContext =
    worldRes.status === "fulfilled" && worldRes.value.ok
      ? truncate(
          worldRes.value.data
            .map(
              (s) =>
                `[${s.section}${s.name ? ` - ${s.name}` : ""}]\n${s.content}`,
            )
            .join("\n---\n"),
          budget.worldContext ?? 6000,
        )
      : "";

  // characterStates — character profiles as writing context
  const characterStates =
    charRes.status === "fulfilled" && charRes.value.ok
      ? truncate(
          charRes.value.data
            .map(
              (c) =>
                `${c.name}${c.role ? ` [${c.role}]` : ""}${c.description ? `: ${c.description}` : ""}`,
            )
            .join("\n"),
          budget.characterStates ?? 8000,
        )
      : "";

  // previousSummary — null for chapter 1
  let previousSummary: string | null = null;
  if (
    chapterNumber > 1 &&
    summaryRes.status === "fulfilled" &&
    summaryRes.value.ok
  ) {
    const prevSummaries = summaryRes.value.data.filter(
      (s) => s.chapterNumber < chapterNumber,
    );
    if (prevSummaries.length > 0) {
      previousSummary = truncate(
        prevSummaries
          .map((s) => `第${s.chapterNumber}章：${s.content}`)
          .join("\n\n"),
        budget.previousSummary ?? 8000,
      );
    }
  }

  // styleConfig
  const styleData =
    styleRes.status === "fulfilled" && styleRes.value.ok
      ? styleRes.value.data
      : [];
  const styleConfig = truncate(
    styleData[0]?.proseGuide ?? styleData[0]?.description ?? "",
    budget.styleConfig ?? 3000,
  );

  // lessons
  const lessons =
    lessonsRes.status === "fulfilled" && lessonsRes.value.ok
      ? lessonsRes.value.data.map((l) => `${l.title} → ${l.description}`)
      : [];

  // threads — active only (exclude resolved and stale)
  const threads =
    threadsRes.status === "fulfilled" && threadsRes.value.ok
      ? threadsRes.value.data
          .filter((t) => t.status !== "resolved" && t.status !== "stale")
          .map((t) => `${t.name}: ${t.description ?? ""}`)
      : [];

  // arcContext — arc containing this chapter
  const allArcs =
    arcsRes.status === "fulfilled" && arcsRes.value.ok
      ? arcsRes.value.data
      : [];
  const currentArc = allArcs.find(
    (arc) =>
      arc.startChapter !== null &&
      arc.endChapter !== null &&
      arc.startChapter <= chapterNumber &&
      chapterNumber <= arc.endChapter,
  );

  const arcContext = currentArc
    ? truncate(
        [
          `弧段: ${currentArc.title ?? "(无标题)"}`,
          `范围: 第${currentArc.startChapter}章 - 第${currentArc.endChapter}章`,
          currentArc.description ? `描述: ${currentArc.description}` : null,
          currentArc.detailedPlan
            ? `详细计划:\n${currentArc.detailedPlan}`
            : null,
        ]
          .filter((x): x is string => x !== null)
          .join("\n"),
        budget.arcContext ?? 4000,
      )
    : "";

  return {
    ok: true,
    data: {
      brief: briefText,
      worldContext,
      characterStates,
      previousSummary,
      styleConfig,
      lessons,
      threads,
      arcContext,
      tokenBudget: budget,
    },
  };
}

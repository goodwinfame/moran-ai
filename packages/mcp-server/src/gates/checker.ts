/**
 * Gate checker — verifies prerequisite conditions for MCP tool operations.
 *
 * Two levels of gating:
 * 1. Phase gate: Is this domain allowed at the current project status? (via gateService in core)
 * 2. Prerequisite gate: Are the specific data prerequisites met? (this module)
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";
import { worldSettings } from "@moran/core/db/schema";
import { characters } from "@moran/core/db/schema";
import { characterRelationships } from "@moran/core/db/schema";
import { outlines } from "@moran/core/db/schema";
import { styleConfigs } from "@moran/core/db/schema";
import { chapterBriefs, chapters } from "@moran/core/db/schema";
import type { GateDetails } from "../types.js";
import {
  reviewService,
  outlineService,
  chapterService as chapterSvc,
  characterService as charSvc,
} from "@moran/core/services";

export interface GateCondition {
  description: string;
  level: "HARD" | "SOFT" | "INFO";
  met: boolean;
  suggestion?: string;
}

export interface GateResult {
  passed: boolean;
  conditions: GateCondition[];
}

// ── Prerequisite check helpers ──

async function hasBrainstormBrief(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: projectDocuments.id })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.projectId, projectId),
        eq(projectDocuments.category, "brainstorm"),
      ),
    )
    .limit(1);
  return !!row;
}

async function hasBaseWorldSetting(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: worldSettings.id })
    .from(worldSettings)
    .where(
      and(
        eq(worldSettings.projectId, projectId),
        eq(worldSettings.section, "base"),
      ),
    )
    .limit(1);
  return !!row;
}

async function hasAnyWorldSetting(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: worldSettings.id })
    .from(worldSettings)
    .where(eq(worldSettings.projectId, projectId))
    .limit(1);
  return !!row;
}

async function hasSubsystem(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: worldSettings.id })
    .from(worldSettings)
    .where(
      and(
        eq(worldSettings.projectId, projectId),
        eq(worldSettings.section, "subsystem"),
      ),
    )
    .limit(1);
  return !!row;
}

async function countMainCharacters(projectId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.projectId, projectId));
  // Count protagonist, deuteragonist, antagonist
  return rows.length;
}

async function hasRelationship(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: characterRelationships.id })
    .from(characterRelationships)
    .where(eq(characterRelationships.projectId, projectId))
    .limit(1);
  return !!row;
}

async function hasOutline(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: outlines.id })
    .from(outlines)
    .where(eq(outlines.projectId, projectId))
    .limit(1);
  return !!row;
}

async function hasStyle(projectId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: styleConfigs.id })
    .from(styleConfigs)
    .where(eq(styleConfigs.projectId, projectId))
    .limit(1);
  return !!row;
}

async function hasChapterBrief(
  projectId: string,
  chapterNumber: number,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: chapterBriefs.id })
    .from(chapterBriefs)
    .where(
      and(
        eq(chapterBriefs.projectId, projectId),
        eq(chapterBriefs.chapterNumber, chapterNumber),
      ),
    )
    .limit(1);
  return !!row;
}

async function hasChapter(
  projectId: string,
  chapterNumber: number,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(
      and(
        eq(chapters.projectId, projectId),
        eq(chapters.chapterNumber, chapterNumber),
      ),
    )
    .limit(1);
  return !!row;
}

// ── Service-based prerequisite helpers ──

async function hasReviewPassed(
  projectId: string,
  chapterNumber: number,
): Promise<boolean> {
  const result = await reviewService.isChapterPassed(projectId, chapterNumber);
  return result.ok && result.data.passed;
}

async function hasReviewReport(
  projectId: string,
  chapterNumber: number,
): Promise<boolean> {
  const result = await reviewService.readByChapter(projectId, chapterNumber);
  return result.ok && result.data.length > 0;
}

async function areArcChaptersArchived(
  projectId: string,
  arcIndex: number,
): Promise<boolean> {
  const arcResult = await outlineService.readArc(projectId, arcIndex);
  if (!arcResult.ok) return false;
  const { startChapter, endChapter } = arcResult.data;
  if (startChapter == null || endChapter == null) return false;

  const chaptersResult = await chapterSvc.list(projectId);
  if (!chaptersResult.ok) return false;

  const arcChapters = chaptersResult.data.filter(
    (c) => c.chapterNumber >= startChapter && c.chapterNumber <= endChapter,
  );
  if (arcChapters.length === 0) return false;

  // All chapters in range must be archived
  const expectedCount = endChapter - startChapter + 1;
  return (
    arcChapters.length === expectedCount &&
    arcChapters.every((c) => c.status === "archived")
  );
}

async function isCharacterInArchivedChapters(
  projectId: string,
  characterId: string,
): Promise<boolean> {
  const statesResult = await charSvc.listStates(characterId);
  if (!statesResult.ok || statesResult.data.length === 0) return false;

  const chaptersResult = await chapterSvc.list(projectId);
  if (!chaptersResult.ok) return false;

  const archivedChapterNumbers = new Set(
    chaptersResult.data
      .filter((c) => c.status === "archived")
      .map((c) => c.chapterNumber),
  );

  return statesResult.data.some((s) => archivedChapterNumbers.has(s.chapterNumber));
}

// ── Gate check for specific actions ──

type GateAction =
  | "brainstorm"
  | "world_design"
  | "character_design"
  | "outline_design"
  | "style_design"
  | "chapter_write"
  | "review"
  | "archive"
  | "analysis"
  | "timeline_record"
  | "thread_plant"
  | "thread_advance"
  | "summary_chapter"
  | "summary_arc"
  | "chapter_revise"
  | "character_state_record"
  | "character_remove";

export async function checkPrerequisites(
  projectId: string,
  action: string,
  params?: Record<string, unknown>,
): Promise<GateResult> {
  const conditions: GateCondition[] = [];

  switch (action as GateAction) {
    case "brainstorm":
      // No prerequisites for brainstorming
      break;

    case "world_design": {
      const brief = await hasBrainstormBrief(projectId);
      conditions.push({
        description: "创意简报已存在",
        level: "HARD",
        met: brief,
        suggestion: brief ? undefined : "请先使用灵犀完成创意简报（brainstorm_create type=brief）",
      });
      break;
    }

    case "character_design": {
      const brief = await hasBrainstormBrief(projectId);
      conditions.push({
        description: "创意简报已存在",
        level: "HARD",
        met: brief,
        suggestion: brief ? undefined : "请先完成创意简报",
      });
      const baseSetting = await hasBaseWorldSetting(projectId);
      conditions.push({
        description: "基础世界设定已存在",
        level: "HARD",
        met: baseSetting,
        suggestion: baseSetting ? undefined : "请先创建基础世界设定（world_create section=base）",
      });
      const subsystem = await hasSubsystem(projectId);
      conditions.push({
        description: "至少一个力量体系子系统已定义",
        level: "SOFT",
        met: subsystem,
        suggestion: subsystem ? undefined : "建议先定义力量体系子系统",
      });
      break;
    }

    case "outline_design": {
      const brief = await hasBrainstormBrief(projectId);
      conditions.push({
        description: "创意简报已存在",
        level: "HARD",
        met: brief,
        suggestion: brief ? undefined : "请先完成创意简报",
      });
      const baseSetting = await hasBaseWorldSetting(projectId);
      conditions.push({
        description: "基础世界设定已存在",
        level: "HARD",
        met: baseSetting,
        suggestion: baseSetting ? undefined : "请先创建基础世界设定",
      });
      const charCount = await countMainCharacters(projectId);
      conditions.push({
        description: "至少2个主要角色已定义",
        level: "HARD",
        met: charCount >= 2,
        suggestion: charCount >= 2 ? undefined : `当前仅${charCount}个角色，需要至少2个`,
      });
      const rel = await hasRelationship(projectId);
      conditions.push({
        description: "至少1个角色关系已建立",
        level: "HARD",
        met: rel,
        suggestion: rel ? undefined : "请先建立角色关系（relationship_create）",
      });
      break;
    }

    case "style_design": {
      const brief = await hasBrainstormBrief(projectId);
      conditions.push({
        description: "创意简报已存在",
        level: "HARD",
        met: brief,
        suggestion: brief ? undefined : "请先完成创意简报",
      });
      break;
    }

    case "chapter_write": {
      const outline = await hasOutline(projectId);
      conditions.push({
        description: "大纲已存在",
        level: "HARD",
        met: outline,
        suggestion: outline ? undefined : "请先创建大纲（outline_create）",
      });
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const briefExists = await hasChapterBrief(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章 Plantser Brief 已定义`,
        level: "HARD",
        met: briefExists,
        suggestion: briefExists ? undefined : "请先定义章节详案（outline_update + chapterBrief）",
      });
      const style = await hasStyle(projectId);
      conditions.push({
        description: "文风配置已确定",
        level: "HARD",
        met: style,
        suggestion: style ? undefined : "请先配置文风（style_create）",
      });
      break;
    }

    case "review": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const chapterExists = await hasChapter(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章内容已存在`,
        level: "HARD",
        met: chapterExists,
        suggestion: chapterExists ? undefined : "该章节尚未写作",
      });
      break;
    }

    case "archive": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const chapterExists = await hasChapter(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章内容已存在`,
        level: "HARD",
        met: chapterExists,
        suggestion: chapterExists ? undefined : "该章节尚未写作",
      });
      // Review must be passed for archive
      const reviewPassed = await hasReviewPassed(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章审校已通过（四轮全部完成）`,
        level: "HARD",
        met: reviewPassed,
        suggestion: reviewPassed ? undefined : "该章节审校尚未通过（需四轮全部通过）",
      });
      break;
    }

    case "analysis": {
      const anySetting = await hasAnyWorldSetting(projectId);
      conditions.push({
        description: "至少有内容可供分析",
        level: "HARD",
        met: anySetting,
        suggestion: anySetting ? undefined : "项目尚无内容可分析",
      });
      break;
    }

    case "timeline_record": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const reviewPassed = await hasReviewPassed(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章审校已通过`,
        level: "HARD",
        met: reviewPassed,
        suggestion: reviewPassed ? undefined : "该章节审校尚未通过，请先完成四轮审校",
      });
      break;
    }

    case "thread_plant": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const chapterExists = await hasChapter(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章内容已存在`,
        level: "HARD",
        met: chapterExists,
        suggestion: chapterExists ? undefined : "伏笔必须在已有内容的章节中埋设",
      });
      break;
    }

    case "thread_advance": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const reviewPassed = await hasReviewPassed(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章审校已通过`,
        level: "HARD",
        met: reviewPassed,
        suggestion: reviewPassed ? undefined : "该章节审校尚未通过",
      });
      break;
    }

    case "summary_chapter": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const reviewPassed = await hasReviewPassed(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章审校已通过（四轮完成）`,
        level: "HARD",
        met: reviewPassed,
        suggestion: reviewPassed ? undefined : "请先完成四轮审校后再创建摘要",
      });
      break;
    }

    case "summary_arc": {
      const arcIdx = (params?.arcIndex as number) ?? 0;
      const allArchived = await areArcChaptersArchived(projectId, arcIdx);
      conditions.push({
        description: `弧段${arcIdx}内所有章节已归档`,
        level: "HARD",
        met: allArchived,
        suggestion: allArchived ? undefined : "弧段内尚有未归档章节",
      });
      break;
    }

    case "chapter_revise": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const hasReport = await hasReviewReport(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章有对应的审校报告`,
        level: "HARD",
        met: hasReport,
        suggestion: hasReport ? undefined : "该章节没有审校报告，请先执行审校",
      });
      break;
    }

    case "character_state_record": {
      const chapterNum = (params?.chapterNumber as number) ?? 1;
      const chapterExists = await hasChapter(projectId, chapterNum);
      conditions.push({
        description: `第${chapterNum}章内容已存在`,
        level: "HARD",
        met: chapterExists,
        suggestion: chapterExists ? undefined : "请先写作该章节",
      });
      break;
    }

    case "character_remove": {
      const characterId = params?.characterId as string;
      if (characterId) {
        const inArchived = await isCharacterInArchivedChapters(projectId, characterId);
        conditions.push({
          description: "该角色未在已归档章节中出场",
          level: "SOFT",
          met: !inArchived,
          suggestion: inArchived ? "该角色在已归档章节中出场，删除可能影响一致性" : undefined,
        });
      }
      break;
    }

    default:
      // Unknown action — pass through
      break;
  }

  const hardFailed = conditions.filter((c) => c.level === "HARD" && !c.met);
  return {
    passed: hardFailed.length === 0,
    conditions,
  };
}

/**
 * Convert GateResult to GateDetails for error responses.
 */
export function toGateDetails(result: GateResult): GateDetails {
  return {
    passed: result.conditions.filter((c) => c.met).map((c) => c.description),
    failed: result.conditions.filter((c) => !c.met).map((c) => c.description),
    suggestions: result.conditions
      .filter((c) => !c.met && c.suggestion)
      .map((c) => c.suggestion!),
  };
}

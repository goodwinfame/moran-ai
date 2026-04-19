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
  | "analysis";

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

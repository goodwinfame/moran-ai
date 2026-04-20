import { getDb } from "../db/index.js";
import { worldSettings } from "../db/schema/world.js";
import { eq } from "drizzle-orm";
import type { ServiceResult } from "./types.js";

type Setting = typeof worldSettings.$inferSelect;

interface ConsistencyIssue {
  type: "contradiction" | "missing_reference" | "orphan" | "circular";
  severity: "critical" | "major" | "minor";
  description: string;
  sources: string[];
  suggestion: string;
}

interface ConsistencyReport {
  passed: boolean;
  issues: ConsistencyIssue[];
  summary: {
    totalSettings: number;
    checkedRules: number;
    issueCount: number;
  };
}

const CHECKED_RULES = 4;

// Rule 1: Empty/short content (< 20 chars)
function checkShortContent(settings: Setting[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  for (const setting of settings) {
    const content = setting.content;
    if (content.length < 20) {
      const displayName = setting.name ?? setting.section;
      issues.push({
        type: "missing_reference",
        severity: "minor",
        description: `设定「${displayName}」内容过短（${content.length} 字符），建议补充详情`,
        sources: [setting.id],
        suggestion: "请补充该设定的详细描述",
      });
    }
  }
  return issues;
}

// Rule 2: Duplicate names within same section (type)
function checkDuplicateNames(settings: Setting[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const bySectionName = new Map<string, Map<string, Setting[]>>();

  for (const setting of settings) {
    if (!setting.name) continue;
    if (!bySectionName.has(setting.section)) {
      bySectionName.set(setting.section, new Map());
    }
    const nameMap = bySectionName.get(setting.section)!;
    const existing = nameMap.get(setting.name) ?? [];
    nameMap.set(setting.name, [...existing, setting]);
  }

  for (const [section, nameMap] of bySectionName) {
    for (const [name, dupes] of nameMap) {
      if (dupes.length > 1) {
        issues.push({
          type: "contradiction",
          severity: "major",
          description: `发现重复设定名称「${name}」（类型：${section}），共 ${dupes.length} 条`,
          sources: dupes.map((s) => s.id),
          suggestion: "请合并或重命名重复的设定条目",
        });
      }
    }
  }
  return issues;
}

// Rule 3: Cross-reference check — terms in 「」that don't match any setting name
function checkCrossReferences(settings: Setting[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const allNames = new Set(
    settings.map((s) => s.name).filter((n): n is string => n !== null),
  );

  for (const setting of settings) {
    const termMatches = setting.content.matchAll(/「([^」]+)」/g);
    for (const match of termMatches) {
      const term = match[1];
      if (term === undefined) continue;
      if (!allNames.has(term)) {
        const displayName = setting.name ?? setting.section;
        issues.push({
          type: "orphan",
          severity: "minor",
          description: `设定「${displayName}」引用了「${term}」，但未找到对应设定`,
          sources: [setting.id],
          suggestion: `请创建关于「${term}」的设定，或修正引用`,
        });
      }
    }
  }
  return issues;
}

// Rule 4: Isolated settings — not referenced by any other setting, and not a base "setting" section
function checkIsolatedSettings(settings: Setting[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  for (const setting of settings) {
    if (!setting.name) continue;
    if (setting.section === "setting") continue;
    const isReferenced = settings.some(
      (other) => other.id !== setting.id && other.content.includes(setting.name!),
    );
    if (!isReferenced) {
      issues.push({
        type: "orphan",
        severity: "minor",
        description: `设定「${setting.name}」未被其他设定引用，可能是孤立条目`,
        sources: [setting.id],
        suggestion: "请检查该设定是否需要与其他设定建立关联",
      });
    }
  }
  return issues;
}

export async function check(projectId: string): Promise<ServiceResult<ConsistencyReport>> {
  const db = getDb();
  const settings = await db
    .select()
    .from(worldSettings)
    .where(eq(worldSettings.projectId, projectId))
    .orderBy(worldSettings.sortOrder, worldSettings.createdAt);

  if (settings.length === 0) {
    return {
      ok: true,
      data: {
        passed: true,
        issues: [],
        summary: { totalSettings: 0, checkedRules: 0, issueCount: 0 },
      },
    };
  }

  const issues: ConsistencyIssue[] = [
    ...checkShortContent(settings),
    ...checkDuplicateNames(settings),
    ...checkCrossReferences(settings),
    ...checkIsolatedSettings(settings),
  ];

  const passed = !issues.some(
    (issue) => issue.severity === "critical" || issue.severity === "major",
  );

  return {
    ok: true,
    data: {
      passed,
      issues,
      summary: {
        totalSettings: settings.length,
        checkedRules: CHECKED_RULES,
        issueCount: issues.length,
      },
    },
  };
}

/**
 * Export service — generates project export content in txt or md format.
 *
 * Queries project title and chapters, then assembles content with chapter
 * headings and separators. Non-draft chapters are preferred; draft chapters
 * are used as a fallback when no non-draft chapters exist.
 */
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { chapters } from "../db/schema/chapters.js";
import { projects } from "../db/schema/projects.js";
import type { ServiceResult } from "./types.js";

// ── Service Method ─────────────────────────────────────────────────────────────

export async function exportProject(params: {
  projectId: string;
  format: "txt" | "md";
  startChapter?: number;
  endChapter?: number;
  includeTitle?: boolean;
}): Promise<ServiceResult<{ content: string; filename: string }>> {
  const db = getDb();
  const { projectId, format, startChapter, endChapter, includeTitle = true } = params;

  // 1. Query project title
  const [project] = await db
    .select({ title: projects.title })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: { code: "NOT_FOUND", message: "项目不存在" } };
  }

  // 2. Build chapter filter conditions
  const conditions = [eq(chapters.projectId, projectId)];
  if (startChapter !== undefined) conditions.push(gte(chapters.chapterNumber, startChapter));
  if (endChapter !== undefined) conditions.push(lte(chapters.chapterNumber, endChapter));

  // 3. Query chapters ordered by chapter number
  const rows = await db
    .select()
    .from(chapters)
    .where(and(...conditions))
    .orderBy(asc(chapters.chapterNumber));

  // 4. Prefer non-draft chapters with content; fallback to any chapter with content
  const nonDraftWithContent = rows.filter((ch) => ch.content && ch.status !== "draft");
  const exportChapters =
    nonDraftWithContent.length > 0 ? nonDraftWithContent : rows.filter((ch) => ch.content);

  if (exportChapters.length === 0) {
    return { ok: false, error: { code: "NOT_FOUND", message: "没有可导出的章节" } };
  }

  // 5. Assemble content string
  const parts = exportChapters.map((ch) => {
    const chapterTitle = `第 ${ch.chapterNumber} 章${ch.title ? ` ${ch.title}` : ""}`;
    const heading = format === "md" ? `# ${chapterTitle}` : chapterTitle;
    const body = ch.content ?? "";
    return includeTitle ? `${heading}\n\n${body}` : body;
  });

  const content = parts.join("\n\n---\n\n");
  const filename = `${project.title}_export.${format}`;

  return { ok: true, data: { content, filename } };
}

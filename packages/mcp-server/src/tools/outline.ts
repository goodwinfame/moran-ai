/**
 * Outline tools (4 tools).
 *
 * - outline_create: 创建大纲（含弧段划分）
 * - outline_read:   读取大纲（完整/弧段/章节详案）
 * - outline_update: 更新大纲（纲要/弧段/章节详案）
 * - outline_patch:  局部编辑大纲纲要（find/replace）
 *
 * Composite tool: outline spans outlines + arcs + chapterBriefs tables.
 * Spec arc fields → DB mapping:
 *   coreConflict → description
 *   climax, keyCharacterIds → detailedPlan (JSON)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { outlineService, chapterService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

function parseDetailedPlan(plan: string | null | undefined): Record<string, unknown> {
  if (!plan) return {};
  try {
    return JSON.parse(plan) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function registerOutlineTools(server: McpServer) {
  server.registerTool("outline_create", {
    description: "创建大纲（含弧段划分）",
    inputSchema: {
      projectId: z.string().uuid(),
      synopsis: z.string(),
      arcs: z.array(z.object({
        title: z.string(),
        startChapter: z.number().int().positive(),
        endChapter: z.number().int().positive(),
        coreConflict: z.string(),
        climax: z.string(),
        keyCharacterIds: z.array(z.string().uuid()),
      })),
    },
  }, async ({ projectId, synopsis, arcs }) => {
    const prereqs = await checkPrerequisites(projectId, "outline_design");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    const outlineResult = await outlineService.createOutline(projectId, { synopsis });
    if (!outlineResult.ok) return fromService(outlineResult);

    const arcIds: string[] = [];
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i]!;
      const arcResult = await outlineService.createArc(projectId, {
        arcIndex: i,
        title: arc.title,
        startChapter: arc.startChapter,
        endChapter: arc.endChapter,
        description: arc.coreConflict,
        detailedPlan: JSON.stringify({
          coreConflict: arc.coreConflict,
          climax: arc.climax,
          keyCharacterIds: arc.keyCharacterIds,
        }),
      });
      if (arcResult.ok) arcIds.push(arcResult.data.id);
    }

    return ok({ id: outlineResult.data.id, arcIds });
  });

  server.registerTool("outline_read", {
    description: "读取大纲：完整大纲+弧段、指定弧段、或指定章节详案",
    inputSchema: {
      projectId: z.string().uuid(),
      arcIndex: z.number().int().nonnegative().optional(),
      chapterNumber: z.number().int().positive().optional().describe("读取特定章节的 Plantser Brief"),
    },
  }, async ({ projectId, arcIndex, chapterNumber }) => {
    // Specific chapter brief
    if (chapterNumber !== undefined) {
      const briefResult = await chapterService.readBrief(projectId, chapterNumber);
      return fromService(briefResult);
    }

    // Specific arc
    if (arcIndex !== undefined) {
      const arcResult = await outlineService.readArc(projectId, arcIndex);
      if (!arcResult.ok) return fromService(arcResult);
      const plan = parseDetailedPlan(arcResult.data.detailedPlan);
      return ok({ ...arcResult.data, ...plan });
    }

    // Full outline + all arcs
    const outlineResult = await outlineService.readOutline(projectId);
    if (!outlineResult.ok) return fromService(outlineResult);

    const arcsResult = await outlineService.listArcs(projectId);
    const arcsData = arcsResult.ok
      ? arcsResult.data.map((arc) => {
          const plan = parseDetailedPlan(arc.detailedPlan);
          return { ...arc, ...plan };
        })
      : [];

    return ok({ ...outlineResult.data, arcs: arcsData });
  });

  server.registerTool("outline_update", {
    description: "更新大纲（可同时更新纲要、弧段、章节详案）",
    inputSchema: {
      projectId: z.string().uuid(),
      synopsis: z.string().optional(),
      arcIndex: z.number().int().nonnegative().optional(),
      arcData: z.object({
        title: z.string().optional(),
        startChapter: z.number().int().positive().optional(),
        endChapter: z.number().int().positive().optional(),
        coreConflict: z.string().optional(),
        climax: z.string().optional(),
      }).optional(),
      chapterBrief: z.object({
        chapterNumber: z.number().int().positive(),
        title: z.string(),
        brief: z.string(),
      }).optional(),
    },
  }, async ({ projectId, synopsis, arcIndex, arcData, chapterBrief }) => {
    // Gate: 大纲已存在
    const outlineResult = await outlineService.readOutline(projectId);
    if (!outlineResult.ok) return fail("NOT_FOUND", "大纲不存在");

    const updated: string[] = [];

    // 1. Update synopsis
    if (synopsis !== undefined) {
      const r = await outlineService.updateOutline(projectId, { synopsis });
      if (!r.ok) return fail(r.error.code, r.error.message);
      updated.push("synopsis");
    }

    // 2. Update arc
    if (arcIndex !== undefined && arcData) {
      const arcResult = await outlineService.readArc(projectId, arcIndex);
      if (!arcResult.ok) return fail("NOT_FOUND", `弧段 ${arcIndex} 不存在`);

      const dbUpdate: Record<string, unknown> = {};
      if (arcData.title !== undefined) dbUpdate.title = arcData.title;
      if (arcData.startChapter !== undefined) dbUpdate.startChapter = arcData.startChapter;
      if (arcData.endChapter !== undefined) dbUpdate.endChapter = arcData.endChapter;
      if (arcData.coreConflict !== undefined) dbUpdate.description = arcData.coreConflict;

      // Merge climax/coreConflict into detailedPlan
      if (arcData.climax !== undefined || arcData.coreConflict !== undefined) {
        const plan = parseDetailedPlan(arcResult.data.detailedPlan);
        if (arcData.climax !== undefined) plan.climax = arcData.climax;
        if (arcData.coreConflict !== undefined) plan.coreConflict = arcData.coreConflict;
        dbUpdate.detailedPlan = JSON.stringify(plan);
      }

      const r = await outlineService.updateArc(arcResult.data.id, dbUpdate);
      if (!r.ok) return fail(r.error.code, r.error.message);
      updated.push(`arc[${arcIndex}]`);
    }

    // 3. Create or update chapter brief
    if (chapterBrief) {
      const existing = await chapterService.readBrief(projectId, chapterBrief.chapterNumber);
      if (existing.ok) {
        const r = await chapterService.updateBrief(existing.data.id, {
          hardConstraints: { title: chapterBrief.title, content: chapterBrief.brief },
        });
        if (!r.ok) return fail(r.error.code, r.error.message);
      } else {
        const r = await chapterService.createBrief(projectId, {
          chapterNumber: chapterBrief.chapterNumber,
          hardConstraints: { title: chapterBrief.title, content: chapterBrief.brief },
        });
        if (!r.ok) return fail(r.error.code, r.error.message);
      }
      updated.push(`brief[ch${chapterBrief.chapterNumber}]`);
    }

    return ok({ id: outlineResult.data.id, updated });
  });

  server.registerTool("outline_patch", {
    description: "局部编辑大纲纲要内容（find/replace 替换）",
    inputSchema: {
      projectId: z.string().uuid(),
      outlineId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ projectId, patches }) => {
    const outlineResult = await outlineService.readOutline(projectId);
    if (!outlineResult.ok) return fail("NOT_FOUND", "大纲不存在");

    const original = outlineResult.data.synopsis ?? "";
    const { content, applied, failed: failedPatches } = applyPatches(original, patches);
    if (applied === 0) {
      return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });
    }

    const updateResult = await outlineService.updateOutline(projectId, { synopsis: content });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: outlineResult.data.id,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}

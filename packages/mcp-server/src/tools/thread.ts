/**
 * Thread (伏笔) tools (3 tools).
 *
 * - thread_create: 创建伏笔
 * - thread_read:   读取伏笔列表
 * - thread_update: 更新伏笔状态（推进/回收/废弃）
 *
 * Spec status mapping to DB plotThreadStatusEnum:
 *   "active"    → planted | developing
 *   "resolved"  → resolved
 *   "abandoned" → stale
 *
 * Action mapping:
 *   advance → status = "developing"
 *   resolve → status = "resolved"
 *   abandon → status = "stale"
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { threadService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";

const ACTION_STATUS_MAP: Record<string, string> = {
  advance: "developing",
  resolve: "resolved",
  abandon: "stale",
};

export function registerThreadTools(server: McpServer) {
  server.registerTool("thread_create", {
    description: "创建伏笔",
    inputSchema: {
      projectId: z.string().uuid(),
      title: z.string(),
      description: z.string(),
      plantedChapter: z.number().int().positive(),
      expectedPayoff: z.number().int().positive().optional(),
    },
  }, async ({ projectId, title, description, plantedChapter, expectedPayoff }) => {
    // TODO: HARD gate — plantedChapter 已存在内容（需 chapterService 集成）
    const result = await threadService.create(projectId, {
      name: title,
      description,
      introducedChapter: plantedChapter,
      resolvedChapter: expectedPayoff,
      status: "planted",
    });
    return fromService(result);
  });

  server.registerTool("thread_read", {
    description: "读取伏笔：可按状态过滤，或按章节读取截至该章的活跃伏笔",
    inputSchema: {
      projectId: z.string().uuid(),
      threadId: z.string().uuid().optional(),
      status: z.enum(["active", "resolved", "abandoned"]).optional(),
      chapterNumber: z.number().int().positive().optional(),
    },
  }, async ({ projectId, threadId, status, chapterNumber }) => {
    // Single thread
    if (threadId) {
      const result = await threadService.read(projectId, threadId);
      return fromService(result);
    }

    // Filter by chapter — threads planted at or before this chapter that are still active
    if (chapterNumber !== undefined) {
      const result = await threadService.list(projectId);
      if (!result.ok) return fromService(result);
      const filtered = result.data.filter(
        (t) =>
          (t.introducedChapter ?? 0) <= chapterNumber &&
          (t.status === "planted" || t.status === "developing"),
      );
      return ok(filtered);
    }

    // Filter by spec status
    if (status === "active") {
      const result = await threadService.list(projectId);
      if (!result.ok) return fromService(result);
      return ok(result.data.filter((t) => t.status === "planted" || t.status === "developing"));
    }
    if (status === "resolved") {
      return fromService(await threadService.list(projectId, "resolved"));
    }
    if (status === "abandoned") {
      return fromService(await threadService.list(projectId, "stale"));
    }

    // All threads
    return fromService(await threadService.list(projectId));
  });

  server.registerTool("thread_update", {
    description: "更新伏笔状态（推进/回收/废弃）",
    inputSchema: {
      projectId: z.string().uuid(),
      threadId: z.string().uuid(),
      action: z.enum(["advance", "resolve", "abandon"]),
      chapterNumber: z.number().int().positive(),
      note: z.string(),
    },
  }, async ({ projectId, threadId, action, chapterNumber, note }) => {
    // Verify thread exists
    const readResult = await threadService.read(projectId, threadId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const newStatus = ACTION_STATUS_MAP[action] as "developing" | "resolved" | "stale";

    // Update status + append description with action log
    const thread = readResult.data;
    const actionLog = `\n[Ch.${chapterNumber}] ${action}: ${note}`;
    const updatedDesc = (thread.description ?? "") + actionLog;

    const result = await threadService.update(threadId, {
      status: newStatus,
      description: updatedDesc,
    });
    return fromService(result);
  });
}

/**
 * Timeline tools (2 tools).
 *
 * - timeline_create: 记录时间线事件
 * - timeline_read:   读取时间线（可按章节范围/角色/地点过滤）
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { timelineService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";

export function registerTimelineTools(server: McpServer) {
  server.registerTool("timeline_create", {
    description: "记录时间线事件（批量创建）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      events: z.array(z.object({
        storyTimestamp: z.string().describe("故事内时间（如「第三天 傍晚」）"),
        description: z.string(),
        characterIds: z.array(z.string().uuid()),
        locationId: z.string().uuid().optional(),
      })).min(1),
    },
  }, async ({ projectId, chapterNumber, events }) => {
    // TODO: HARD gate — 该章节审校通过
    const ids: string[] = [];
    for (const event of events) {
      const result = await timelineService.create(projectId, {
        chapterNumber,
        storyTimestamp: event.storyTimestamp,
        description: event.description,
        characterIds: event.characterIds,
        locationId: event.locationId,
      });
      if (!result.ok) return fail(result.error.code, result.error.message);
      ids.push(result.data.id);
    }
    return ok({ ids });
  });

  server.registerTool("timeline_read", {
    description: "读取时间线事件：可按章节范围、角色、地点过滤",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterRange: z.object({
        from: z.number().int().positive(),
        to: z.number().int().positive(),
      }).optional(),
      characterId: z.string().uuid().optional(),
      locationId: z.string().uuid().optional(),
    },
  }, async ({ projectId, chapterRange, characterId, locationId }) => {
    const result = await timelineService.list(projectId);
    if (!result.ok) return fromService(result);

    let events = result.data;

    // Apply filters
    if (chapterRange) {
      events = events.filter(
        (e) =>
          e.chapterNumber != null &&
          e.chapterNumber >= chapterRange.from &&
          e.chapterNumber <= chapterRange.to,
      );
    }
    if (characterId) {
      events = events.filter((e) => {
        const ids = e.characterIds;
        return Array.isArray(ids) && (ids as string[]).includes(characterId);
      });
    }
    if (locationId) {
      events = events.filter((e) => e.locationId === locationId);
    }

    return ok(events);
  });
}

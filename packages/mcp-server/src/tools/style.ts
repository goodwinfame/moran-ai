/**
 * Style tools (3 tools).
 *
 * - style_create: 创建文风配置
 * - style_read:   读取文风配置
 * - style_update: 更新文风配置
 *
 * Spec field mapping:
 *   preset → DB styleId (子写手预设名)
 *   config (JSON) → DB description (full JSON), proseGuide/examples (extracted)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { styleService } from "@moran/core/services";
import { fail, fromService } from "../utils/response.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

interface StyleConfigInput {
  yaml?: string;
  prose?: string;
  examples?: string[];
  modelOverride?: string;
}

export function registerStyleTools(server: McpServer) {
  server.registerTool("style_create", {
    description: "创建文风配置",
    inputSchema: {
      projectId: z.string().uuid(),
      preset: z.string().optional().describe("子写手预设名（云墨/剑心/星河/素手/烟火/暗棋/青史/夜阑/谐星）"),
      config: z.string().describe("JSON：{ yaml: string, prose: string, examples: string[], modelOverride?: string }"),
    },
  }, async ({ projectId, preset, config }) => {
    const prereqs = await checkPrerequisites(projectId, "style_design");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    let parsed: StyleConfigInput;
    try {
      parsed = JSON.parse(config) as StyleConfigInput;
    } catch {
      return fail("INVALID_INPUT", "config 必须是有效的 JSON 字符串");
    }

    const result = await styleService.create({
      projectId,
      styleId: preset ?? "custom",
      displayName: preset ? `执笔·${preset}` : "自定义文风",
      description: config,
      proseGuide: parsed.prose,
      examples: Array.isArray(parsed.examples) ? parsed.examples.join("\n---\n") : undefined,
    });
    return fromService(result);
  });

  server.registerTool("style_read", {
    description: "读取文风配置：传 styleId 读单个，不传读列表",
    inputSchema: {
      projectId: z.string().uuid(),
      styleId: z.string().uuid().optional(),
    },
  }, async ({ projectId, styleId }) => {
    if (styleId) {
      const result = await styleService.read(styleId);
      return fromService(result);
    }
    const result = await styleService.list(projectId);
    return fromService(result);
  });

  server.registerTool("style_update", {
    description: "更新文风配置",
    inputSchema: {
      projectId: z.string().uuid(),
      styleId: z.string().uuid(),
      preset: z.string().optional(),
      config: z.string().optional(),
    },
  }, async ({ styleId, preset, config }) => {
    const data: Record<string, unknown> = {};
    if (preset !== undefined) {
      data.styleId = preset;
      data.displayName = `执笔·${preset}`;
    }
    if (config !== undefined) {
      data.description = config;
      try {
        const parsed = JSON.parse(config) as StyleConfigInput;
        if (parsed.prose !== undefined) data.proseGuide = parsed.prose;
        if (Array.isArray(parsed.examples)) data.examples = parsed.examples.join("\n---\n");
      } catch {
        // config is not valid JSON — store as-is in description
      }
    }

    const result = await styleService.update(styleId, data);
    return fromService(result);
  });
}

/**
 * Character State tools (2 tools).
 *
 * - character_state_create: 记录角色章节状态快照
 * - character_state_read:   读取角色状态快照
 *
 * Spec state JSON → DB field mapping:
 *   location → location
 *   mood → emotionalState
 *   knowledgeGained → knownInformation
 *   injuries → physicalCondition (joined with "; ")
 *   inventory → inventory
 *   lieProgress, notes → changes (extras)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { characterService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

interface StateInput {
  location?: string;
  mood?: string;
  knowledgeGained?: string[];
  lieProgress?: number;
  injuries?: string[];
  inventory?: string[];
  notes?: string;
}

export function registerCharacterStateTools(server: McpServer) {
  server.registerTool("character_state_create", {
    description: "记录角色在某章节后的状态快照",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      state: z.string().describe(
        "JSON：{ location?, mood?, knowledgeGained?: string[], lieProgress?: number(0-1), injuries?: string[], inventory?: string[], notes?: string }",
      ),
    },
  }, async ({ projectId, characterId, chapterNumber, state: stateJson }) => {
    const prereqs = await checkPrerequisites(projectId, "character_state_record", { chapterNumber });
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }
    let parsed: StateInput;
    try {
      parsed = JSON.parse(stateJson) as StateInput;
    } catch {
      return fail("INVALID_INPUT", "state 必须是有效的 JSON 字符串");
    }
    if (typeof parsed !== "object" || parsed === null) {
      return fail("INVALID_INPUT", "state 必须是 JSON 对象");
    }

    const extras: string[] = [];
    if (parsed.lieProgress !== undefined) extras.push(`lieProgress:${parsed.lieProgress}`);
    if (parsed.notes) extras.push(parsed.notes);

    const result = await characterService.createState(characterId, {
      chapterNumber,
      location: parsed.location,
      emotionalState: parsed.mood,
      knownInformation: parsed.knowledgeGained,
      inventory: parsed.inventory,
      physicalCondition: Array.isArray(parsed.injuries) ? parsed.injuries.join("; ") : undefined,
      changes: extras.length > 0 ? extras : undefined,
    });
    return fromService(result);
  });

  server.registerTool("character_state_read", {
    description: "读取角色状态快照：可按角色、章节、范围查询",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid().optional(),
      chapterNumber: z.number().int().positive().optional(),
      range: z.object({
        from: z.number().int().positive(),
        to: z.number().int().positive(),
      }).optional(),
    },
  }, async ({ projectId, characterId, chapterNumber, range }) => {
    // Single character + specific chapter
    if (characterId && chapterNumber) {
      const result = await characterService.readState(characterId, chapterNumber);
      return fromService(result);
    }

    // Single character, list all states (optionally filtered by range)
    if (characterId) {
      const result = await characterService.listStates(characterId);
      if (!result.ok) return fromService(result);
      let states = result.data;
      if (range) {
        states = states.filter((s) => s.chapterNumber >= range.from && s.chapterNumber <= range.to);
      }
      return ok(states);
    }

    // All characters — aggregate states across project
    const charsResult = await characterService.list(projectId);
    if (!charsResult.ok) return fromService(charsResult);

    const stateResults = await Promise.all(
      charsResult.data.map(async (char) => {
        const r = await characterService.listStates(char.id);
        if (!r.ok) return [];
        let states = r.data;
        if (chapterNumber) states = states.filter((s) => s.chapterNumber === chapterNumber);
        if (range) states = states.filter((s) => s.chapterNumber >= range.from && s.chapterNumber <= range.to);
        return states.map((s) => ({ ...s, characterName: char.name }));
      }),
    );
    return ok(stateResults.flat());
  });
}

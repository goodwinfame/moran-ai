/**
 * Register all MCP tools.
 * Central barrel that imports all tool modules and registers them with the server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerProjectTools } from "./project.js";
import { registerBrainstormTools } from "./brainstorm.js";
import { registerWorldTools } from "./world.js";
import { registerCharacterTools } from "./character.js";
import { registerCharacterStateTools } from "./character-state.js";
import { registerRelationshipTools } from "./relationship.js";
import { registerStyleTools } from "./style.js";
import { registerOutlineTools } from "./outline.js";
import { registerChapterTools } from "./chapter.js";
import { registerSummaryTools } from "./summary.js";
import { registerThreadTools } from "./thread.js";
import { registerTimelineTools } from "./timeline.js";
import { registerKnowledgeTools } from "./knowledge.js";
import { registerLessonTools } from "./lesson.js";
import { registerContextTools } from "./context.js";
import { registerReviewTools } from "./review.js";
import { registerAnalysisTools } from "./analysis.js";

export function registerAllTools(server: McpServer) {
  registerProjectTools(server);
  registerBrainstormTools(server);
  registerWorldTools(server);
  registerCharacterTools(server);
  registerCharacterStateTools(server);
  registerRelationshipTools(server);
  registerStyleTools(server);
  registerOutlineTools(server);
  registerChapterTools(server);
  registerSummaryTools(server);
  registerThreadTools(server);
  registerTimelineTools(server);
  registerKnowledgeTools(server);
  registerLessonTools(server);
  registerContextTools(server);
  registerReviewTools(server);
  registerAnalysisTools(server);
}

/**
 * Service layer exports.
 *
 * All services use getDb() for lazy DB connection.
 * All public methods return ServiceResult<T> for consistent error handling.
 */

export type { ServiceResult } from "./types.js";

export * as authService from "./auth.service.js";
export * as projectService from "./project.service.js";
export * as brainstormService from "./brainstorm.service.js";
export * as worldService from "./world.service.js";
export * as styleService from "./style.service.js";
export * as characterService from "./character.service.js";
export * as relationshipService from "./relationship.service.js";
export * as outlineService from "./outline.service.js";
export * as chapterService from "./chapter.service.js";
export * as summaryService from "./summary.service.js";
export * as threadService from "./thread.service.js";
export * as timelineService from "./timeline.service.js";
export * as knowledgeService from "./knowledge.service.js";
export * as lessonService from "./lesson.service.js";
export * as gateService from "./gate.service.js";

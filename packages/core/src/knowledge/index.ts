/**
 * 知识库子系统
 *
 * 提供知识库 CRUD、版本管理、写作教训自学习、Agent 感知加载
 */

export type {
  KnowledgeEntry,
  KnowledgeFilter,
  KnowledgeVersion,
  KnowledgeScope,
  KnowledgeCategory,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  Lesson,
  LessonFilter,
  LessonStatus,
  LessonSeverity,
  CreateLessonInput,
  KnowledgeLoadRequest,
  LoadedKnowledge,
  LoadStrategy,
  AgentKnowledgeBudget,
} from "./types.js";

export {
  AGENT_KNOWLEDGE_BUDGETS,
  DEFAULT_LESSON_EXPIRY_THRESHOLD,
  MAX_ENTRY_TOKENS,
} from "./types.js";

export { KnowledgeService } from "./knowledge-service.js";
export type { KnowledgeStore } from "./knowledge-service.js";

export { LessonsService } from "./lessons-service.js";
export type { LessonStore } from "./lessons-service.js";

export { KnowledgeLoader } from "./knowledge-loader.js";

export { getDefaultKnowledgeEntries, DEFAULT_KNOWLEDGE_ENTRIES } from "./seed.js";

export { InMemoryKnowledgeStore, InMemoryLessonStore } from "./in-memory-store.js";

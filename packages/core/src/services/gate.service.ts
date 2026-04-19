import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projects } from "../db/schema/projects.js";
import type { ServiceResult } from "./types.js";

/**
 * Gate rules: which tool domains are allowed at each project status.
 *
 * Project flows through: brainstorm → world → character → outline → writing → completed
 * Each status unlocks tool domains for that phase and all prior phases.
 */
const GATE_RULES: Record<string, string[]> = {
  brainstorm: ["project", "gate", "brainstorm", "style", "knowledge", "lesson"],
  world: ["project", "gate", "brainstorm", "style", "knowledge", "lesson", "world"],
  character: [
    "project", "gate", "brainstorm", "style", "knowledge", "lesson",
    "world", "character", "character_state", "relationship",
  ],
  outline: [
    "project", "gate", "brainstorm", "style", "knowledge", "lesson",
    "world", "character", "character_state", "relationship",
    "outline",
  ],
  writing: [
    "project", "gate", "brainstorm", "style", "knowledge", "lesson",
    "world", "character", "character_state", "relationship",
    "outline", "chapter", "review", "summary", "thread", "timeline",
    "analysis", "context",
  ],
  completed: [
    "project", "gate", "brainstorm", "style", "knowledge", "lesson",
    "world", "character", "character_state", "relationship",
    "outline", "chapter", "review", "summary", "thread", "timeline",
    "analysis", "context",
  ],
};

export interface GateCheckResult {
  allowed: boolean;
  projectStatus: string;
  domain: string;
  allowedDomains: string[];
}

export async function check(
  projectId: string,
  domain: string,
): Promise<ServiceResult<GateCheckResult>> {
  const db = getDb();
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: { code: "NOT_FOUND", message: "项目不存在" } };
  }

  const status = project.status ?? "brainstorm";
  const allowedDomains = GATE_RULES[status] ?? GATE_RULES.brainstorm!;
  const allowed = allowedDomains.includes(domain);

  return {
    ok: true,
    data: {
      allowed,
      projectStatus: status,
      domain,
      allowedDomains,
    },
  };
}

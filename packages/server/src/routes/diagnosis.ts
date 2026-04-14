/**
 * /api/projects/:id/diagnosis — \u70B9\u775B\u6587\u5B66\u8BCA\u65AD\u8DEF\u7531
 *
 * POST   /                 — \u89E6\u53D1\u6587\u5B66\u8BCA\u65AD\uFF08\u6307\u5B9A\u7AE0\u8282\uFF09
 * GET    /                 — \u5217\u51FA\u9879\u76EE\u6240\u6709\u8BCA\u65AD\u8BB0\u5F55
 * GET    /:chapterNum      — \u83B7\u53D6\u7279\u5B9A\u7AE0\u8282\u7684\u8BCA\u65AD\u62A5\u544A
 */

import { Hono } from "hono";

// ── Types ──────────────────────────────────────────

export type DiagnosisDimension =
  | "narrative_drive"
  | "emotional_authenticity"
  | "pacing_root_cause"
  | "character_voice"
  | "thematic_coherence";

export const DIAGNOSIS_LABELS: Record<DiagnosisDimension, string> = {
  narrative_drive: "\u53D9\u4E8B\u52A8\u529B",
  emotional_authenticity: "\u60C5\u611F\u771F\u5B9E\u6027",
  pacing_root_cause: "\u8282\u594F\u95EE\u9898\u6EAF\u6E90",
  character_voice: "\u89D2\u8272\u58F0\u97F3",
  thematic_coherence: "\u4E3B\u9898\u4E00\u81F4\u6027",
};

export interface DimensionDiagnosisRecord {
  dimension: DiagnosisDimension;
  label: string;
  severity: number;
  rootCause: string;
  improvementDirection: string;
  evidence?: string;
}

export interface CoreIssueRecord {
  title: string;
  dimensions: DiagnosisDimension[];
  rootCause: string;
  improvementDirection: string;
  impact: number;
}

export interface DiagnosisRecord {
  id: string;
  projectId: string;
  chapterNumber: number;
  dimensionDiagnoses: DimensionDiagnosisRecord[];
  coreIssues: CoreIssueRecord[];
  summary: string;
  createdAt: string;
}

// ── In-memory store ────────────────────────────────

const diagnosisStore = new Map<string, DiagnosisRecord>();

function diagKey(projectId: string, chapterNum: number) {
  return `${projectId}:${chapterNum}`;
}

// ── Demo data ────────────────────────────────────

function seedDemoDiagnosis(projectId: string, chapterNum: number): DiagnosisRecord {
  return {
    id: crypto.randomUUID(),
    projectId,
    chapterNumber: chapterNum,
    dimensionDiagnoses: [
      {
        dimension: "narrative_drive",
        label: "\u53D9\u4E8B\u52A8\u529B",
        severity: 7,
        rootCause: "\u89D2\u8272\u7684\u884C\u4E3A\u5B8C\u5168\u88AB\u5916\u90E8\u4E8B\u4EF6\u63A8\u7740\u8D70\uFF0C\u7F3A\u4E4F\u5185\u5728\u77DB\u76FE\u9A71\u52A8\u3002\u5982\u679C\u628A\u6240\u6709\u5916\u90E8\u4E8B\u4EF6\u53BB\u6389\uFF0C\u89D2\u8272\u6CA1\u6709\u4EFB\u4F55\u7406\u7531\u7EE7\u7EED\u63A8\u52A8\u6545\u4E8B\u524D\u8FDB\u3002",
        improvementDirection: "\u7ED9\u89D2\u8272\u5728\u8FD9\u4E2A\u573A\u666F\u4E2D\u8BBE\u5B9A\u4E00\u4E2A\u5185\u5728\u77DB\u76FE\uFF1A\u4ED6\u60F3\u8981\u4EC0\u4E48\uFF0C\u4F46\u4EC0\u4E48\u963B\u7887\u4E86\u4ED6\uFF1F",
        evidence: "\u4ED6\u8D70\u51FA\u5C71\u95E8\uFF0C\u770B\u4E86\u4E00\u773C\u8FDC\u5904\u7684\u5929\u9645\u7EBF\u3002\u4ED6\u53F9\u4E86\u53E3\u6C14\uFF0C\u7EE7\u7EED\u5411\u524D\u8D70\u53BB\u3002",
      },
      {
        dimension: "emotional_authenticity",
        label: "\u60C5\u611F\u771F\u5B9E\u6027",
        severity: 5,
        rootCause: "\u60C5\u611F\u8868\u8FBE\u4F9D\u8D56\u201C\u544A\u8BC9\u201D\u800C\u975E\u201C\u5C55\u793A\u201D\u3002\u201C\u4ED6\u5FC3\u4E2D\u6D6E\u73B0\u51FA\u5F88\u591A\u60F3\u6CD5\u201D\u662F\u5178\u578B\u7684\u544A\u8BC9\u5F0F\u5199\u6CD5\uFF0C\u8BFB\u8005\u65E0\u6CD5\u4EA7\u751F\u5171\u9E23\u3002",
        improvementDirection: "\u7528\u5177\u4F53\u884C\u4E3A\u548C\u7EC6\u8282\u4F20\u8FBE\u60C5\u611F\uFF0C\u800C\u4E0D\u662F\u76F4\u63A5\u53D9\u8FF0\u89D2\u8272\u7684\u5185\u5FC3\u72B6\u6001\u3002",
        evidence: "\u4ED6\u5FC3\u4E2D\u6D6E\u73B0\u51FA\u5F88\u591A\u60F3\u6CD5",
      },
      {
        dimension: "pacing_root_cause",
        label: "\u8282\u594F\u95EE\u9898\u6EAF\u6E90",
        severity: 6,
        rootCause: "\u4FE1\u606F\u5BC6\u5EA6\u4E0D\u8DB3\u2014\u2014\u573A\u666F\u4E2D\u6CA1\u6709\u65B0\u4FE1\u606F\u5F15\u5165\uFF0C\u89D2\u8272\u4E5F\u6CA1\u6709\u9762\u5BF9\u4EFB\u4F55\u963B\u529B\u3002\u8BFB\u8005\u5728\u7B49\u5F85\u201C\u53D1\u751F\u4E8B\u60C5\u201D\u4F46\u4EC0\u4E48\u90FD\u6CA1\u53D1\u751F\u3002",
        improvementDirection: "\u786E\u4FDD\u6BCF\u4E2A\u573A\u666F\u81F3\u5C11\u6709\u4E00\u4E2A\u5C0F\u51B2\u7A81\u6216\u65B0\u4FE1\u606F\u7684\u5F15\u5165\u3002",
      },
      {
        dimension: "character_voice",
        label: "\u89D2\u8272\u58F0\u97F3",
        severity: 4,
        rootCause: "\u5BF9\u8BDD\u8FC7\u4E8E\u5E73\u6DE1\uFF0C\u7F3A\u4E4F\u4E2A\u6027\u5316\u8BED\u8A00\u7279\u5F81\u3002\u201C\u5E08\u59B9\u95EE\u4ED6\u53BB\u54EA\uFF0C\u4ED6\u8BF4\u51FA\u53BB\u8D70\u8D70\u201D\u2014\u2014\u8FD9\u662F\u4EFB\u4F55\u4EBA\u90FD\u53EF\u80FD\u8BF4\u7684\u8BDD\u3002",
        improvementDirection: "\u7ED9\u6BCF\u4E2A\u89D2\u8272\u4E00\u4E2A\u72EC\u7279\u7684\u8BF4\u8BDD\u4E60\u60EF\u3001\u53E3\u5934\u7985\u6216\u601D\u7EF4\u6A21\u5F0F\u3002",
        evidence: "\u5E08\u59B9\u95EE\u4ED6\u53BB\u54EA\uFF0C\u4ED6\u8BF4\u51FA\u53BB\u8D70\u8D70",
      },
      {
        dimension: "thematic_coherence",
        label: "\u4E3B\u9898\u4E00\u81F4\u6027",
        severity: 3,
        rootCause: "\u573A\u666F\u672C\u8EAB\u6CA1\u6709\u5728\u63A8\u8FDB\u4EFB\u4F55\u4E3B\u9898\uFF0C\u4F46\u4F5C\u4E3A\u8FC7\u6E21\u573A\u666F\u52C9\u5F3A\u53EF\u63A5\u53D7\u3002",
        improvementDirection: "\u5373\u4F7F\u662F\u8FC7\u6E21\u573A\u666F\uFF0C\u4E5F\u53EF\u4EE5\u901A\u8FC7\u89D2\u8272\u7684\u5185\u5FC3\u6D3B\u52A8\u5FAE\u5999\u5448\u73B0\u4E3B\u9898\u3002",
      },
    ],
    coreIssues: [
      {
        title: "\u89D2\u8272\u7F3A\u4E4F\u5185\u5728\u9A71\u52A8\u529B",
        dimensions: ["narrative_drive", "pacing_root_cause"],
        rootCause: "\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076\uFF0C\u6240\u6709\u884C\u4E3A\u90FD\u662F\u5BF9\u5916\u90E8\u4E8B\u4EF6\u7684\u88AB\u52A8\u54CD\u5E94\uFF0C\u6CA1\u6709\u5185\u5728\u77DB\u76FE\u6216\u6B32\u671B\u9A71\u52A8\u3002",
        improvementDirection: "\u8D4B\u4E88\u89D2\u8272\u660E\u786E\u7684\u5185\u5728\u77DB\u76FE\uFF08WANT vs NEED\uFF09\uFF0C\u8BA9\u4ED6\u7684\u6BCF\u4E2A\u884C\u4E3A\u90FD\u6709\u5185\u5728\u539F\u56E0\u3002",
        impact: 8,
      },
    ],
    summary: "\u8FD9\u7AE0\u6700\u5927\u7684\u95EE\u9898\u662F\u89D2\u8272\u50CF\u63D0\u7EBF\u6728\u5076\u2014\u2014\u4ED6\u505A\u4EC0\u4E48\u90FD\u6CA1\u6709\u5185\u5728\u52A8\u673A\u3002\u4FE1\u606F\u5BC6\u5EA6\u4E0D\u8DB3\u5BFC\u81F4\u8282\u594F\u62D6\u6C93\uFF0C\u60C5\u611F\u8868\u8FBE\u504F\u5411\u544A\u8BC9\u800C\u975E\u5C55\u793A\u3002\u5EFA\u8BAE\u4ECE\u89D2\u8272\u7684\u5185\u5728\u77DB\u76FE\u5165\u624B\u91CD\u65B0\u7EC4\u7EC7\u8FD9\u4E2A\u573A\u666F\u3002",
    createdAt: new Date().toISOString(),
  };
}

// ── Route factory ────────────────────────────────

export function createDiagnosisRoute() {
  const route = new Hono();

  /** GET / — \u5217\u51FA\u6240\u6709\u8BCA\u65AD\u8BB0\u5F55 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const records: DiagnosisRecord[] = [];
    for (const r of diagnosisStore.values()) {
      if (r.projectId === projectId) {
        records.push(r);
      }
    }

    // Seed demo data if empty
    if (records.length === 0) {
      for (let i = 1; i <= 2; i++) {
        const demo = seedDemoDiagnosis(projectId, i);
        diagnosisStore.set(diagKey(projectId, i), demo);
        records.push(demo);
      }
    }

    records.sort((a, b) => a.chapterNumber - b.chapterNumber);

    return c.json({
      diagnoses: records.map((r) => ({
        id: r.id,
        chapterNumber: r.chapterNumber,
        coreIssueCount: r.coreIssues.length,
        topIssueSeverity: Math.max(...r.dimensionDiagnoses.map((d) => d.severity), 0),
        summary: r.summary,
        createdAt: r.createdAt,
      })),
      total: records.length,
    });
  });

  /** GET /:chapterNum — \u83B7\u53D6\u7279\u5B9A\u7AE0\u8282\u7684\u8BCA\u65AD */
  route.get("/:chapterNum", (c) => {
    const projectId = c.req.param("id");
    const chapterNum = parseInt(c.req.param("chapterNum"), 10);

    if (!projectId || isNaN(chapterNum)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    let record = diagnosisStore.get(diagKey(projectId, chapterNum));
    if (!record) {
      record = seedDemoDiagnosis(projectId, chapterNum);
      diagnosisStore.set(diagKey(projectId, chapterNum), record);
    }

    return c.json(record);
  });

  /** POST / — \u89E6\u53D1\u6587\u5B66\u8BCA\u65AD */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<{ chapterNumber: number; reviewSummary?: string }>().catch(() => null);
    if (!body || typeof body.chapterNumber !== "number") {
      return c.json({ error: "chapterNumber is required" }, 400);
    }

    // In dev mode, generate demo diagnosis
    const record = seedDemoDiagnosis(projectId, body.chapterNumber);
    diagnosisStore.set(diagKey(projectId, body.chapterNumber), record);

    return c.json(record, 201);
  });

  return route;
}

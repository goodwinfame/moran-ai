/**
 * ShuchongEngine — 书虫普通读者评审引擎
 *
 * 模拟真实读者的阅读体验反馈。
 * 通过 Bridge 调用书虫 Agent，解析 JSON 格式的读者反馈。
 *
 * 设计要点：
 * - 读者视角，不是专家视角
 * - 所有解析器支持 camelCase + snake_case 双格式
 * - 解析失败有安全 fallback
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { extractJson } from "../lingxi/lingxi-engine.js";
import { createLogger } from "../logger/index.js";
import { SHUCHONG_SYSTEM_PROMPT, buildReaderReviewMessage } from "./prompts.js";
import { DEFAULT_SHUCHONG_CONFIG } from "./types.js";
import type {
  BoringSpot,
  FavoriteCharacter,
  ReaderFeedback,
  ReaderReviewInput,
  ShuchongEngineConfig,
  TouchingMoment,
} from "./types.js";

const logger = createLogger("shuchong-engine");

export class ShuchongEngine {
  private readonly config: ShuchongEngineConfig;

  constructor(config?: Partial<ShuchongEngineConfig>) {
    this.config = { ...DEFAULT_SHUCHONG_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<ShuchongEngineConfig> {
    return this.config;
  }

  /**
   * 执行读者评审
   */
  async review(
    input: ReaderReviewInput,
    bridge: SessionProjectBridge,
  ): Promise<ReaderFeedback> {
    logger.info(
      { chapterNumber: input.chapterNumber },
      "Starting reader review",
    );

    try {
      const userMessage = buildReaderReviewMessage(input);

      const response = await bridge.invokeAgent({
        agentId: this.config.agentId,
        message: userMessage,
        systemPrompt: SHUCHONG_SYSTEM_PROMPT,
        stream: false,
        temperature: 0.7,
      });

      const feedback = parseReaderFeedback(response.content, response.usage);

      logger.info(
        {
          chapterNumber: input.chapterNumber,
          score: feedback.readabilityScore,
          boringSpots: feedback.boringSpots.length,
          touchingMoments: feedback.touchingMoments.length,
        },
        "Reader review complete",
      );

      return feedback;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: message, chapterNumber: input.chapterNumber },
        "Reader review failed",
      );

      return createFallbackFeedback(message);
    }
  }
}

// ── 解析函数 ──────────────────────────────────────

/**
 * 解析读者反馈 JSON
 *
 * 支持 camelCase + snake_case 双格式字段名
 */
export function parseReaderFeedback(
  raw: string,
  usage: { inputTokens: number; outputTokens: number },
): ReaderFeedback {
  try {
    const json = extractJson(raw);
    const obj = JSON.parse(json) as Record<string, unknown>;

    const scoreRaw = obj.readabilityScore ?? obj.readability_score;
    const score = typeof scoreRaw === "number"
      ? Math.max(0, Math.min(10, Math.round(scoreRaw)))
      : 5;

    const oneLinerRaw = obj.oneLiner ?? obj.one_liner;
    const oneLiner = typeof oneLinerRaw === "string" ? oneLinerRaw : "";

    const boringSpotsRaw = obj.boringSpots ?? obj.boring_spots;
    const boringSpots = parseBoringSpots(boringSpotsRaw);

    const touchingRaw = obj.touchingMoments ?? obj.touching_moments;
    const touchingMoments = parseTouchingMoments(touchingRaw);

    const favCharRaw = obj.favoriteCharacter ?? obj.favorite_character;
    const favoriteCharacter = parseFavoriteCharacter(favCharRaw);

    const freeThoughtsRaw = obj.freeThoughts ?? obj.free_thoughts;
    const freeThoughts = typeof freeThoughtsRaw === "string" ? freeThoughtsRaw : "";

    return {
      readabilityScore: score,
      oneLiner,
      boringSpots,
      touchingMoments,
      favoriteCharacter,
      freeThoughts,
      rawResponse: raw,
      usage,
    };
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse reader feedback, using fallback");
    return createFallbackFeedback("解析失败", raw, usage);
  }
}

// ── 子解析器 ──────────────────────────────────────

function parseBoringSpots(val: unknown): BoringSpot[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      quote: typeof item.quote === "string" ? item.quote : "",
      reason: typeof item.reason === "string" ? item.reason : "",
    }))
    .filter((spot) => spot.quote.length > 0 || spot.reason.length > 0);
}

function parseTouchingMoments(val: unknown): TouchingMoment[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      quote: typeof item.quote === "string" ? item.quote : "",
      feeling: typeof item.feeling === "string" ? item.feeling : "",
    }))
    .filter((moment) => moment.quote.length > 0 || moment.feeling.length > 0);
}

function parseFavoriteCharacter(val: unknown): FavoriteCharacter | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : "";
  const reason = typeof obj.reason === "string" ? obj.reason : "";
  if (name.length === 0 && reason.length === 0) return null;
  return { name, reason };
}

// ── Fallback ──────────────────────────────────────

function createFallbackFeedback(
  errorMessage: string,
  rawResponse?: string,
  usage?: { inputTokens: number; outputTokens: number },
): ReaderFeedback {
  return {
    readabilityScore: 5,
    oneLiner: `[书虫评审失败] ${errorMessage}`,
    boringSpots: [],
    touchingMoments: [],
    favoriteCharacter: null,
    freeThoughts: "",
    rawResponse,
    usage: usage ?? { inputTokens: 0, outputTokens: 0 },
  };
}

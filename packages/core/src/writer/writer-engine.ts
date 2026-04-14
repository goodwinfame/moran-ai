/**
 * WriterEngine — 执笔写作引擎
 *
 * 核心职责：
 * 1. 构建执笔的完整 prompt（系统提示词 + 风格上下文 + 章节上下文）
 * 2. 调用 LLM（通过 Bridge）生成章节内容
 * 3. 流式 chunk 转发至 SSE
 * 4. 完成后执行 Anti-AI 自检
 * 5. 统计字数和 token 消耗
 *
 * WriterEngine 不直接与 LLM 通信，而是通过 SessionProjectBridge。
 * 在 M1.4 阶段 Bridge 仍为 placeholder，但 WriterEngine 的逻辑完整。
 */

import type { AgentId } from "../agents/types.js";
import type { SessionProjectBridge } from "../bridge/bridge.js";
import type { SSEEvent } from "../events/types.js";
import { createLogger } from "../logger/index.js";
import { checkAntiAi, countWords } from "../style/anti-ai-checker.js";
import { StyleManager } from "../style/style-manager.js";
import type {
  AntiAiCheckResult,
  ChapterType,
  WriterContext,
  WriterResult,
  WritingChunk,
} from "../style/types.js";

const logger = createLogger("writer-engine");

// ── 核心写作原则 ──────────────────────────────────────────

/**
 * 核心原则（始终加载，≤500 字）
 *
 * 来自 §4.4 文风档案拆分方案
 */
const CORE_PRINCIPLES = `## 核心写作原则

### 感官先行
先写角色感受到的（看到、听到、摸到、闻到），再写角色思考的。让读者通过感官进入场景，而非通过作者的讲述。

### 动作电影感
像拍电影一样写：有远景（环境建立）、近景（人物互动）、特写（关键细节）。每个场景都能让读者"看见画面"。

### 间接心理
通过行为和环境暗示内心，而非直接陈述。角色在想什么，让读者自己推断出来。
- ❌ 她感到非常紧张
- ✅ 她的手指不停地搓着衣角，眼神每隔几秒就飘向门口

### 句式多样性
绝不连续使用相同句式结构。长短交替，主语变化，偶尔用倒装、省略句、环境描写打断节奏。

### 对话辨识度
每个角色的说话方式是其身份的指纹。蒙住名字也能猜出说话者。`;

/** WriterEngine 配置 */
export interface WriterEngineConfig {
  /** 是否启用 Anti-AI 自检 */
  antiAiCheck: boolean;
  /** 是否启用流式输出 */
  streaming: boolean;
  /** 核心原则内容 */
  corePrinciples: string;
}

const DEFAULT_WRITER_CONFIG: WriterEngineConfig = {
  antiAiCheck: true,
  streaming: true,
  corePrinciples: CORE_PRINCIPLES,
};

/**
 * WriterEngine — 执笔写作引擎
 */
export class WriterEngine {
  private readonly styleManager: StyleManager;
  private readonly config: WriterEngineConfig;

  constructor(
    styleManager: StyleManager,
    config?: Partial<WriterEngineConfig>,
  ) {
    this.styleManager = styleManager;
    this.config = { ...DEFAULT_WRITER_CONFIG, ...config };
  }

  // ── 写作流程 ──────────────────────────────────────────

  /**
   * 执行写作 — 完整的执笔写作流程
   *
   * @param context 写作上下文
   * @param bridge SessionProjectBridge 实例
   * @param onChunk 流式 chunk 回调
   * @returns 写作结果
   */
  async write(
    context: WriterContext,
    bridge: SessionProjectBridge,
    onChunk?: (chunk: WritingChunk) => void,
  ): Promise<WriterResult> {
    logger.info(
      {
        chapter: context.chapterNumber,
        style: context.style.styleId,
        temperature: context.temperature,
        chapterType: context.chapterType,
      },
      "Writer engine starting",
    );

    // 1. 构建 prompt
    const systemPrompt = this.buildSystemPrompt(context);
    const userMessage = this.buildUserMessage(context);

    // 2. 调用 Bridge 执行 LLM 调用
    const response = await bridge.invokeAgent({
      agentId: "zhibi" as AgentId,
      message: `${systemPrompt}\n\n---\n\n${userMessage}`,
      stream: this.config.streaming,
      temperature: context.temperature,
    });

    // 3. 处理响应
    const content = response.content;
    const wordCount = countWords(content);

    // 4. 发送最终字数 chunk
    if (onChunk) {
      onChunk({ text: content, cumulativeWordCount: wordCount });
    }

    // 5. Anti-AI 自检
    let antiAiCheck: AntiAiCheckResult = {
      passed: true,
      burstiness: 0.5,
      issues: [],
    };

    if (this.config.antiAiCheck) {
      antiAiCheck = checkAntiAi(content, context.style.forbidden);
      logger.info(
        {
          passed: antiAiCheck.passed,
          burstiness: antiAiCheck.burstiness,
          issueCount: antiAiCheck.issues.length,
        },
        "Anti-AI self-check completed",
      );
    }

    // 6. 汇总结果
    const result: WriterResult = {
      content,
      wordCount,
      antiAiCheck,
      usage: response.usage,
    };

    logger.info(
      { chapter: context.chapterNumber, wordCount, antiAiPassed: antiAiCheck.passed },
      "Writer engine completed",
    );

    return result;
  }

  // ── Prompt 构建 ──────────────────────────────────────────

  /**
   * 构建系统提示词
   *
   * 结构：
   * 1. 角色定义
   * 2. 核心写作原则（≤500字）
   * 3. 风格上下文（结构化约束 + 散文 + 示例）
   * 4. 专项模块内容
   * 5. Anti-AI 自检提醒
   */
  buildSystemPrompt(context: WriterContext): string {
    const sections: string[] = [];

    // 角色定义
    sections.push(`# 你是执笔${context.style.displayName.includes("·") ? `（${context.style.displayName}）` : ""}

你是墨染唯一的写手。你的任务是创作高质量的章节正文。
当前风格：${context.style.displayName}
当前题材：${context.style.genre}
当前章节类型：${chapterTypeLabel(context.chapterType)}`);

    // 核心写作原则
    sections.push(this.config.corePrinciples);

    // 风格上下文
    const styleContext = this.styleManager.assembleStyleContext(context.style.styleId);
    sections.push(styleContext);

    // 专项模块内容
    if (Object.keys(context.moduleContents).length > 0) {
      const moduleSections: string[] = ["## 当前加载的专项模块\n"];
      for (const [name, content] of Object.entries(context.moduleContents)) {
        moduleSections.push(`### ${name}\n${content}`);
      }
      sections.push(moduleSections.join("\n\n"));
    }

    // Anti-AI 自检
    if (this.config.antiAiCheck) {
      sections.push(`## Anti-AI 自检提醒

写完后请内心检查以下项目：
- 句长是否有变化？连续几句不要一样长
- 有没有连续3句以相同方式开头？
- 有没有"他感到..."、"她心中..."这种直接告知情感的写法？
- 一段话里是否塞了太多感官描写？
- 对话是不是每个角色说话方式不同？
- 有没有使用禁忌词？`);
    }

    return sections.join("\n\n---\n\n");
  }

  /**
   * 构建用户消息（章节写作指令）
   */
  buildUserMessage(context: WriterContext): string {
    const sections: string[] = [];

    sections.push(`请创作第 ${context.chapterNumber} 章。`);

    if (context.brief) {
      sections.push(`## 章节 Brief\n\n${context.brief}`);
    }

    if (context.assembledContext) {
      sections.push(`## 上下文\n\n${context.assembledContext}`);
    }

    sections.push(`## 要求

1. 内容创作最重要，字数不是严格把控目标
2. 遵循上述风格配置
3. 写出有灵性的文章——要有出乎意料但合乎情理的瞬间
4. 章节结尾留下让读者想继续读下去的钩子
5. 直接输出章节正文，不要加任何说明或注释`);

    return sections.join("\n\n");
  }

  // ── 辅助方法 ──────────────────────────────────────────

  /**
   * 准备写作上下文
   *
   * 根据项目配置和章节信息构建完整的 WriterContext
   */
  prepareContext(params: {
    projectId: string;
    chapterNumber: number;
    arcNumber: number;
    chapterType: ChapterType;
    styleId: string;
    brief?: string;
    assembledContext?: string;
    moduleContents?: Record<string, string>;
  }): WriterContext {
    const style = this.styleManager.getStyle(params.styleId);
    const temperature = this.styleManager.calculateTemperature(
      params.styleId,
      params.chapterType,
    );

    return {
      projectId: params.projectId,
      chapterNumber: params.chapterNumber,
      arcNumber: params.arcNumber,
      chapterType: params.chapterType,
      brief: params.brief,
      style,
      temperature,
      assembledContext: params.assembledContext ?? "",
      moduleContents: params.moduleContents ?? {},
    };
  }

  /** 获取 StyleManager 实例 */
  getStyleManager(): StyleManager {
    return this.styleManager;
  }
}

// ── 工具函数 ──────────────────────────────────────────

function chapterTypeLabel(type: ChapterType): string {
  const labels: Record<ChapterType, string> = {
    daily: "日常/过渡",
    normal: "常规推进",
    emotional: "情感高潮",
    action: "战斗/动作",
    climax: "反转/爆点",
  };
  return labels[type] ?? type;
}

/**
 * 将 WriterResult 转换为 SSE 事件序列
 */
export function writerResultToEvents(
  result: WriterResult,
  chapterNumber: number,
): SSEEvent[] {
  const events: SSEEvent[] = [];

  // writing 事件
  events.push({
    type: "writing",
    data: {
      chunk: result.content,
      wordCount: result.wordCount,
    },
  });

  // done 事件（包含自检结果）
  events.push({
    type: "done",
    data: {
      chapterNumber,
      wordCount: result.wordCount,
      antiAiCheck: {
        passed: result.antiAiCheck.passed,
        burstiness: result.antiAiCheck.burstiness,
        issueCount: result.antiAiCheck.issues.length,
      },
    },
  });

  return events;
}

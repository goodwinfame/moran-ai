/**
 * Anti-AI 自检器
 *
 * 在执笔完成写作后执行自检，检测常见的 AI 写作痕迹。
 * 这是一个纯文本分析器（不调用 LLM），直接在代码中运行。
 *
 * 检测维度来自 §4.5 和 Dickens 25 条 lessons：
 * 1. Burstiness（句长变化率）— AI 文本倾向均匀句长
 * 2. 句式重复 — 连续段落相同句式结构
 * 3. 情感告知式 — "他感到..."等直接告知内心
 * 4. 五感堆砌 — 同一段内密集感官描写
 * 5. 禁忌词/模式 — 风格配置的 forbidden
 * 6. 重复心理 — 短距离内重复内心独白
 * 7. 中英混杂 — 非必要英文混入中文叙述
 */

import type { AntiAiCheckResult, AntiAiIssue, ForbiddenRules } from "./types.js";

/**
 * 执行 Anti-AI 自检
 */
export function checkAntiAi(
  content: string,
  forbidden?: ForbiddenRules,
): AntiAiCheckResult {
  const issues: AntiAiIssue[] = [];

  // 将内容分割为段落和句子
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const sentences = extractSentences(content);

  // 1. Burstiness 检测
  const burstiness = calculateBurstiness(sentences);
  if (burstiness < 0.3) {
    issues.push({
      type: "low_burstiness",
      description: `句长变化率过低 (${burstiness.toFixed(2)})，疑似 AI 生成。人类写作通常 ≥ 0.3`,
    });
  }

  // 2. 句式重复检测
  checkRepetitiveStructure(paragraphs, issues);

  // 3. 情感告知式检测
  checkEmotionalTelling(paragraphs, issues);

  // 4. 五感堆砌检测
  checkSensoryOverload(paragraphs, issues);

  // 5. 禁忌词/模式检测
  if (forbidden) {
    checkForbidden(content, forbidden, issues);
  }

  // 6. 重复心理检测
  checkRepetitiveThoughts(paragraphs, issues);

  // 7. 中英混杂检测
  checkMixedLanguage(content, issues);

  return {
    passed: issues.filter((i) =>
      i.type === "low_burstiness" ||
      i.type === "forbidden_word"
    ).length === 0 && issues.length <= 3,
    burstiness,
    issues,
  };
}

// ── 辅助函数 ──────────────────────────────────────────

/**
 * 提取句子（中文断句）
 */
function extractSentences(text: string): string[] {
  return text
    .split(/[。！？.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 计算 Burstiness（句长变化率）
 */
function calculateBurstiness(sentences: string[]): number {
  if (sentences.length < 3) return 0.5;

  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 0;

  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const std = Math.sqrt(variance);

  return Number((std / mean).toFixed(3));
}

/**
 * 检测句式重复 — 连续 3+ 句以相同方式开头
 */
function checkRepetitiveStructure(paragraphs: string[], issues: AntiAiIssue[]): void {
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    if (!para) continue;

    const sentences = para
      .split(/[。！？.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length < 3) continue;

    let streak = 1;
    for (let i = 1; i < sentences.length; i++) {
      const prev = sentences[i - 1];
      const curr = sentences[i];
      if (!prev || !curr) continue;

      const prevStart = getSubjectChar(prev);
      const currStart = getSubjectChar(curr);
      if (prevStart && currStart && prevStart === currStart) {
        streak++;
        if (streak >= 3) {
          issues.push({
            type: "repetitive_structure",
            description: `第${pi + 1}段连续${streak}句以"${currStart}"开头，句式单一`,
            location: pi,
            evidence: sentences.slice(i - streak + 1, i + 1).map((s) => s.slice(0, 15) + "...").join(" / "),
          });
          break;
        }
      } else {
        streak = 1;
      }
    }
  }
}

/**
 * 获取句子的开头主语字符
 */
function getSubjectChar(sentence: string): string | null {
  const trimmed = sentence.replace(/^[""「『\s]+/, "");
  if (trimmed.length === 0) return null;

  const match = trimmed.match(/^(他们?|她们?|我们?|你们?|它们?)/);
  if (match && match[1]) return match[1];

  return trimmed.charAt(0);
}

/**
 * 检测情感告知式描写
 */
function checkEmotionalTelling(paragraphs: string[], issues: AntiAiIssue[]): void {
  const patterns = [
    /[他她][感觉到一阵]{2,}/,
    /[他她]心中[充满涌起升起浮起]{2}/,
    /[他她]觉得[自己这一切]{0,3}[很非常十分]/,
    /[他她]的内心[深处不禁充满]/,
    /不禁[感到想到觉得]了?一[阵丝股]/,
  ];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    if (!para) continue;

    let count = 0;
    for (const pattern of patterns) {
      if (pattern.test(para)) {
        count++;
      }
    }
    if (count >= 2) {
      issues.push({
        type: "emotional_telling",
        description: `第${pi + 1}段存在${count}处情感告知式描写，应通过行为/环境间接传达`,
        location: pi,
      });
    }
  }
}

/**
 * 检测五感堆砌
 */
function checkSensoryOverload(paragraphs: string[], issues: AntiAiIssue[]): void {
  const sensoryPatterns = [
    /看[到见着去]|目光|视线|眼[前中里]/,
    /听[到见着去]|声音|响|嗡嗡|叮当/,
    /闻[到着]|气味|味道|香|臭/,
    /触[到碰]|摸|手[感指]|粗糙|光滑|冰凉|温热/,
    /尝|甜|苦|酸|辣|咸|涩/,
  ];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    if (!para || para.length < 50) continue;

    let senseCount = 0;
    for (const pattern of sensoryPatterns) {
      if (pattern.test(para)) {
        senseCount++;
      }
    }

    if (senseCount >= 4) {
      issues.push({
        type: "sensory_overload",
        description: `第${pi + 1}段在一段内使用了${senseCount}种感官描写，疑似五感堆砌`,
        location: pi,
      });
    }
  }
}

/**
 * 检测禁忌词/模式
 */
function checkForbidden(content: string, forbidden: ForbiddenRules, issues: AntiAiIssue[]): void {
  if (forbidden.words) {
    for (const word of forbidden.words) {
      if (content.includes(word)) {
        issues.push({
          type: "forbidden_word",
          description: `检测到禁忌词："${word}"`,
          evidence: extractContext(content, word),
        });
      }
    }
  }

  if (forbidden.patterns) {
    for (const pattern of forbidden.patterns) {
      try {
        const regex = new RegExp(pattern, "g");
        const match = regex.exec(content);
        if (match) {
          issues.push({
            type: "forbidden_word",
            description: `检测到禁忌模式：\`${pattern}\``,
            evidence: match[0],
          });
        }
      } catch {
        // 无效正则跳过
      }
    }
  }
}

/**
 * 检测重复心理
 */
function checkRepetitiveThoughts(paragraphs: string[], issues: AntiAiIssue[]): void {
  const thoughtPatterns = [
    /[他她]想[着到，]/,
    /[他她]心[里中想]/,
    /[他她]暗自/,
    /[他她]在心/,
  ];

  const thoughtLocations: number[] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    if (!para) continue;

    for (const pattern of thoughtPatterns) {
      if (pattern.test(para)) {
        thoughtLocations.push(pi);
        break;
      }
    }
  }

  // 检测相邻段落是否有过多内心独白
  for (let i = 0; i < thoughtLocations.length - 2; i++) {
    const loc0 = thoughtLocations[i];
    const loc2 = thoughtLocations[i + 2];
    if (loc0 !== undefined && loc2 !== undefined && loc2 - loc0 <= 3) {
      issues.push({
        type: "repetitive_thoughts",
        description: `第${loc0 + 1}-${loc2 + 1}段短距离内出现3次内心独白，建议减少直接心理描写`,
        location: loc0,
      });
      break;
    }
  }
}

/**
 * 检测中英混杂
 */
function checkMixedLanguage(content: string, issues: AntiAiIssue[]): void {
  const englishWords = content.match(/[a-zA-Z]{4,}/g);
  if (!englishWords) return;

  const allowlist = new Set([
    "email", "wifi", "app", "GPS", "DNA", "AI", "OK", "CPU", "USB",
    "iPhone", "Android", "Windows", "Linux", "Google", "Apple",
  ]);

  const suspicious = englishWords.filter(
    (w) => !allowlist.has(w) && !allowlist.has(w.toUpperCase()),
  );

  if (suspicious.length >= 3) {
    issues.push({
      type: "mixed_language",
      description: `检测到${suspicious.length}处非必要英文词汇混入中文叙述`,
      evidence: suspicious.slice(0, 5).join(", "),
    });
  }
}

/**
 * 从文本中提取包含关键词的上下文
 */
function extractContext(content: string, keyword: string, windowSize = 30): string {
  const index = content.indexOf(keyword);
  if (index === -1) return keyword;

  const start = Math.max(0, index - windowSize);
  const end = Math.min(content.length, index + keyword.length + windowSize);
  return (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
}

/**
 * 计算中文字数（排除标点和空格）
 */
export function countChineseWords(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return chineseChars ? chineseChars.length : 0;
}

/**
 * 计算总字数（中文字符 + 英文单词）
 */
export function countWords(text: string): number {
  const chinese = countChineseWords(text);
  const english = text.match(/[a-zA-Z]+/g)?.length ?? 0;
  return chinese + english;
}

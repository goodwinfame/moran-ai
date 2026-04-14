import { describe, expect, it } from "vitest";
import { checkAntiAi, countWords, countChineseWords } from "../anti-ai-checker.js";

describe("Anti-AI Checker", () => {
  describe("countWords", () => {
    it("counts Chinese characters", () => {
      expect(countWords("你好世界")).toBe(4);
    });

    it("counts English words", () => {
      expect(countWords("hello world")).toBe(2);
    });

    it("counts mixed Chinese + English", () => {
      expect(countWords("他说hello world")).toBe(4); // 2 Chinese + 2 English
    });

    it("returns 0 for empty string", () => {
      expect(countWords("")).toBe(0);
    });
  });

  describe("countChineseWords", () => {
    it("counts only Chinese characters", () => {
      expect(countChineseWords("你好world")).toBe(2);
    });

    it("ignores punctuation", () => {
      expect(countChineseWords("你好，世界！")).toBe(4);
    });
  });

  describe("checkAntiAi — burstiness", () => {
    it("passes for text with varied sentence lengths", () => {
      // Deliberately varied sentence lengths for high burstiness
      const text = `短句。
这是一个稍微长一些的句子，用来增加变化度。
短。
她看着窗外的雨，雨滴打在玻璃上发出细碎的声响，让整个房间都安静了下来，仿佛时间也慢了半拍。
走吧。
他站起身来。`;

      const result = checkAntiAi(text);
      expect(result.burstiness).toBeGreaterThan(0.2);
    });

    it("detects low burstiness (uniform sentence lengths)", () => {
      // All sentences roughly same length — AI signature
      const lines = [];
      for (let i = 0; i < 10; i++) {
        lines.push("这是一个长度完全一致的标准句子" + String(i));
      }
      const text = lines.join("。") + "。";
      const result = checkAntiAi(text);
      expect(result.burstiness).toBeLessThan(0.3);
    });

    it("returns 0.5 for very short text (< 3 sentences)", () => {
      const result = checkAntiAi("短句。短短。");
      expect(result.burstiness).toBe(0.5);
    });
  });

  describe("checkAntiAi — repetitive structure", () => {
    it("detects consecutive same-subject sentences", () => {
      const text = `他站了起来。他走到窗前。他看着外面。他叹了口气。`;
      const result = checkAntiAi(text);
      const hasRepetitive = result.issues.some((i) => i.type === "repetitive_structure");
      expect(hasRepetitive).toBe(true);
    });

    it("passes for varied subject sentences", () => {
      const text = `他站了起来。窗外传来鸟叫。她转过头看了一眼。风吹动了窗帘。`;
      const result = checkAntiAi(text);
      const hasRepetitive = result.issues.some((i) => i.type === "repetitive_structure");
      expect(hasRepetitive).toBe(false);
    });
  });

  describe("checkAntiAi — emotional telling", () => {
    it("detects direct emotional telling", () => {
      const text = `他感到一阵恐惧。他觉得自己很无助。他心中充满了悲伤。她不禁感到了一阵寒意。`;
      const result = checkAntiAi(text);
      const hasTelling = result.issues.some((i) => i.type === "emotional_telling");
      expect(hasTelling).toBe(true);
    });
  });

  describe("checkAntiAi — sensory overload", () => {
    it("detects excessive sensory descriptions in one paragraph", () => {
      const text = `他看到远处的山峦，听到风声在耳边呼啸。空气中弥漫着花香的气味，手指触碰到冰凉的石壁，嘴里还残留着刚才那杯苦涩的茶的余味。这种五感齐开的描写在小说中是不好的习惯。`;
      const result = checkAntiAi(text);
      const hasSensory = result.issues.some((i) => i.type === "sensory_overload");
      expect(hasSensory).toBe(true);
    });
  });

  describe("checkAntiAi — forbidden words", () => {
    it("detects forbidden words", () => {
      const result = checkAntiAi("他的眼眸如星辰般闪耀", {
        words: ["眼眸"],
      });
      const hasForbidden = result.issues.some((i) => i.type === "forbidden_word");
      expect(hasForbidden).toBe(true);
      expect(result.passed).toBe(false);
    });

    it("detects forbidden regex patterns", () => {
      const result = checkAntiAi("他不禁感到不禁有些紧张", {
        patterns: ["他不禁.{0,10}不禁"],
      });
      const hasForbidden = result.issues.some((i) => i.type === "forbidden_word");
      expect(hasForbidden).toBe(true);
    });

    it("passes when no forbidden words present", () => {
      const result = checkAntiAi("她走在街上，路灯照亮了前方的路。", {
        words: ["眼眸", "星辰"],
      });
      const hasForbidden = result.issues.some((i) => i.type === "forbidden_word");
      expect(hasForbidden).toBe(false);
    });
  });

  describe("checkAntiAi — repetitive thoughts", () => {
    it("detects close-proximity inner monologues", () => {
      // Patterns: 他想着, 他心里, 他在心
      // Need 3 matches within 3 paragraphs of each other (loc2 - loc0 <= 3)
      const text = `他想着该怎么办才好。

门外有人经过。

他心里盘算着下一步。

他在心中暗暗发誓。`;

      const result = checkAntiAi(text);
      const hasThoughts = result.issues.some((i) => i.type === "repetitive_thoughts");
      expect(hasThoughts).toBe(true);
    });
  });

  describe("checkAntiAi — mixed language", () => {
    it("detects excessive non-essential English", () => {
      const text = `他走进了building，看到了一个beautiful的women，心里觉得非常excited。这种feeling让他想起了childhood的memory。`;
      const result = checkAntiAi(text);
      const hasMixed = result.issues.some((i) => i.type === "mixed_language");
      expect(hasMixed).toBe(true);
    });

    it("allows common English terms (email, wifi, etc)", () => {
      const text = `她打开了email，连上了wifi，准备给他发个消息。`;
      const result = checkAntiAi(text);
      const hasMixed = result.issues.some((i) => i.type === "mixed_language");
      expect(hasMixed).toBe(false);
    });
  });

  describe("checkAntiAi — overall pass/fail", () => {
    it("passes clean natural text", () => {
      const text = `雨停了，但街上还是湿的。
她撑着伞走过巷口，看到卖豆花的老陈正在收摊。泡沫箱里还剩半箱豆花，热气从缝隙里冒出来，在冷空气里变成一小团白雾。
"还有吗？"她问。
老陈看了她一眼，舀了一碗。"最后一碗，不收你钱。"
她接过碗，没说谢谢。老陈也不需要她说。他们认识二十年了，从她还够不到摊子的时候就开始了。`;

      const result = checkAntiAi(text);
      expect(result.passed).toBe(true);
    });

    it("fails when forbidden words detected", () => {
      const result = checkAntiAi("他的眼眸如星辰般闪耀。日子一天天过去。", {
        words: ["眼眸"],
      });
      expect(result.passed).toBe(false);
    });
  });
});

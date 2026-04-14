import { describe, expect, it } from "vitest";
import { StyleManager } from "../style-manager.js";
import { BUILTIN_PRESETS, DEFAULT_STYLE_ID } from "../presets/index.js";
import type { UserStyleConfig } from "../types.js";

describe("StyleManager", () => {
  describe("constructor — builtin presets", () => {
    it("loads all 9 builtin presets on construction", () => {
      const sm = new StyleManager();
      const styles = sm.listStyles();
      expect(styles).toHaveLength(9);
    });

    it("marks all builtins as source=builtin", () => {
      const sm = new StyleManager();
      for (const s of sm.listStyles()) {
        expect(s.source).toBe("builtin");
      }
    });

    it("has default style (云墨)", () => {
      const sm = new StyleManager();
      const defaultStyle = sm.getDefaultStyle();
      expect(defaultStyle.styleId).toBe("云墨");
      expect(defaultStyle.displayName).toBe("执笔·云墨");
    });
  });

  describe("getStyle", () => {
    it("returns builtin style by id", () => {
      const sm = new StyleManager();
      const jianxin = sm.getStyle("剑心");
      expect(jianxin.displayName).toBe("执笔·剑心");
      expect(jianxin.genre).toBe("仙侠");
    });

    it("falls back to default for unknown style id", () => {
      const sm = new StyleManager();
      const result = sm.getStyle("不存在的风格");
      expect(result.styleId).toBe(DEFAULT_STYLE_ID);
    });
  });

  describe("hasStyle", () => {
    it("returns true for builtin styles", () => {
      const sm = new StyleManager();
      expect(sm.hasStyle("云墨")).toBe(true);
      expect(sm.hasStyle("暗棋")).toBe(true);
    });

    it("returns false for unknown styles", () => {
      const sm = new StyleManager();
      expect(sm.hasStyle("unknown")).toBe(false);
    });
  });

  describe("getBuiltinPreset", () => {
    it("returns builtin preset data", () => {
      const sm = new StyleManager();
      const preset = sm.getBuiltinPreset("星河");
      expect(preset).toBeDefined();
      expect(preset?.genre).toBe("科幻");
    });

    it("returns undefined for non-builtin", () => {
      const sm = new StyleManager();
      expect(sm.getBuiltinPreset("custom")).toBeUndefined();
    });
  });

  describe("registerUserStyle", () => {
    it("registers a user style with default base", () => {
      const sm = new StyleManager();
      const userConfig: UserStyleConfig = {
        styleId: "my-style",
        displayName: "测试风格",
        source: "user",
        version: 1,
        genre: "测试",
      };

      const merged = sm.registerUserStyle(userConfig);
      expect(merged.styleId).toBe("my-style");
      expect(merged.displayName).toBe("测试风格");
      expect(merged.source).toBe("user");
      expect(merged.genre).toBe("测试");
      // Inherited from default (云墨)
      expect(merged.proseGuide).toBeTruthy();
    });

    it("registers a fork style with builtin base", () => {
      const sm = new StyleManager();
      const userConfig: UserStyleConfig = {
        styleId: "my-jianxin",
        displayName: "自定义·剑心",
        source: "fork",
        forkedFrom: "剑心",
        version: 1,
        tone: { humor: 0.1, tension: 0.9, romance: 0.0, dark: 0.5 },
      };

      const merged = sm.registerUserStyle(userConfig);
      expect(merged.styleId).toBe("my-jianxin");
      expect(merged.forkedFrom).toBe("剑心");
      // Tone overridden
      expect(merged.tone.tension).toBe(0.9);
      // Genre inherited from 剑心
      expect(merged.genre).toBe("仙侠");
    });

    it("falls back to default when fork source not found", () => {
      const sm = new StyleManager();
      const userConfig: UserStyleConfig = {
        styleId: "orphan",
        displayName: "孤儿风格",
        source: "fork",
        forkedFrom: "不存在的风格",
        version: 1,
      };

      const merged = sm.registerUserStyle(userConfig);
      // Falls back to default base
      expect(merged.genre).toBe("通用");
    });

    it("makes registered style accessible via getStyle", () => {
      const sm = new StyleManager();
      sm.registerUserStyle({
        styleId: "custom-1",
        displayName: "自定义1",
        source: "user",
        version: 1,
      });

      const style = sm.getStyle("custom-1");
      expect(style.displayName).toBe("自定义1");
    });
  });

  describe("removeStyle", () => {
    it("removes user style", () => {
      const sm = new StyleManager();
      sm.registerUserStyle({
        styleId: "to-remove",
        displayName: "待删除",
        source: "user",
        version: 1,
      });

      expect(sm.hasStyle("to-remove")).toBe(true);
      expect(sm.removeStyle("to-remove")).toBe(true);
      expect(sm.hasStyle("to-remove")).toBe(false);
    });

    it("refuses to remove builtin style", () => {
      const sm = new StyleManager();
      expect(sm.removeStyle("云墨")).toBe(false);
      expect(sm.hasStyle("云墨")).toBe(true);
    });
  });

  describe("calculateTemperature", () => {
    it("returns temperature for chapter type", () => {
      const sm = new StyleManager();
      const temp = sm.calculateTemperature("云墨", "normal");
      expect(temp).toBeGreaterThan(0.7);
      expect(temp).toBeLessThan(0.9);
    });

    it("returns different temperatures for different chapter types", () => {
      const sm = new StyleManager();
      const daily = sm.calculateTemperature("云墨", "daily");
      const climax = sm.calculateTemperature("云墨", "climax");
      expect(climax).toBeGreaterThan(daily);
    });

    it("falls back to default for unknown style", () => {
      const sm = new StyleManager();
      const temp = sm.calculateTemperature("unknown", "normal");
      expect(temp).toBeGreaterThan(0);
    });
  });

  describe("getTemperatureRange", () => {
    it("returns [min, max] tuple", () => {
      const sm = new StyleManager();
      const range = sm.getTemperatureRange("云墨", "emotional");
      expect(range).toHaveLength(2);
      expect(range[0]).toBeLessThan(range[1]);
    });
  });

  describe("assembleStyleContext", () => {
    it("produces non-empty string", () => {
      const sm = new StyleManager();
      const ctx = sm.assembleStyleContext("云墨");
      expect(ctx.length).toBeGreaterThan(100);
    });

    it("includes style display name", () => {
      const sm = new StyleManager();
      const ctx = sm.assembleStyleContext("云墨");
      expect(ctx).toContain("执笔·云墨");
    });

    it("includes prose guide", () => {
      const sm = new StyleManager();
      const ctx = sm.assembleStyleContext("云墨");
      expect(ctx).toContain("风格指引");
    });

    it("includes examples", () => {
      const sm = new StyleManager();
      const ctx = sm.assembleStyleContext("云墨");
      expect(ctx).toContain("示例段落");
    });
  });

  describe("loadFromDbRow", () => {
    it("loads user style from DB row", () => {
      const sm = new StyleManager();
      const merged = sm.loadFromDbRow({
        styleId: "db-style",
        displayName: "DB风格",
        genre: "科幻",
        description: "测试",
        source: "user",
        forkedFrom: null,
        version: 1,
        modules: null,
        reviewerFocus: null,
        contextWeights: null,
        tone: null,
        forbidden: null,
        encouraged: null,
        proseGuide: null,
        examples: null,
      });

      expect(merged.styleId).toBe("db-style");
      expect(merged.genre).toBe("科幻");
      // Null fields should inherit from default
      expect(merged.modules).toBeDefined();
    });

    it("loads fork style from DB row", () => {
      const sm = new StyleManager();
      const merged = sm.loadFromDbRow({
        styleId: "db-fork",
        displayName: "Fork风格",
        genre: null,
        description: null,
        source: "fork",
        forkedFrom: "暗棋",
        version: 2,
        modules: ["悬念控制"],
        reviewerFocus: null,
        contextWeights: null,
        tone: { humor: 0.0, tension: 0.9, romance: 0.0, dark: 0.8 },
        forbidden: null,
        encouraged: null,
        proseGuide: null,
        examples: null,
      });

      expect(merged.forkedFrom).toBe("暗棋");
      expect(merged.tone.tension).toBe(0.9);
      expect(merged.modules).toContain("悬念控制");
      // Genre inherited from 暗棋
      expect(merged.genre).toBe("悬疑");
    });
  });

  describe("clearCache", () => {
    it("resets to builtins only", () => {
      const sm = new StyleManager();
      sm.registerUserStyle({
        styleId: "temp",
        displayName: "临时",
        source: "user",
        version: 1,
      });
      expect(sm.listStyles()).toHaveLength(10);

      sm.clearCache();
      expect(sm.listStyles()).toHaveLength(9);
      expect(sm.hasStyle("temp")).toBe(false);
    });
  });

  describe("merge logic", () => {
    it("merges context weights correctly", () => {
      const sm = new StyleManager();
      const merged = sm.registerUserStyle({
        styleId: "weighted",
        displayName: "加权",
        source: "user",
        version: 1,
        contextWeights: { world: 2.0 },
      });

      expect(merged.contextWeights.world).toBe(2.0);
      // Others inherit from default
      expect(merged.contextWeights.character).toBe(1.0);
      expect(merged.contextWeights.plot).toBe(1.0);
    });

    it("merges forbidden lists (additive)", () => {
      const sm = new StyleManager();
      const merged = sm.registerUserStyle({
        styleId: "strict",
        displayName: "严格",
        source: "fork",
        forkedFrom: "云墨",
        version: 1,
        forbidden: { words: ["额外禁忌词"] },
      });

      // Should contain both base forbidden patterns and user words
      expect(merged.forbidden.words).toContain("额外禁忌词");
      // Base patterns preserved
      expect(merged.forbidden.patterns?.length).toBeGreaterThan(0);
    });
  });
});

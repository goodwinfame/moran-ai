/**
 * 内置风格预设注册表
 *
 * 9 个预设：云墨(通用) + 8 个题材风格
 * 全部为只读静态资源，随代码发布。
 */

import type { StylePreset } from "../types.js";
import { yunmoPreset } from "./yunmo.js";
import { jianxinPreset } from "./jianxin.js";
import { xinghePreset } from "./xinghe.js";
import { sushouPreset } from "./sushou.js";
import { yanhuoPreset } from "./yanhuo.js";
import { anqiPreset } from "./anqi.js";
import { qingshiPreset } from "./qingshi.js";
import { yelanPreset } from "./yelan.js";
import { xiexingPreset } from "./xiexing.js";

/** 所有内置风格预设 */
export const BUILTIN_PRESETS: ReadonlyMap<string, StylePreset> = new Map([
  ["云墨", yunmoPreset],
  ["剑心", jianxinPreset],
  ["星河", xinghePreset],
  ["素手", sushouPreset],
  ["烟火", yanhuoPreset],
  ["暗棋", anqiPreset],
  ["青史", qingshiPreset],
  ["夜阑", yelanPreset],
  ["谐星", xiexingPreset],
]);

/** 默认风格 ID */
export const DEFAULT_STYLE_ID = "云墨";

export {
  yunmoPreset,
  jianxinPreset,
  xinghePreset,
  sushouPreset,
  yanhuoPreset,
  anqiPreset,
  qingshiPreset,
  yelanPreset,
  xiexingPreset,
};

import { eq } from "drizzle-orm";
import type { Database } from "../index.js";
import { styleConfigs } from "../schema/styles.js";

/**
 * 种子数据 — 9 个内置风格预设
 *
 * 对应 AGENTS.md §5 执笔子写手定义。
 * 风格定义文风（prose voice），不绑定题材。
 * 模型偏好由 OpenCode agent config 管理，不存储在 style 表中。
 *
 * 幂等：先删除所有 source='builtin' 的记录，再重新插入。
 */
export async function seedStyles(db: Database): Promise<void> {
  await db.delete(styleConfigs).where(eq(styleConfigs.source, "builtin"));

  await db.insert(styleConfigs).values([
    {
      styleId: "yunmo",
      displayName: "执笔·云墨",
      description: "均衡万用、自然流畅",
      source: "builtin",
      proseGuide: [
        "文风均衡，适应多种题材",
        "叙事节奏自然流畅，无生硬感",
        "人物刻画细致但不过度",
        "环境描写恰到好处，烘托氛围",
        "对话自然，符合人物身份",
      ].join("\n"),
      encouraged: [
        "保持叙事的自然性，避免过度修饰",
        "人物行动与心理相辅相成",
        "场景转换流畅，逻辑清晰",
        "语言表达精准，避免冗余",
        "整体风格温和，易于接受",
      ],
    },
    {
      styleId: "jianxin",
      displayName: "执笔·剑心",
      description: "冷峻简约、短句、白描、动作化叙事",
      source: "builtin",
      proseGuide: [
        "文风冷峻简约，充满张力",
        "情感外化：将内心感受转为行动细节（他握紧杯子 / 她没有接话），少用\u201c他感到……\u201d直白告知。",
        "短句为主，制造节奏感和紧张感",
        "白描手法，直接呈现场景和动作",
        "避免过度心理描写，让读者自己体会",
      ].join("\n"),
      encouraged: [
        "避免 AI 套路：不以\u201c时间/空间\u201d公式开篇，不以\u201c心里/心中\u201d收尾，句长分布保持 Burstiness \u2265 0.3。",
        "每段落控制在 3-5 句，制造节奏变化",
        "动作优先于描写，让情节推动故事",
        "对话简洁有力，每句不超过 15 字",
        "环境描写融入动作，不单独成段",
      ],
    },
    {
      styleId: "xinghe",
      displayName: "执笔·星河",
      description: "精确、技术感、理性叙述",
      source: "builtin",
      proseGuide: [
        "文风精确严谨，充满技术感",
        "逻辑清晰，因果关系明确",
        "用词精准，避免模糊表达",
        "理性叙述，即使涉及情感也保持客观",
        "信息密度高，每句都有价值",
      ].join("\n"),
      encouraged: [
        "每个细节都要有逻辑支撑",
        "避免感性化的修辞，用事实说话",
        "技术性描写要准确，不能凭想象",
        "人物动机要清晰，不能莫名其妙",
        "整体风格冷静理性，适合科幻/悬疑",
      ],
    },
    {
      styleId: "soushou",
      displayName: "执笔·素手",
      description: "温暖细腻、长句、情感细写、氛围渲染",
      source: "builtin",
      proseGuide: [
        "文风温暖细腻，充满人文关怀",
        "长句为主，营造沉浸感",
        "情感细写，深入人物内心",
        "氛围渲染，让读者感受场景",
        "细节描写丰富，充满生活气息",
      ].join("\n"),
      encouraged: [
        "长句要有节奏，不能冗长拖沓",
        "情感表达要真挚，避免矫情",
        "环境描写要有温度，不是冷冰冰的",
        "人物关系要温暖，即使有冲突也有温度",
        "整体风格温馨，适合言情/家庭题材",
      ],
    },
    {
      styleId: "yanhuo",
      displayName: "执笔·烟火",
      description: "市井烟火气、口语化、快节奏",
      source: "builtin",
      proseGuide: [
        "文风市井烟火，充满生活气息",
        "口语化表达，贴近日常",
        "快节奏，信息密集",
        "人物对话生动，各具特色",
        "场景细节真实，充满烟火气",
      ].join("\n"),
      encouraged: [
        "口语化但不低俗，保持文学性",
        "快节奏但不仓促，逻辑清晰",
        "对话要有个性，不同人物说话方式不同",
        "场景要接地气，反映真实生活",
        "整体风格轻快，适合都市/网文题材",
      ],
    },
    {
      styleId: "anqi",
      displayName: "执笔·暗棋",
      description: "层层递进、信息控制、悬念留白",
      source: "builtin",
      proseGuide: [
        "文风层层递进，充满悬念",
        "信息控制精妙，制造反转",
        "留白艺术，让读者自己补脑",
        "节奏张弛有度，高潮迭起",
        "细节埋伏，为后续反转铺垫",
      ].join("\n"),
      encouraged: [
        "信息披露要有节奏，不能一次性说完",
        "悬念要合理，不能无故制造",
        "留白要有意义，不是简单的省略",
        "反转要有逻辑支撑，不能凭空出现",
        "整体风格紧张，适合悬疑/推理题材",
      ],
    },
    {
      styleId: "qingshi",
      displayName: "执笔·青史",
      description: "典雅庄重、文白混用、时代语感",
      source: "builtin",
      proseGuide: [
        "文风典雅庄重，充满历史感",
        "文白混用，既有古韵又有现代感",
        "时代语感准确，符合背景设定",
        "用词讲究，避免现代俚语",
        "整体格调高雅，充满文化底蕴",
      ].join("\n"),
      encouraged: [
        "文言词汇要恰当，不能生硬堆砌",
        "时代背景要准确，不能混淆",
        "人物身份要符合时代，说话方式要对应",
        "环境描写要有历史感，体现时代特色",
        "整体风格庄重，适合历史/古代题材",
      ],
    },
    {
      styleId: "yelan",
      displayName: "执笔·夜阑",
      description: "压抑、感官描写密集、心理暗示",
      source: "builtin",
      proseGuide: [
        "文风压抑沉闷，充满心理张力",
        "感官描写密集，制造不适感",
        "心理暗示深层，引发读者共鸣",
        "氛围压抑，充满不安感",
        "细节诡异，制造恐怖感",
      ].join("\n"),
      encouraged: [
        "压抑感要来自细节，不能直白说\u201c很压抑\u201d",
        "感官描写要真实，不能过度夸张",
        "心理暗示要深层，让读者自己体会",
        "氛围要一致，不能突然转变",
        "整体风格压抑，适合恐怖/悬疑题材",
      ],
    },
    {
      styleId: "xiexing",
      displayName: "执笔·谐星",
      description: "轻快、节奏明快、反差幽默",
      source: "builtin",
      proseGuide: [
        "文风轻快活泼，充满幽默感",
        "节奏明快，信息密集",
        "反差幽默，制造笑点",
        "人物对话生动，充满趣味",
        "场景设置有趣，充满想象力",
      ].join("\n"),
      encouraged: [
        "幽默要自然，不能生硬",
        "反差要合理，不能莫名其妙",
        "节奏要快但清晰，不能混乱",
        "对话要有趣，每个人物都有特色",
        "整体风格轻松，适合喜剧/网文题材",
      ],
    },
  ]);
}

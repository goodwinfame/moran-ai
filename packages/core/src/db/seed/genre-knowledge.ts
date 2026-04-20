import { and, eq } from "drizzle-orm";
import type { Database } from "../index.js";
import { knowledgeEntries } from "../schema/knowledge.js";

/**
 * 种子数据 — 8 个内置题材技法知识条目
 *
 * 对应 AGENTS.md §5 题材技法管理。
 * 预置题材技法（source='builtin'，scope='global'）由 seed 脚本管理。
 * context_assemble 加载时项目级覆盖全局级（同 title 时项目级优先）。
 *
 * 幂等：先删除所有 source='builtin' + scope='global' + category='genre' 的记录，再重新插入。
 */
export async function seedGenreKnowledge(db: Database): Promise<void> {
  await db
    .delete(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.source, "builtin"),
        eq(knowledgeEntries.scope, "global"),
        eq(knowledgeEntries.category, "genre"),
      ),
    );

  await db.insert(knowledgeEntries).values([
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "言情节奏设计",
      content: [
        "感情线发展遵循\u201c陌生\u2192接近\u2192冲突\u2192和解\u2192深化\u201d的五阶段模型",
        "人物关系发展遵循\u201c接近\u2014后退\u2014接近\u201d的波动节奏，避免线性推进",
        "高潮前要有足够的铺垫，让读者期待",
        "冲突要有逻辑，不能无故出现",
        "和解要有代价，不能轻易化解",
      ].join("\n"),
      tags: ["romance"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "奇幻世界观构建",
      content: [
        "世界观要有完整的魔法体系或科技体系",
        "种族/阵营设定要清晰，避免混淆",
        "历史背景要合理，解释现状",
        "地理环境要影响人物和情节",
        "规则要一致，不能随意改变",
      ].join("\n"),
      tags: ["fantasy"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "悬疑推理情节设计",
      content: [
        "谜团要在开篇就埋下，让读者有悬念",
        "线索要分散在全文，不能集中在某处",
        "红鲱鱼要合理，不能太明显",
        "真相揭露要有逻辑，不能凭空出现",
        "结局要满足读者期待，同时有惊喜",
      ].join("\n"),
      tags: ["mystery"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "科幻逻辑自洽",
      content: [
        "科技设定要有逻辑基础，不能凭空出现",
        "未来社会结构要合理，符合科技发展",
        "人物行为要符合设定，不能违反规则",
        "冲突要源于设定本身，不是外部强加",
        "结局要符合逻辑，不能强行解决",
      ].join("\n"),
      tags: ["scifi"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "恐怖氛围营造",
      content: [
        "恐怖感要来自细节，不能直白描写",
        "氛围要逐步升级，制造心理压力",
        "角色反应要真实，增强代入感",
        "未知要保持神秘，不要过早揭露",
        "高潮要有冲击力，但不能过度暴力",
      ].join("\n"),
      tags: ["horror"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "都市题材真实性",
      content: [
        "城市背景要真实，反映现实生活",
        "人物职业设定要准确，避免常识错误",
        "社交关系要复杂，体现都市特色",
        "经济因素要考虑，影响人物选择",
        "时代背景要准确，符合当下或设定时间",
      ].join("\n"),
      tags: ["urban"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "历史题材考证",
      content: [
        "历史背景要准确，不能随意改编",
        "人物身份要符合时代，说话方式要对应",
        "社会制度要合理，反映历史现实",
        "文化细节要讲究，增强代入感",
        "虚实结合要恰当，不能过度虚构",
      ].join("\n"),
      tags: ["historical"],
      consumers: ["writer", "jiangxin"],
    },
    {
      scope: "global",
      category: "genre",
      source: "builtin",
      title: "人物成长弧线",
      content: [
        "人物要有明确的起点和终点",
        "成长要有触发事件，不能无故改变",
        "过程要有挫折，不能一帆风顺",
        "改变要有代价，体现成长的真实性",
        "最终状态要符合逻辑，是前期铺垫的结果",
      ].join("\n"),
      tags: ["general"],
      consumers: ["writer", "jiangxin", "mingjing"],
    },
  ]);
}

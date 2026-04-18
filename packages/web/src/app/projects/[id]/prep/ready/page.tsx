"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

interface StepStatus {
  title: string;
  id: string;
  summary: string;
  confirmed: boolean;
  href: string;
}

export default function ReadyPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) ?? "unknown";

  const [steps, setSteps] = useState<StepStatus[]>([
    { title: "创作意图", id: "intent", summary: "加载中...", confirmed: false, href: `/projects/${projectId}/prep/intent` },
    { title: "世界观", id: "world", summary: "加载中...", confirmed: false, href: `/projects/${projectId}/prep/world` },
    { title: "角色", id: "characters", summary: "加载中...", confirmed: false, href: `/projects/${projectId}/prep/characters` },
    { title: "文风", id: "style", summary: "加载中...", confirmed: false, href: `/projects/${projectId}/prep/style` },
    { title: "大纲", id: "outline", summary: "加载中...", confirmed: false, href: `/projects/${projectId}/prep/outline` },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results: StepStatus[] = [];

      // 1. 项目信息（创作意图）
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = (await res.json()) as {
          title?: string;
          genre?: string;
          status?: string;
        };
        const hasIntent = Boolean(data.title && data.genre);
        results.push({
          title: "创作意图",
          id: "intent",
          summary: hasIntent
            ? `${data.genre} / ${data.title}`
            : "尚未设定",
          confirmed: hasIntent,
          href: `/projects/${projectId}/prep/intent`,
        });
      } catch {
        results.push({
          title: "创作意图",
          id: "intent",
          summary: "加载失败",
          confirmed: false,
          href: `/projects/${projectId}/prep/intent`,
        });
      }

      // 2. 世界观
      try {
        const res = await fetch(
          `/api/projects/${projectId}/world`
        );
        const data = (await res.json()) as {
          settings?: Array<{ name: string }>;
          total?: number;
        };
        const count = data.total ?? data.settings?.length ?? 0;
        results.push({
          title: "世界观",
          id: "world",
          summary:
            count > 0
              ? `${count} 个子系统已定义`
              : "尚未设定",
          confirmed: count > 0,
          href: `/projects/${projectId}/prep/world`,
        });
      } catch {
        results.push({
          title: "世界观",
          id: "world",
          summary: "加载失败",
          confirmed: false,
          href: `/projects/${projectId}/prep/world`,
        });
      }

      // 3. 角色
      try {
        const res = await fetch(
          `/api/projects/${projectId}/characters`
        );
        const data = (await res.json()) as {
          characters?: Array<{ name: string; role: string }>;
          total?: number;
        };
        const count = data.total ?? data.characters?.length ?? 0;
        const protagonist = data.characters?.find(
          (c) => c.role === "protagonist"
        );
        results.push({
          title: "角色",
          id: "characters",
          summary:
            count > 0
              ? `${count} 个角色${protagonist ? ` (主角: ${protagonist.name})` : ""}`
              : "尚未设定",
          confirmed: count > 0,
          href: `/projects/${projectId}/prep/characters`,
        });
      } catch {
        results.push({
          title: "角色",
          id: "characters",
          summary: "加载失败",
          confirmed: false,
          href: `/projects/${projectId}/prep/characters`,
        });
      }

      // 4. 文风
      try {
        const res = await fetch(
          `/api/projects/${projectId}/styles`
        );
        const data = (await res.json()) as {
          styles?: Array<{ displayName: string }>;
          total?: number;
        };
        const count = data.total ?? data.styles?.length ?? 0;
        results.push({
          title: "文风",
          id: "style",
          summary:
            count > 0
              ? `${count} 个风格可用`
              : "尚未设定",
          confirmed: count > 0,
          href: `/projects/${projectId}/prep/style`,
        });
      } catch {
        results.push({
          title: "文风",
          id: "style",
          summary: "加载失败",
          confirmed: false,
          href: `/projects/${projectId}/prep/style`,
        });
      }

      // 5. 大纲
      try {
        const res = await fetch(
          `/api/projects/${projectId}/outline`
        );
        const data = (await res.json()) as {
          outline?: { synopsis: string } | null;
          arcs?: Array<{ title: string }>;
          totalArcs?: number;
        };
        const arcCount = data.totalArcs ?? data.arcs?.length ?? 0;
        results.push({
          title: "大纲",
          id: "outline",
          summary:
            arcCount > 0
              ? `${arcCount} 个弧段已规划`
              : data.outline
                ? "大纲已创建，待规划弧段"
                : "尚未设定",
          confirmed: arcCount > 0,
          href: `/projects/${projectId}/prep/outline`,
        });
      } catch {
        results.push({
          title: "大纲",
          id: "outline",
          summary: "加载失败",
          confirmed: false,
          href: `/projects/${projectId}/prep/outline`,
        });
      }

      setSteps(results);
      setLoading(false);
    };

    void fetchAll();
  }, [projectId]);

  const allConfirmed = steps.every((s) => s.confirmed);

  return (
    <div className="flex-1 bg-[#F8F9FA] h-full overflow-y-auto p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto size-16 bg-[#1A202C] rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/10 mb-6">
            <Icon
              name={allConfirmed ? "verified" : "pending"}
              size={32}
              className="text-white"
              filled
            />
          </div>
          <h1 className="font-serif text-4xl text-slate-900">
            {allConfirmed ? "准备就绪" : "筹备进度"}
          </h1>
          <p className="text-lg text-slate-500">
            {allConfirmed
              ? "所有的基础设定已对齐，随时可以开始创作。"
              : "完成以下步骤后即可开始创作。"}
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl text-[#1A202C]">
                  {step.title}
                </h3>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 ${
                    step.confirmed
                      ? "text-emerald-600 bg-emerald-50"
                      : loading
                        ? "text-slate-400 bg-slate-50"
                        : "text-amber-600 bg-amber-50"
                  }`}
                >
                  <Icon
                    name={
                      step.confirmed
                        ? "check"
                        : loading
                          ? "hourglass_empty"
                          : "warning"
                    }
                    size={14}
                  />
                  {step.confirmed ? "已确认" : loading ? "检查中" : "待完成"}
                </span>
              </div>
              <p className="text-sm text-slate-500 flex-1">{step.summary}</p>
              <button
                onClick={() => router.push(step.href)}
                className="mt-6 self-start text-xs font-bold text-[#1A202C] uppercase tracking-widest hover:underline flex items-center gap-1"
              >
                {step.confirmed ? "编辑设定" : "前往设定"}
              </button>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-8">
          <button
            onClick={() => {
              if (allConfirmed) {
                router.push(`/projects/${projectId}/write`);
              }
            }}
            disabled={!allConfirmed}
            className={`w-full font-bold text-xl py-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 ${
              allConfirmed
                ? "bg-[#1A202C] hover:bg-slate-800 text-white shadow-slate-900/20"
                : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
            }`}
          >
            开始写作
            <Icon name="arrow_forward" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

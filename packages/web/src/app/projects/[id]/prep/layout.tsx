"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const PREP_STEPS = [
  { key: "intent", label: "创作意图", icon: "lightbulb" },
  { key: "world", label: "世界观", icon: "public" },
  { key: "characters", label: "角色", icon: "group" },
  { key: "style", label: "文风", icon: "palette" },
  { key: "outline", label: "大纲", icon: "list_alt" },
  { key: "ready", label: "准备就绪", icon: "check_circle" },
] as const;

export default function PrepLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();

  const currentIndex = PREP_STEPS.findIndex((s) =>
    pathname.endsWith(`/prep/${s.key}`)
  );

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <aside className="w-[220px] bg-[#1A202C] flex flex-col py-6 px-3 shrink-0">
        <div className="px-3 mb-6">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">筹备步骤</h3>
        </div>
        <nav className="flex flex-col gap-1">
          {PREP_STEPS.map((step, i) => {
            const href = `/projects/${params.id}/prep/${step.key}`;
            const isActive = i === currentIndex;
            const isCompleted = i < currentIndex;

            return (
              <Link
                key={step.key}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  isActive
                    ? "bg-white text-[#1A202C] font-bold shadow-sm"
                    : isCompleted
                      ? "text-slate-500 hover:text-slate-300"
                      : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Icon
                  name={isCompleted ? "check_circle" : isActive ? "radio_button_checked" : "radio_button_unchecked"}
                  filled={isActive || isCompleted}
                  size={20}
                  className={
                    isActive
                      ? "text-[#1A202C]"
                      : isCompleted
                        ? "text-slate-500"
                        : "text-slate-500"
                  }
                />
                <span>{step.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

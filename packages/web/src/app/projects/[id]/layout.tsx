"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";

const WRITING_PANELS = [
  { key: "read", label: "阅读", icon: "auto_stories" },
  { key: "write", label: "写作", icon: "edit_note" },
  { key: "review", label: "审校", icon: "rate_review" },
  { key: "manage", label: "管理", icon: "folder_open" },
  { key: "analysis", label: "分析", icon: "analytics" },
  { key: "settings", label: "设定", icon: "tune" },
  { key: "visualize", label: "可视化", icon: "hub" },
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const isPrep = pathname.includes("/prep/");

  return (
    <div className="flex flex-col h-screen">
      {/* Top navigation */}
      <header className="flex items-center h-14 px-4 bg-white border-b border-slate-100 shrink-0">
        <Link href="/" className="flex items-center gap-2 mr-4">
          <LogoIcon size={24} />
          <span className="font-serif font-semibold text-[#1A202C]">墨染</span>
          <span className="text-xs text-[#1A202C]/40 font-sans tracking-widest">MORAN</span>
        </Link>

        <div className="w-px h-6 bg-slate-200 mx-3" />

        {/* Breadcrumb / nav */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-400">
          {isPrep ? (
            <span className="text-[#1A202C] font-medium">筹备阶段</span>
          ) : (
            <>
              {WRITING_PANELS.map((panel) => {
                const href = `/projects/${params.id}/${panel.key}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={panel.key}
                    href={href}
                    className={`px-3 py-1.5 rounded-md transition-colors text-sm ${
                      active
                        ? "bg-[#1A202C] text-white font-medium"
                        : "text-slate-500 hover:text-[#1A202C] hover:bg-slate-50"
                    }`}
                  >
                    {panel.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Icon name="help_outline" size={20} className="text-slate-400" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#1A202C] flex items-center justify-center">
            <span className="text-xs text-white font-medium">U</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

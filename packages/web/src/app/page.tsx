"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoText } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";
import type { ProjectInfo } from "@/stores/project-store";

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ projects: ProjectInfo[] }>("/api/projects")
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-slate-100">
        <LogoText height={28} />
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Icon name="help_outline" size={20} className="text-slate-400" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#1A202C] flex items-center justify-center">
            <span className="text-xs text-white font-medium">U</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Icon name="progress_activity" size={32} className="text-slate-300 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectList projects={projects} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#1A202C]/5 flex items-center justify-center">
        <Icon name="auto_stories" size={36} className="text-[#1A202C]/40" />
      </div>
      <h2 className="text-2xl font-semibold text-[#1A202C] font-serif">开始你的创作</h2>
      <p className="mt-2 text-slate-500 max-w-md mx-auto">
        每一部伟大的作品都始于一个灵感。创建你的第一个项目，让 AI 成为你的创作伙伴。
      </p>
      <Link
        href="/projects/new"
        className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#1A202C] text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
      >
        <Icon name="add" size={20} className="text-white" />
        创建新项目
      </Link>
    </div>
  );
}

function ProjectList({ projects }: { projects: ProjectInfo[] }) {
  const statusLabel: Record<string, string> = {
    planning: "规划中",
    intent: "创作意图",
    world: "世界观",
    characters: "角色",
    style: "文风",
    outline: "大纲",
    ready: "准备就绪",
    active: "写作中",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold text-[#1A202C] font-serif">我的项目</h2>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A202C] text-white rounded-lg hover:bg-[#2D3748] transition-colors text-sm font-medium"
        >
          <Icon name="add" size={18} className="text-white" />
          新项目
        </Link>
      </div>
      <div className="grid gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={
              p.status === "active"
                ? `/projects/${p.id}/write`
                : `/projects/${p.id}/prep/${p.status === "planning" ? "intent" : p.status}`
            }
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1A202C]/5 flex items-center justify-center shrink-0">
              <Icon name="book" size={24} className="text-[#1A202C]/50" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1A202C] truncate group-hover:text-[#2D3748]">
                {p.name}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                <span>{p.genre}</span>
                <span>·</span>
                <span>{statusLabel[p.status] ?? p.status}</span>
                {p.totalWords > 0 && (
                  <>
                    <span>·</span>
                    <span>{(p.totalWords / 10000).toFixed(1)}万字</span>
                  </>
                )}
              </div>
            </div>
            <Icon
              name="chevron_right"
              size={20}
              className="text-slate-300 group-hover:text-slate-500 transition-colors"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoText } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";

const GENRES = [
  { id: "fantasy", name: "玄幻", icon: "auto_fix_high" },
  { id: "urban", name: "都市", icon: "location_city" },
  { id: "romance", name: "言情", icon: "favorite" },
  { id: "scifi", name: "科幻", icon: "rocket" },
  { id: "mystery", name: "悬疑", icon: "search" },
  { id: "history", name: "历史", icon: "account_balance" },
  { id: "fanfic", name: "同人", icon: "groups" },
  { id: "custom", name: "自定义", icon: "edit" },
];

const TARGET_OPTIONS = [
  { value: "100000", label: "短篇（10万字以内）" },
  { value: "300000", label: "中篇（10-50万字）" },
  { value: "500000", label: "长篇（50万字以上）" },
];

interface CreateProjectResponse {
  id: string;
  title: string;
  genre: string | null;
  targetWordCount: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [inspiration, setInspiration] = useState("");
  const [targetLength, setTargetLength] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const project = await api.post<CreateProjectResponse>("/api/projects", {
        title: name.trim(),
        genre: genre || undefined,
        targetWordCount: targetLength ? Number(targetLength) : undefined,
      });

      // Redirect to intent alignment (first step of prep)
      router.push(`/projects/${project.id}/prep/intent`);
    } catch (e) {
      const msg =
        e !== null && typeof e === "object" && "error" in e
          ? String((e as { error: string }).error)
          : "创建项目失败，请重试";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <LogoText />
        </Link>
        <div className="flex items-center gap-4">
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <Icon name="help" className="h-5 w-5" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-500 hover:ring-2 hover:ring-slate-300 transition-all">
            <Icon name="person" className="mt-2 h-full w-full" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 font-serif text-3xl text-[#1A202C]">创建新项目</h1>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="name" className="block font-medium text-[#1A202C]">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给你的故事起个名字"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#1A202C] focus:ring-1 focus:ring-[#1A202C]"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-3">
            <label className="block font-medium text-[#1A202C]">
              题材类型 <span className="ml-2 text-sm font-normal text-slate-400">(单选)</span>
            </label>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {GENRES.map((g) => {
                const isSelected = genre === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGenre(isSelected ? "" : g.id)}
                    disabled={submitting}
                    className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-4 transition-all ${
                      isSelected
                        ? "bg-[#1A202C]/5 ring-2 ring-[#1A202C] shadow-sm"
                        : "border border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:shadow-md"
                    } disabled:opacity-50`}
                  >
                    <Icon
                      name={g.icon}
                      className={`h-7 w-7 ${
                        isSelected ? "text-[#1A202C]" : "text-slate-400"
                      }`}
                    />
                    <span className={`text-sm ${isSelected ? "font-medium text-[#1A202C]" : ""}`}>
                      {g.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="inspiration" className="block font-medium text-[#1A202C]">
              一句话灵感 <span className="ml-2 text-sm font-normal text-slate-400">(可选)</span>
            </label>
            <textarea
              id="inspiration"
              value={inspiration}
              onChange={(e) => setInspiration(e.target.value)}
              placeholder="例如：一个失忆的杀手在异世界重新开始"
              className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#1A202C] focus:ring-1 focus:ring-[#1A202C]"
              disabled={submitting}
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="targetLength" className="block font-medium text-[#1A202C]">
              目标篇幅 <span className="ml-2 text-sm font-normal text-slate-400">(可选)</span>
            </label>
            <div className="relative">
              <select
                id="targetLength"
                value={targetLength}
                onChange={(e) => setTargetLength(e.target.value)}
                disabled={submitting}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none transition-all focus:border-[#1A202C] focus:ring-1 focus:ring-[#1A202C] disabled:opacity-50"
              >
                <option value="">选择目标篇幅</option>
                {TARGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                <Icon name="expand_more" className="h-5 w-5 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="w-full rounded-xl bg-[#1A202C] px-6 py-4 text-lg font-bold text-white transition-all hover:bg-[#2D3748] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  创建中…
                </span>
              ) : (
                "开始创作"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

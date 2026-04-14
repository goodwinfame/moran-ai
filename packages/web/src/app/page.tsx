import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const PANELS = [
  { href: "/read", emoji: "📖", title: "阅读", desc: "浏览已完成的章节", color: "border-blue-200" },
  { href: "/write", emoji: "✍️", title: "写作", desc: "触发写作与流式输出", color: "border-green-200" },
  { href: "/review", emoji: "🔍", title: "审校", desc: "查看审校结果与批注", color: "border-orange-200" },
  { href: "/manage", emoji: "🗂️", title: "管理", desc: "项目统计与数据管理", color: "border-amber-200" },
  { href: "/analysis", emoji: "📊", title: "分析", desc: "参考作品深度分析", color: "border-purple-200" },
  { href: "/settings", emoji: "⚙️", title: "设定", desc: "世界观、角色与大纲", color: "border-gray-200" },
  { href: "/visualize", emoji: "🗺️", title: "可视化", desc: "人物关系、地点与时间线", color: "border-teal-200" },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-full">
      <h1 className="text-4xl font-bold tracking-tight">墨染 MoRan</h1>
      <p className="mt-2 text-lg text-muted-foreground">AI 长篇小说创作平台</p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-5xl w-full">
        {PANELS.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card className={`cursor-pointer transition-shadow hover:shadow-md border-2 ${p.color}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{p.emoji}</span>
                  {p.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{p.desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

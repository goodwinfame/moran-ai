"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  PenTool,
  Search,
  LayoutDashboard,
  BarChart3,
  Settings,
  Map,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/read", label: "阅读", icon: BookOpen, color: "text-blue-600" },
  { href: "/write", label: "写作", icon: PenTool, color: "text-green-600" },
  { href: "/review", label: "审校", icon: Search, color: "text-orange-500" },
  { href: "/manage", label: "管理", icon: LayoutDashboard, color: "text-amber-700" },
  { href: "/analysis", label: "分析", icon: BarChart3, color: "text-purple-600" },
  { href: "/settings", label: "设定", icon: Settings, color: "text-gray-600" },
  { href: "/visualize", label: "可视化", icon: Map, color: "text-teal-600" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
        {/* Logo */}
        <Link
          href="/"
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg"
        >
          墨
        </Link>

        {/* Nav Items */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", isActive && item.color)}
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

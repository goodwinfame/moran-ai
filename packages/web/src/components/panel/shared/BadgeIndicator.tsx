/**
 * BadgeIndicator — renders dot, count, or live badge on a tab.
 */
"use client";

import { cn } from "@/lib/utils";
import type { BadgeType } from "@/stores/panel-store";

interface BadgeIndicatorProps {
  badge: BadgeType;
  className?: string;
}

export function BadgeIndicator({ badge, className }: BadgeIndicatorProps) {
  if (badge.type === "dot") {
    return (
      <span
        aria-label="new content"
        className={cn(
          "inline-block w-2 h-2 rounded-full bg-primary",
          className,
        )}
      />
    );
  }

  if (badge.type === "count") {
    return (
      <span
        aria-label={`${badge.value} updates`}
        className={cn(
          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
          "rounded-full bg-primary text-primary-foreground text-[10px] font-semibold",
          className,
        )}
      >
        {badge.value > 99 ? "99+" : badge.value}
      </span>
    );
  }

  // live
  return (
    <span
      aria-label="live"
      className={cn(
        "inline-flex items-center gap-0.5",
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
    </span>
  );
}

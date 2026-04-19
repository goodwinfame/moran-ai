/**
 * TabEmptyState — empty state shown inside a tab when no data is available.
 */
"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface TabEmptyStateProps {
  icon?: string;
  /** Main message text */
  title?: string;
  /** Alias for title — accepted for backwards compatibility */
  text?: string;
  description?: string;
  className?: string;
}

export function TabEmptyState({
  icon = "inbox",
  title,
  text,
  description,
  className,
}: TabEmptyStateProps) {
  const message = title ?? text ?? "";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center",
        className,
      )}
    >
      <Icon name={icon} size={40} className="text-muted-foreground/50" />
      {message && (
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      )}
      {description && (
        <p className="text-xs text-muted-foreground/70 max-w-[240px]">
          {description}
        </p>
      )}
    </div>
  );
}

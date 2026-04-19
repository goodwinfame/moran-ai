/**
 * CollapsibleSection — expandable/collapsible section with header.
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Optional badge text shown next to the title */
  badge?: string;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  className,
  headerClassName,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "text-sm font-medium text-left hover:bg-muted/50 transition-colors",
          headerClassName,
        )}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge !== undefined && (
            <span className="text-xs text-muted-foreground font-normal">{badge}</span>
          )}
        </span>
        <Icon
          name={isOpen ? "expand_less" : "expand_more"}
          size={16}
          className="text-muted-foreground"
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

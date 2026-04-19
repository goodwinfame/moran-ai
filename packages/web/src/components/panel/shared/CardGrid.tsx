/**
 * CardGrid — responsive grid layout for panel cards.
 * Supports both render-prop mode (items/renderCard) and children mode.
 * Uses ResizeObserver to switch between 1 and 2 column layouts.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CardGridBaseProps {
  className?: string;
  /** Width threshold (px) to switch to 2 columns. Default: 480 */
  twoColThreshold?: number;
}

interface CardGridChildrenProps extends CardGridBaseProps {
  children: React.ReactNode;
  items?: never;
  renderCard?: never;
  onCardClick?: never;
}

interface CardGridItemsProps<T extends { id: string }> extends CardGridBaseProps {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  onCardClick?: (id: string) => void;
  children?: never;
}

type CardGridProps<T extends { id: string } = { id: string }> =
  | CardGridChildrenProps
  | CardGridItemsProps<T>;

export function CardGrid<T extends { id: string } = { id: string }>({
  className,
  twoColThreshold = 480,
  ...rest
}: CardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      setCols(width >= twoColThreshold ? 2 : 1);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [twoColThreshold]);

  const gridClass = cn(
    "grid gap-3",
    cols === 2 ? "grid-cols-2" : "grid-cols-1",
    className,
  );

  if ("items" in rest && rest.items !== undefined) {
    const { items, renderCard, onCardClick } = rest as CardGridItemsProps<T>;
    return (
      <div ref={containerRef} className={gridClass}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onCardClick?.(item.id)}
            className={onCardClick ? "cursor-pointer" : undefined}
          >
            {renderCard(item)}
          </div>
        ))}
      </div>
    );
  }

  const { children } = rest as CardGridChildrenProps;
  return (
    <div ref={containerRef} className={gridClass}>
      {children}
    </div>
  );
}

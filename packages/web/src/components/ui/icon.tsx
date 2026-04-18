import { cn } from "@/lib/utils";

interface IconProps {
  /** Material Symbols icon name, e.g. "check_circle", "send", "public" */
  name: string;
  /** Use filled variant */
  filled?: boolean;
  /** Size in pixels (default 24) */
  size?: number;
  className?: string;
}

export function Icon({ name, filled = false, size = 24, className }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined select-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

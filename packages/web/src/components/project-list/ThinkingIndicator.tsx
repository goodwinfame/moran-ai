/**
 * ThinkingIndicator — Animated bubble shown while AI is processing.
 * Appears before the first text token arrives to provide visual feedback
 * during the thinking/tool-calling/sub-agent-delegation phase.
 */

interface ThinkingIndicatorProps {
  /** Optional status text, e.g., "墨衡正在思考...", "灵犀正在工作..." */
  status?: string;
}

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-secondary text-secondary-foreground rounded-bl-sm">
        <div className="flex items-center gap-2.5">
          {/* Pulsing dots */}
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:400ms]" />
          </span>
          {status && (
            <span className="text-muted-foreground text-xs">{status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

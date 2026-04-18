import { Icon } from "@/components/ui/icon";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === "assistant") {
    return (
      <div className="flex flex-row items-start gap-4">
        <div className="size-8 rounded-lg bg-[#1A202C] shrink-0 flex items-center justify-center">
          <Icon name="auto_awesome" size={16} className="text-white" />
        </div>
        <div className="max-w-[85%] bg-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row justify-end items-start gap-4">
      <div className="max-w-[85%] bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tr-none px-4 py-3 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      <div className="size-8 rounded-lg bg-slate-300 shrink-0" />
    </div>
  );
}

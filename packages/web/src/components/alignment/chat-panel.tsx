import { ReactNode } from "react";
import { ChatInput } from "./chat-input";

export interface ChatPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSend?: (text: string) => void;
  isLoading?: boolean;
  inputPlaceholder?: string;
}

export function ChatPanel({ title, subtitle, children, onSend, isLoading, inputPlaceholder }: ChatPanelProps) {
  return (
    <>
      <div className="px-8 pt-8 pb-4">
        <h2 className="font-serif text-3xl text-slate-900">{title}</h2>
        {subtitle && <p className="text-slate-500 mt-2">{subtitle}</p>}
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
        {children}
      </div>
      <ChatInput onSend={onSend} disabled={isLoading} placeholder={inputPlaceholder} />
    </>
  );
}
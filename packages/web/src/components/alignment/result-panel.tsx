import { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export interface ResultPanelProps {
  title: string;
  ctaText?: string;
  ctaAction?: () => void;
  headerSlot?: ReactNode;
  children: ReactNode;
}

export function ResultPanel({ title, ctaText, ctaAction, headerSlot, children }: ResultPanelProps) {
  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h3 className="font-serif text-xl text-slate-900">{title}</h3>
        <button className="text-xs font-bold text-[#1A202C] uppercase tracking-widest hover:underline flex items-center gap-1">
          编辑
        </button>
      </div>
      
      {headerSlot}

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {children}
      </div>

      {ctaText && (
        <button 
          onClick={ctaAction}
          className="mt-6 w-full bg-[#1A202C] hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/10 transition-all flex items-center justify-center gap-2"
        >
          {ctaText}
          <Icon name="arrow_forward" size={18} />
        </button>
      )}
    </div>
  );
}

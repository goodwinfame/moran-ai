import { Icon } from "@/components/ui/icon";

export interface SchemeTab {
  id: string;
  label: string;
}

export interface SchemeTabsProps {
  tabs: SchemeTab[];
  activeId: string;
  onTabChange: (id: string) => void;
  onTabClose?: (id: string) => void;
}

export function SchemeTabs({ tabs, activeId, onTabChange, onTabClose }: SchemeTabsProps) {
  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-slate-100 pb-px">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-${isActive ? '4' : '3'} py-2 rounded-t-lg text-xs flex items-center gap-2 transition-colors ${
              isActive 
                ? 'font-bold bg-[#1A202C] text-white shadow-sm' 
                : 'font-medium bg-transparent text-slate-400 cursor-pointer hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {isActive && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose?.(tab.id);
                }}
                className="flex items-center justify-center hover:bg-white/20 rounded-full p-0.5 transition-colors"
              >
                <Icon name="close" size={14} className="text-white" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

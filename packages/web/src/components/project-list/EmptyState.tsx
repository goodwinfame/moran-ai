import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onExampleClick: (text: string) => void;
}

const EXAMPLES = [
  "我想写一本赛博朋克修仙小说",
  "来一本末日废土题材的",
  "帮我续写上次的故事",
];

export function EmptyState({ onExampleClick }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50 shadow-sm">
        <span className="text-3xl">✨</span>
      </div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight font-serif text-foreground">还没有项目</h2>
      <p className="mb-8 text-muted-foreground max-w-[280px]">
        告诉墨衡你想写什么故事吧
      </p>
      
      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            variant="outline"
            className="w-full justify-start rounded-full px-4 font-normal text-sm border-muted/30 shadow-sm hover:shadow hover:-translate-y-[1px] transition-all bg-background/50 hover:bg-secondary/50 hover:border-border text-foreground"
            onClick={() => onExampleClick(example)}
          >
            {example}
          </Button>
        ))}
      </div>
    </div>
  );
}

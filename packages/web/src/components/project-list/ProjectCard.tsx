import { useRouter } from "next/navigation";
import { MouseEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ProjectItem } from "@/stores/project-list-store";

interface ProjectCardProps {
  project: ProjectItem;
  onContextMenu: (e: MouseEvent, project: ProjectItem) => void;
}

const STAGE_LABELS: Record<ProjectItem["status"], string> = {
  brainstorm: "🧠 脑暴中",
  world: "🌍 设定中",
  character: "👥 塑角中",
  outline: "📋 谋篇中",
  writing: "✍️ 写作中",
  completed: "✅ 已完结",
};

export function ProjectCard({ project, onContextMenu }: ProjectCardProps) {
  const router = useRouter();

  const formatWordCount = (count: number) => {
    if (count < 10000) return `${count}字`;
    return `${(count / 10000).toFixed(1)}万字`;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "今天";
    if (diffDays === 2) return "昨天";
    if (diffDays <= 30) return `${diffDays - 1}天前`;
    return `${Math.floor(diffDays / 30)}个月前`;
  };

  const handleClick = () => {
    router.push(`/projects/${project.id}`);
  };

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-[2px] bg-card hover:border-primary/20"
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, project)}
    >
      <CardContent className="p-5 flex flex-col h-full justify-between min-h-[140px]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="font-semibold text-base truncate font-serif text-foreground/90 group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              {project.isPinned && (
                <Icon name="push_pin" size={16} filled className="text-primary shrink-0 opacity-80" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium bg-secondary/60 text-secondary-foreground shadow-sm">
                {project.genre}
              </Badge>
              <span className="text-xs text-muted-foreground/80 font-medium">
                {STAGE_LABELS[project.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium" title="当前章节 / 总章节">
              <Icon name="book" size={14} className="opacity-70" />
              {project.currentChapter}/{project.chapterCount}章
            </span>
            <span className="flex items-center gap-1 font-medium" title="总字数">
              <Icon name="edit_document" size={14} className="opacity-70" />
              {formatWordCount(project.totalWordCount)}
            </span>
          </div>
          <span className="flex items-center gap-1 opacity-70">
            <Icon name="schedule" size={14} />
            {getRelativeTime(project.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

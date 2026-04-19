import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { ProjectItem, useProjectListStore } from "@/stores/project-list-store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineEditor } from "@/components/shared/InlineEditor";
import { ExportDialog } from "@/components/settings/ExportDialog";

interface ProjectCardMenuProps {
  project: ProjectItem;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ProjectCardMenu({ project, position, onClose }: ProjectCardMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const { pinProject, renameProject, archiveProject, deleteProject } = useProjectListStore();

  const handleRenameSave = async (newTitle: string) => {
    if (newTitle !== project.title) {
      await renameProject(project.id, newTitle);
    }
    setIsRenaming(false);
    onClose();
  };

  const handlePin = async () => {
    await pinProject(project.id);
    onClose();
  };

  const handleExport = () => {
    setShowExport(true);
  };

  if (isRenaming) {
    return (
      <div
        className="fixed z-50 rounded-lg shadow-xl border bg-background p-3 min-w-[200px] pointer-events-auto shadow-md"
        style={{ top: position?.y || 0, left: position?.x || 0 }}
      >
        <InlineEditor
          value={project.title}
          onSave={handleRenameSave}
          onCancel={() => {
            setIsRenaming(false);
            onClose();
          }}
          placeholder="项目名称"
        />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu open={!!position} onOpenChange={(open) => !open && onClose()}>
        {position && (
          <DropdownMenuTrigger
            asChild
            className="fixed pointer-events-none"
            style={{ top: position.y, left: position.x }}
          >
            <div className="h-1 w-1 opacity-0" />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="start" className="w-48 shadow-lg z-[60]">
          <DropdownMenuItem
            className="cursor-pointer font-medium hover:bg-secondary"
            onClick={() => setIsRenaming(true)}
            onSelect={(e) => e.preventDefault()}
          >
            <Icon name="edit" size={16} className="mr-2 opacity-70" />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer font-medium hover:bg-secondary"
            onClick={handlePin}
          >
            <Icon name="push_pin" size={16} filled={project.isPinned} className="mr-2 opacity-70" />
            {project.isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer font-medium hover:bg-secondary"
            onClick={handleExport}
          >
            <Icon name="download" size={16} className="mr-2 opacity-70" />
            导出
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            className="cursor-pointer font-medium hover:bg-secondary"
            onClick={() => setShowArchiveConfirm(true)}
            onSelect={(e) => e.preventDefault()}
          >
            <Icon name="archive" size={16} className="mr-2 opacity-70" />
            归档
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive font-medium hover:bg-destructive/10 transition-colors"
            onClick={() => setShowDeleteConfirm(true)}
            onSelect={(e) => e.preventDefault()}
          >
            <Icon name="delete" size={16} className="mr-2 opacity-70" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title="确认归档？"
        description={`归档后，“${project.title}” 将从项目列表中隐藏。你可以随时在归档列表中恢复它。`}
        confirmLabel="归档"
        onConfirm={async () => {
          await archiveProject(project.id);
          setShowArchiveConfirm(false);
          onClose();
        }}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="警告：永久删除"
        description={`您即将永久删除项目"${project.title}"。此操作不可逆，所有章节、角色和设定数据将被销毁。`}
        confirmLabel="永久删除"
        variant="destructive"
        requireInput={project.title}
        onConfirm={async () => {
          await deleteProject(project.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
      />

      <ExportDialog
        open={showExport}
        onClose={() => { setShowExport(false); onClose(); }}
        projectId={project.id}
      />
    </>
  );
}

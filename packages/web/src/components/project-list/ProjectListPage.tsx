"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useProjectListStore, ProjectItem } from "@/stores/project-list-store";
import { EmptyState } from "./EmptyState";
import { ProjectCard } from "./ProjectCard";
import { ProjectCardMenu } from "./ProjectCardMenu";
import { InlineChatInput } from "./InlineChatInput";
import { InlineChatBubble } from "./InlineChatBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { UserMenu } from "./UserMenu";

export function ProjectListPage() {
  const router = useRouter();
  const {
    projects,
    isLoading,
    isSending,
    inlineMessages,
    streamingReply,
    thinkingStatus,
    fetchProjects,
    createProject,
    sendInlineMessage,
  } = useProjectListStore();

  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSend = async (message: string) => {
    if (!message.trim() || isSending) return;
    const reply = await sendInlineMessage(message);

    if (reply?.action) {
      if (reply.action.type === "navigate" && reply.action.projectId) {
        router.push(`/projects/${reply.action.projectId}`);
      } else if (reply.action.type === "create_project" && reply.action.title) {
        const id = await createProject(reply.action.title, "小说"); // Default genre
        if (id) {
          router.push(`/projects/${id}`);
        }
      }
    }
  };

  const handleExampleClick = (text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text;
      inputRef.current.focus();
    }
  };

  const handleContextMenu = (e: MouseEvent, project: ProjectItem) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setSelectedProject(project);
  };

  const closeMenu = () => {
    setMenuPosition(null);
    setTimeout(() => setSelectedProject(null), 150); // Delay to allow animation
  };

  return (
    <div className="flex h-screen flex-col bg-background/50">
      {/* Header: brand + user menu */}
      <header className="flex h-[60px] items-center justify-between border-b border-border/40 bg-background/80 px-6 py-4 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="font-serif font-bold text-lg leading-none">M</span>
          </div>
          <span className="text-xl font-bold font-serif tracking-tight text-foreground/90">
            墨染 MoRan
          </span>
        </div>
        <UserMenu />
      </header>

      {/* Main: project cards or empty state */}
      <main
        className="flex-1 overflow-y-auto p-6 transition-all"
        onClick={closeMenu}
      >
        {isLoading && projects.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onExampleClick={handleExampleClick} />
        ) : (
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight font-serif text-foreground/90">
              我的项目
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Context Menu Overlay */}
      {selectedProject && menuPosition && (
        <ProjectCardMenu
          project={selectedProject}
          position={menuPosition}
          onClose={closeMenu}
        />
      )}

      {/* Footer: inline chat bubbles + input */}
      <div className="border-t border-border/40 bg-background/80 px-6 py-5 backdrop-blur-md sticky bottom-0 z-10 w-full shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <div className="mb-4 space-y-3 flex flex-col justify-end min-h-0 overflow-y-auto max-h-[30vh]">
            {inlineMessages.map((msg, i) => (
              <InlineChatBubble
                key={i}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {/* Streaming bubble — shows accumulated text in real-time before message_complete */}
            {isSending && streamingReply && (
              <InlineChatBubble role="assistant" content={streamingReply} />
            )}
            {/* Thinking indicator — shown while AI is processing, before first text token */}
            {isSending && !streamingReply && (
              <ThinkingIndicator status={thinkingStatus} />
            )}
          </div>
          <InlineChatInput
            ref={inputRef}
            onSend={handleSend}
            disabled={isSending}
            placeholder="告诉墨衡你想写什么故事..."
          />
        </div>
      </div>
    </div>
  );
}

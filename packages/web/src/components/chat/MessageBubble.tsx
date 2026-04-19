"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/stores/chat-store";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  if (message.type === "system") {
    return (
      <div className="flex justify-center text-xs text-muted-foreground my-4">
        {message.content}
      </div>
    );
  }

  if (message.type === "progress") {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground my-4">
        <span className="animate-spin">⏳</span>
        <span>{message.content}</span>
      </div>
    );
  }

  if (message.type === "decision") {
    return null;
  }

  const isUser = message.type === "user";

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 relative",
          isUser
            ? "bg-secondary ml-auto"
            : "bg-background shadow-sm border border-border"
        )}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap text-primary-foreground">{message.content}</div>
        ) : (
          <div className="relative text-sm text-primary-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="writing-cursor ml-1 animate-pulse text-primary">▎</span>
            )}
            {message.metadata?.inlineActions && message.metadata.inlineActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.metadata.inlineActions.map((action) => (
                  <button
                    key={action.action}
                    className="text-sm text-primary hover:underline"
                  >
                    [{action.label}]
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

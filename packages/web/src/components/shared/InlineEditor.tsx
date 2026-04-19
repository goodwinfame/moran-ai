"use client";

/**
 * InlineEditor — An inline text editing component for renaming.
 * Auto-focuses on mount. Enter/blur to save, Escape to cancel.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InlineEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  className?: string;
  maxLength?: number;
  placeholder?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineEditor({
  value,
  onSave,
  onCancel,
  className,
  maxLength = 100,
  placeholder,
}: InlineEditorProps) {
  const [draft, setDraft] = React.useState(value);
  // Track whether we already committed to avoid double-save on blur after Enter
  const committedRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  React.useEffect(() => {
    inputRef.current?.focus();
    // Select all text for convenient overwriting
    inputRef.current?.select();
  }, []);

  function save() {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== value) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }

  function cancel() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  function handleBlur() {
    save();
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      maxLength={maxLength}
      placeholder={placeholder}
      className={cn(className)}
    />
  );
}

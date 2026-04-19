"use client";

/**
 * ConfirmDialog — A reusable confirmation dialog component.
 * Supports optional requireInput mode to prevent accidental destructive actions.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  /** If set, user must type this exact string to enable the confirm button */
  requireInput?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  variant = "default",
  requireInput,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = React.useState("");

  // Reset input when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setInputValue("");
    }
  }, [open]);

  const isConfirmEnabled = requireInput ? inputValue === requireInput : true;

  function handleConfirm() {
    if (!isConfirmEnabled) return;
    onConfirm();
    onOpenChange(false);
  }

  function handleCancel() {
    onCancel?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {requireInput && (
          <div className="py-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`请输入 ${requireInput} 以确认`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmEnabled) {
                  handleConfirm();
                }
              }}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ResizableSplitter — 4px drag handle between left and right panels.
 * Hover expands to 8px with primary highlight color.
 *
 * Phase 5.2: chat-ui module
 */

interface ResizableSplitterProps {
  onMouseDown: () => void;
  onDoubleClick: () => void;
}

export function ResizableSplitter({ onMouseDown, onDoubleClick }: ResizableSplitterProps) {
  return (
    <div
      data-testid="resizable-splitter"
      className="w-1 hover:w-2 bg-border hover:bg-primary/20 cursor-col-resize transition-all duration-150 flex-shrink-0"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

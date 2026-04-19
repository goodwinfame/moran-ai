import { forwardRef, KeyboardEvent, useRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export interface InlineChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const InlineChatInput = forwardRef<HTMLInputElement, InlineChatInputProps>(
  ({ onSend, disabled = false, placeholder = "告诉墨衡你想写什么故事..." }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    const handleSend = () => {
      const value = internalRef.current?.value.trim();
      if (value && !disabled) {
        onSend(value);
        if (internalRef.current) {
          internalRef.current.value = "";
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="relative flex w-full items-center gap-2">
        <Input
          ref={internalRef}
          disabled={disabled}
          placeholder={disabled ? "墨衡思考中..." : placeholder}
          className="flex-1 rounded-full px-4 pr-12 shadow-sm border-muted/30 focus-visible:ring-1 bg-background"
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="absolute right-1 h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={handleSend}
          type="button"
        >
          <Icon name="send" size={18} />
          <span className="sr-only">发送</span>
        </Button>
      </div>
    );
  }
);
InlineChatInput.displayName = "InlineChatInput";

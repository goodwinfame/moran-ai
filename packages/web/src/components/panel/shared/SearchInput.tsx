/**
 * SearchInput — search input for panel tabs.
 * Supports both controlled (value/onChange) and uncontrolled (onSearch with debounce) modes.
 */
"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface SearchInputProps {
  placeholder?: string;
  /** Controlled mode: current value */
  value?: string;
  /** Controlled mode: change handler */
  onChange?: (value: string) => void;
  /** Uncontrolled mode: debounced search callback */
  onSearch?: (value: string) => void;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  placeholder = "搜索…",
  value: controlledValue,
  onChange,
  onSearch,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = isControlled ? controlledValue : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (isControlled) {
        onChange?.(next);
      } else {
        setInternalValue(next);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onSearch?.(next), debounceMs);
      }
    },
    [isControlled, onChange, onSearch, debounceMs],
  );

  const handleClear = useCallback(() => {
    if (isControlled) {
      onChange?.("");
    } else {
      setInternalValue("");
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      onSearch?.("");
    }
  }, [isControlled, onChange, onSearch]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Icon
        name="search"
        size={16}
        className="absolute left-3 text-muted-foreground pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full pl-9 pr-8 py-2 text-sm rounded-md border bg-background",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "placeholder:text-muted-foreground",
        )}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="清除搜索"
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

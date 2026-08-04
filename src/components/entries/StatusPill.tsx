"use client";

import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "To Do", className: "bg-secondary text-secondary-foreground" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  done: { label: "Done", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

interface StatusPillProps {
  status: TaskStatus;
  onChange?: (status: TaskStatus) => void;
  size?: "sm" | "md";
}

export default function StatusPill({ status, onChange, size = "md" }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  const statuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

  if (!onChange) {
    return (
      <span className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.className
      )}>
        {config.label}
      </span>
    );
  }

  const cycleStatus = () => {
    const idx = statuses.indexOf(status);
    onChange(statuses[(idx + 1) % statuses.length]);
  };

  return (
    <button
      onClick={cycleStatus}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-opacity hover:opacity-80 cursor-pointer",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.className
      )}
      title="Click to change status"
    >
      {config.label}
    </button>
  );
}

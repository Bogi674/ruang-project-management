"use client";

import { formatDateShort, isOverdue, cn, colorWithOpacity } from "@/lib/utils";
import { MoreHorizontal, Trash2, Calendar, Lock } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StatusPill from "./StatusPill";
import EntryTypeIcon from "./EntryTypeIcon";
import type { Entry, TaskContent, NoteContent } from "@/types";

interface EntryCardProps {
  entry: Entry;
  onClick?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
}

export default function EntryCard({ entry, onClick, onDelete, onStatusChange }: EntryCardProps) {
  const projectColor = entry.project?.color || "#6366f1";
  const isTask = entry.type === "task";
  const isNote = entry.type === "note";
  const content = entry.content as unknown as Record<string, unknown>;
  const taskContent = isTask ? (entry.content as TaskContent) : null;
  const noteContent = isNote ? (entry.content as NoteContent) : null;
  const title = (content.title as string) || "Untitled";
  const overdue = isTask && taskContent?.due_date && isOverdue(taskContent.due_date);
  const isDone = isTask && taskContent?.status === "done";

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer",
        overdue && !isDone && "border-red-200 task-overdue"
      )}
      onClick={onClick}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: projectColor,
      }}
    >
      {/* Type icon */}
      <div className="mt-0.5 shrink-0">
        <EntryTypeIcon
          type={entry.type}
          className={cn(
            "text-muted-foreground",
            entry.type === "reminder" && "text-amber-500",
            entry.type === "link" && "text-purple-500",
            isTask && taskContent?.status === "done" && "text-green-500"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3
            className={cn(
              "text-sm font-medium leading-snug flex-1 truncate",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {noteContent?.is_locked && <Lock className="h-3 w-3 inline mr-1 text-muted-foreground" />}
            {title || "Untitled"}
          </h3>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Workstream */}
          {entry.workstream && (
            <span className="text-xs text-muted-foreground">
              {entry.workstream.name}
            </span>
          )}

          {/* Task status pill */}
          {isTask && taskContent && (
            <span onClick={(e) => e.stopPropagation()}>
              <StatusPill
                status={taskContent.status}
                onChange={onStatusChange ? (s) => onStatusChange(s) : undefined}
                size="sm"
              />
            </span>
          )}

          {/* Due date */}
          {isTask && taskContent?.due_date && (
            <span className={cn(
              "flex items-center gap-0.5 text-xs",
              overdue && !isDone ? "text-red-500" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {formatDateShort(taskContent.due_date)}
            </span>
          )}

          {/* Pinned date */}
          {!isTask && entry.pinned_date && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDateShort(entry.pinned_date)}
            </span>
          )}

          {/* Tags */}
          {entry.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: colorWithOpacity(projectColor, 0.1), color: projectColor }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Assignees */}
        {entry.assignees && entry.assignees.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {entry.assignees.slice(0, 3).map((user) => (
              <Avatar key={user.id} className="h-5 w-5">
                <AvatarImage src={user.avatar_url || ""} />
                <AvatarFallback className="text-[9px]">
                  {user.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {entry.assignees.length > 3 && (
              <span className="text-xs text-muted-foreground">+{entry.assignees.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

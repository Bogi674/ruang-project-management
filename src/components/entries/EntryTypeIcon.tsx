import { FileText, File, CheckSquare, Bell, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntryType } from "@/types";

const TYPE_CONFIG: Record<EntryType, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  note: { icon: FileText, label: "Note" },
  file: { icon: File, label: "File" },
  task: { icon: CheckSquare, label: "Task" },
  reminder: { icon: Bell, label: "Reminder" },
  link: { icon: Link, label: "Link" },
};

interface EntryTypeIconProps {
  type: EntryType;
  className?: string;
}

export default function EntryTypeIcon({ type, className }: EntryTypeIconProps) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  return <Icon className={cn("h-4 w-4", className)} />;
}

export function entryTypeLabel(type: EntryType): string {
  return TYPE_CONFIG[type]?.label || type;
}

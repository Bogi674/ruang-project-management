"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Lock, Unlock, Calendar, Tag, Paperclip, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import StatusPill from "./StatusPill";
import TipTapEditor from "@/components/editors/TipTapEditor";
import { formatDate, cn } from "@/lib/utils";
import type { Entry, TaskContent, NoteContent, FileContent, TaskStatus } from "@/types";
import { useDropzone } from "react-dropzone";

interface EntryPanelProps {
  entryId: string | null;
  onClose: () => void;
  onUpdate?: (entry: Entry) => void;
  onDelete?: (id: string) => void;
}

export default function EntryPanel({ entryId, onClose, onUpdate, onDelete }: EntryPanelProps) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (!entryId) { setEntry(null); return; }
    setLoading(true);
    fetch(`/api/entries/${entryId}`)
      .then((r) => r.json())
      .then((data) => { setEntry(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [entryId]);

  const patch = useCallback(async (updates: Record<string, unknown>) => {
    if (!entry) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
        onUpdate?.(updated);
      }
    } finally {
      setSaving(false);
    }
  }, [entry, onUpdate]);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!entry || accepted.length === 0) return;
    setUploadingFile(true);
    for (const file of accepted) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entryId", entry.id);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (res.ok) {
        const fileRecord = await res.json();
        setEntry((prev) => prev ? { ...prev, files: [...(prev.files || []), fileRecord] } : prev);
      }
    }
    setUploadingFile(false);
  }, [entry]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxSize: 20 * 1024 * 1024 });

  const deleteFile = async (fileId: string) => {
    await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    setEntry((prev) => prev ? { ...prev, files: prev.files?.filter((f) => f.id !== fileId) } : prev);
  };

  if (!entryId) return null;

  if (loading || !entry) {
    return (
      <aside className="w-96 border-l border-border flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </aside>
    );
  }

  const taskContent = entry.type === "task" ? (entry.content as TaskContent) : null;
  const noteContent = entry.type === "note" ? (entry.content as NoteContent) : null;
  const fileContent = entry.type === "file" ? (entry.content as FileContent) : null;
  const content = entry.content as unknown as Record<string, unknown>;
  const title = (content.title as string) || "";

  return (
    <aside className="w-[480px] border-l border-border flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {entry.type}
        </span>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        <div className="flex-1" />
        {noteContent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => patch({ content: { is_locked: !noteContent.is_locked } })}
            title={noteContent.is_locked ? "Unlock note" : "Lock note"}
          >
            {noteContent.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => { onDelete?.(entry.id); onClose(); }}
          title="Delete entry"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <Input
          value={title}
          onChange={(e) => setEntry((prev) => prev ? { ...prev, content: { ...prev.content, title: e.target.value } } : prev)}
          onBlur={() => patch({ content: { title } })}
          placeholder="Title"
          className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto py-0"
          disabled={noteContent?.is_locked}
        />

        {/* Task: status + due date */}
        {taskContent && (
          <div className="flex items-center gap-3 flex-wrap">
            <StatusPill
              status={taskContent.status}
              onChange={(s) => patch({ content: { status: s as TaskStatus } })}
            />
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Due:</Label>
              <Input
                type="date"
                value={taskContent.due_date || ""}
                onChange={(e) => patch({ content: { due_date: e.target.value || null } })}
                className="h-7 text-xs w-36"
              />
            </div>
          </div>
        )}

        {/* Pinned date */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Date:</Label>
            <Input
              type="date"
              value={entry.pinned_date || ""}
              onChange={(e) => patch({ pinnedDate: e.target.value || null })}
              className="h-7 text-xs w-36"
            />
          </div>
          {entry.pinned_date && (
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">End:</Label>
              <Input
                type="date"
                value={entry.pinned_date_end || ""}
                onChange={(e) => patch({ pinnedDateEnd: e.target.value || null })}
                className="h-7 text-xs w-36"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Note editor */}
        {noteContent && (
          <TipTapEditor
            content={noteContent.tiptap_json as object}
            onChange={(json) => {
              const vn = (noteContent.version_number || 1) + 1;
              patch({ content: { tiptap_json: json, version_number: vn } });
            }}
            readOnly={noteContent.is_locked}
            placeholder="Start writing..."
            className="min-h-64"
          />
        )}

        {/* File entry description */}
        {fileContent && (
          <Textarea
            value={fileContent.description || ""}
            onChange={(e) => setEntry((prev) => prev ? { ...prev, content: { ...prev.content, description: e.target.value } } : prev)}
            onBlur={() => patch({ content: { description: fileContent.description } })}
            placeholder="Description..."
            rows={3}
          />
        )}

        {/* File uploads */}
        {(entry.type === "file" || entry.type === "note") && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              Attachments
            </Label>

            {/* Existing files */}
            {entry.files && entry.files.length > 0 && (
              <div className="space-y-1">
                {entry.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 rounded border border-border text-sm">
                    <span className="flex-1 truncate text-xs">{file.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size_bytes / 1024).toFixed(1)}KB
                    </span>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer transition-colors",
                isDragActive && "border-primary bg-primary/5"
              )}
            >
              <input {...getInputProps()} />
              {uploadingFile ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isDragActive ? "Drop files here" : "Drop files or click to upload (max 20MB)"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" />
            Tags
          </Label>
          <Input
            value={(entry.tags || []).join(", ")}
            onChange={(e) => {
              const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3);
              setEntry((prev) => prev ? { ...prev, tags } : prev);
            }}
            onBlur={() => patch({ tags: entry.tags })}
            placeholder="tag1, tag2, tag3 (max 3)"
            className="text-xs h-7"
          />
        </div>

        {/* Meta */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Created {formatDate(entry.created_at)} by {entry.creator?.name}</p>
          {entry.workstream && <p>Workstream: {entry.workstream.name}</p>}
          {entry.project && <p>Project: {entry.project.name}</p>}
        </div>
      </div>
    </aside>
  );
}

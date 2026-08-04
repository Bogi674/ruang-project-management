"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Project, Workstream, EntryType } from "@/types";

interface QuickCaptureProps {
  defaultProjectId?: string;
  onCreated?: () => void;
}

export default function QuickCapture({ defaultProjectId, onCreated }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [workstreamId, setWorkstreamId] = useState("");
  const [type, setType] = useState<EntryType>("note");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    if (!projectId) { setWorkstreams([]); setWorkstreamId(""); return; }
    fetch(`/api/workstreams?projectId=${projectId}`)
      .then((r) => r.json())
      .then((ws) => {
        setWorkstreams(ws);
        if (ws.length > 0) setWorkstreamId(ws[0].id);
      })
      .catch(() => {});
  }, [projectId]);

  const handleSubmit = async () => {
    if (!projectId || !workstreamId) return;
    setSaving(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workstreamId,
          type,
          pinnedDate: todayStr,
          content: { title: title.trim() || "Untitled" },
        }),
      });
      if (res.ok) {
        setOpen(false);
        setTitle("");
        onCreated?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 z-40"
        title="Quick capture"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {workstreams.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Workstream</Label>
                <Select value={workstreamId} onValueChange={setWorkstreamId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select workstream" />
                  </SelectTrigger>
                  <SelectContent>
                    {workstreams.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={saving || !projectId || !workstreamId}
              >
                {saving ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

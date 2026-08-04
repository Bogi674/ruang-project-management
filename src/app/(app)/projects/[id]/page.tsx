"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, Settings, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EntryCard from "@/components/entries/EntryCard";
import EntryPanel from "@/components/entries/EntryPanel";
import QuickCapture from "@/components/entries/QuickCapture";
import WorkstreamForm from "@/components/workstreams/WorkstreamForm";
import { formatDateShort } from "@/lib/utils";
import Link from "next/link";
import type { Project, Workstream, Entry, EntryType } from "@/types";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddWorkstream, setShowAddWorkstream] = useState(false);
  const [collapsedWorkstreams, setCollapsedWorkstreams] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [showAddEntry, setShowAddEntry] = useState<string | null>(null); // workstreamId
  const [addEntryType, setAddEntryType] = useState<EntryType>("note");
  const [addEntryTitle, setAddEntryTitle] = useState("");
  const submittingEntry = useRef(false); // prevents double-submit on fast Enter/click

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, wsRes, entRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/workstreams?projectId=${id}`),
        fetch(`/api/entries?projectId=${id}&limit=200`),
      ]);

      if (projRes.status === 404) { router.push("/projects"); return; }

      const [proj, ws, ent] = await Promise.all([projRes.json(), wsRes.json(), entRes.json()]);
      setProject(proj);
      setWorkstreams(ws);
      setEntries(Array.isArray(ent) ? ent : []);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createWorkstream = async (data: { name: string; description: string; color: string }) => {
    const res = await fetch("/api/workstreams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, ...data }),
    });
    if (res.ok) {
      const ws = await res.json();
      setWorkstreams((prev) => [...prev, ws]);
      setShowAddWorkstream(false);
    }
  };

  const createEntry = async (workstreamId: string) => {
    const title = addEntryTitle.trim();
    if (!title || submittingEntry.current) return;
    submittingEntry.current = true;

    // Close and clear immediately so the UI is responsive and a second
    // Enter/click has nothing to act on while the fetch is in-flight.
    setShowAddEntry(null);
    setAddEntryTitle("");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          workstreamId,
          type: addEntryType,
          content: { title },
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setEntries((prev) => [entry, ...prev]);
      }
    } finally {
      submittingEntry.current = false;
    }
  };

  const deleteEntry = async (entryId: string) => {
    await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedId === entryId) setSelectedId(null);
  };

  const updateStatus = async (entryId: string, status: string) => {
    const res = await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { status } }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    }
  };

  const toggleWorkstream = (wsId: string) => {
    setCollapsedWorkstreams((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId);
      else next.add(wsId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return null;

  // Group entries by workstream then date
  const filteredEntries = typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter);

  const entriesByWorkstream: Record<string, Entry[]> = {};
  for (const ws of workstreams) entriesByWorkstream[ws.id] = [];
  for (const entry of filteredEntries) {
    if (!entriesByWorkstream[entry.workstream_id]) {
      entriesByWorkstream[entry.workstream_id] = [];
    }
    entriesByWorkstream[entry.workstream_id].push(entry);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: project.color }}
              />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                {project.description && (
                  <p className="text-muted-foreground text-sm mt-0.5">{project.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as EntryType | "all")}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="file">Files</SelectItem>
                  <SelectItem value="link">Links</SelectItem>
                </SelectContent>
              </Select>
              <Link href={`/projects/${id}/settings`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Workstreams */}
          {workstreams.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="font-medium mb-1">No workstreams yet</p>
              <p className="text-sm mb-4">Create a workstream to start organizing entries</p>
              <Button size="sm" onClick={() => setShowAddWorkstream(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Workstream
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {workstreams.map((ws) => {
                const wsEntries = entriesByWorkstream[ws.id] || [];
                const collapsed = collapsedWorkstreams.has(ws.id);

                // Group by date
                const byDate: Record<string, Entry[]> = {};
                const unscheduled: Entry[] = [];
                for (const entry of wsEntries) {
                  if (entry.pinned_date) {
                    if (!byDate[entry.pinned_date]) byDate[entry.pinned_date] = [];
                    byDate[entry.pinned_date].push(entry);
                  } else {
                    unscheduled.push(entry);
                  }
                }

                const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

                return (
                  <section key={ws.id}>
                    {/* Workstream header */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                      <button
                        onClick={() => toggleWorkstream(ws.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: ws.color }} />
                      <h2 className="font-semibold text-sm">{ws.name}</h2>
                      <span className="text-xs text-muted-foreground">({wsEntries.length})</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => { setShowAddEntry(ws.id); setAddEntryTitle(""); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    {!collapsed && (
                      <div className="space-y-4">
                        {/* Quick add */}
                        {showAddEntry === ws.id && (
                          <div className="flex gap-2 items-center p-3 border border-primary/30 rounded-lg bg-card">
                            <Select value={addEntryType} onValueChange={(v) => setAddEntryType(v as EntryType)}>
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="note">Note</SelectItem>
                                <SelectItem value="task">Task</SelectItem>
                                <SelectItem value="file">File</SelectItem>
                              </SelectContent>
                            </Select>
                            <input
                              autoFocus
                              value={addEntryTitle}
                              onChange={(e) => setAddEntryTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") createEntry(ws.id);
                                if (e.key === "Escape") setShowAddEntry(null);
                              }}
                              placeholder="Title..."
                              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                            />
                            <button
                              onClick={() => createEntry(ws.id)}
                              className="text-xs text-primary font-medium"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setShowAddEntry(null)}
                              className="text-xs text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Unscheduled */}
                        {unscheduled.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                              Unscheduled
                            </p>
                            <div className="space-y-2">
                              {unscheduled.map((entry) => (
                                <EntryCard
                                  key={entry.id}
                                  entry={entry}
                                  onClick={() => setSelectedId(entry.id)}
                                  onDelete={() => deleteEntry(entry.id)}
                                  onStatusChange={(s) => updateStatus(entry.id, s)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* By date */}
                        {sortedDates.map((date) => (
                          <div key={date}>
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                              {formatDateShort(date)}
                            </p>
                            <div className="space-y-2">
                              {byDate[date].map((entry) => (
                                <EntryCard
                                  key={entry.id}
                                  entry={entry}
                                  onClick={() => setSelectedId(entry.id)}
                                  onDelete={() => deleteEntry(entry.id)}
                                  onStatusChange={(s) => updateStatus(entry.id, s)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}

                        {wsEntries.length === 0 && (
                          <p className="text-sm text-muted-foreground py-2 px-1">
                            No entries yet —{" "}
                            <button
                              onClick={() => { setShowAddEntry(ws.id); setAddEntryTitle(""); }}
                              className="text-primary hover:underline"
                            >
                              add one
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

              {/* Add workstream */}
              <button
                onClick={() => setShowAddWorkstream(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 group"
              >
                <div className="h-px flex-1 bg-border group-hover:bg-border/80" />
                <span className="flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add Workstream
                </span>
                <div className="h-px flex-1 bg-border group-hover:bg-border/80" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedId && (
        <EntryPanel
          entryId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={(updated) => {
            setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
          onDelete={deleteEntry}
        />
      )}

      <QuickCapture defaultProjectId={id} onCreated={fetchAll} />

      {/* Add workstream dialog */}
      <Dialog open={showAddWorkstream} onOpenChange={setShowAddWorkstream}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workstream</DialogTitle>
          </DialogHeader>
          <WorkstreamForm
            projectId={id}
            onSubmit={createWorkstream}
            onCancel={() => setShowAddWorkstream(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

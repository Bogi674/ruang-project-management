"use client";

import { useState, useEffect, useCallback } from "react";
import { isOverdue } from "@/lib/utils";
import EntryCard from "@/components/entries/EntryCard";
import EntryPanel from "@/components/entries/EntryPanel";
import QuickCapture from "@/components/entries/QuickCapture";
import { Loader2, Calendar, ArrowRight } from "lucide-react";
import type { Entry, TaskContent } from "@/types";

export default function TodayView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [overdue, setOverdue] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, overdueRes] = await Promise.all([
        fetch(`/api/entries?today=true`),
        fetch(`/api/entries?limit=50`),
      ]);
      const todayData: Entry[] = await todayRes.json();
      const allData: Entry[] = await overdueRes.json();

      setEntries(todayData);

      // Overdue tasks not pinned today
      const overdueItems = allData.filter((e) => {
        if (e.type !== "task") return false;
        const tc = e.content as TaskContent;
        if (tc.status === "done") return false;
        if (!tc.due_date) return false;
        if (e.pinned_date === todayStr) return false;
        return isOverdue(tc.due_date);
      });
      setOverdue(overdueItems);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const deleteEntry = async (id: string) => {
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setOverdue((prev) => prev.filter((e) => e.id !== id));
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { status } }),
    });
    fetchEntries();
  };

  // Group today's entries by project
  const grouped = entries.reduce<Record<string, { project: Entry["project"]; entries: Entry[] }>>(
    (acc, entry) => {
      const pid = entry.project_id;
      if (!acc[pid]) acc[pid] = { project: entry.project, entries: [] };
      acc[pid].entries.push(entry);
      return acc;
    },
    {}
  );

  const unscheduledCount = entries.filter((e) => !e.pinned_date).length;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {today.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Overdue tasks */}
              {overdue.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Overdue ({overdue.length})
                  </h2>
                  <div className="space-y-2">
                    {overdue.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        onClick={() => setSelectedId(entry.id)}
                        onDelete={() => deleteEntry(entry.id)}
                        onStatusChange={(s) => updateStatus(entry.id, s)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Today entries by project */}
              {Object.entries(grouped).length > 0 ? (
                Object.entries(grouped).map(([pid, group]) => (
                  <section key={pid}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: group.project?.color || "#6366f1" }}
                      />
                      <h2 className="text-sm font-semibold">{group.project?.name}</h2>
                      <span className="text-xs text-muted-foreground">({group.entries.length})</span>
                    </div>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          onClick={() => setSelectedId(entry.id)}
                          onDelete={() => deleteEntry(entry.id)}
                          onStatusChange={(s) => updateStatus(entry.id, s)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nothing scheduled for today</p>
                  <p className="text-sm mt-1">Use the + button to capture something</p>
                </div>
              )}

              {/* Next Up nudge */}
              {unscheduledCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
                  <ArrowRight className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">{unscheduledCount} unscheduled</span>{" "}
                    {unscheduledCount === 1 ? "item" : "items"} across your projects &mdash; schedule them when you&apos;re ready
                  </span>
                </div>
              )}
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

      <QuickCapture onCreated={fetchEntries} />
    </div>
  );
}

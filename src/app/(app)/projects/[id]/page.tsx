'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, Workstream, ProjectEntry, EntryType, EntryStatus } from '@/types';
import { ProjectSubHeader } from '@/components/projects/ProjectSubHeader';
import { WorkstreamSidebar } from '@/components/projects/WorkstreamSidebar';
import { EntryRow } from '@/components/projects/EntryRow';
import { AddEntryModal } from '@/components/projects/AddEntryModal';
import { ProjectModal } from '@/components/projects/ProjectModal';
import { ProjectTimeline } from '@/components/projects/ProjectTimeline';
import { EntryDetailPanel } from '@/components/projects/EntryDetailPanel';

interface ProjectDetail extends Project {
  workstreams: Workstream[];
  entries: ProjectEntry[];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject]       = useState<ProjectDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [activeWs, setActiveWs]     = useState<string | null>(null);
  const [view, setView]             = useState<'list' | 'timeline' | 'kanban'>('list');
  const [selectedEntry, setSelectedEntry] = useState<ProjectEntry | null>(null);
  const [showAddEntry, setAddEntry] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showAddWs, setShowAddWs]   = useState(false);
  const [newWsName, setNewWsName]   = useState('');
  const [savingWs, setSavingWs]     = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push('/projects'); return; }
    setProject(await res.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleAddEntry(data: { type: EntryType; title: string; workstream_id?: string; status?: EntryStatus }) {
    const res = await fetch(`/api/projects/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed');
    const entry: ProjectEntry = await res.json();
    setProject((prev) => prev ? { ...prev, entries: [...prev.entries, entry] } : prev);
  }

  async function handleDeleteEntry(entryId: string) {
    await fetch(`/api/projects/${id}/entries/${entryId}`, { method: 'DELETE' });
    setProject((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.id !== entryId) } : prev);
  }

  async function handleUpdateEntry(entryId: string, data: Partial<ProjectEntry>) {
    const res = await fetch(`/api/projects/${id}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed');
    const updated = await res.json();
    setProject((prev) => prev ? {
      ...prev,
      entries: prev.entries.map((e) => e.id === entryId ? { ...e, ...updated } : e),
    } : prev);
    if (selectedEntry?.id === entryId) setSelectedEntry((prev) => prev ? { ...prev, ...updated } : prev);
  }

  async function handleUpdateProject(data: Partial<Project>) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed');
    const updated = await res.json();
    setProject((prev) => prev ? { ...prev, ...updated } : prev);
  }

  async function handleAddWorkstream() {
    if (!newWsName.trim()) return;
    setSavingWs(true);
    const res = await fetch(`/api/projects/${id}/workstreams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWsName.trim(), color: '#A1B5D8', position: (project?.workstreams.length ?? 0) * 1000 }),
    });
    if (res.ok) {
      const ws: Workstream = await res.json();
      setProject((prev) => prev ? { ...prev, workstreams: [...prev.workstreams, ws] } : prev);
      setNewWsName('');
      setShowAddWs(false);
    }
    setSavingWs(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!project) return null;

  // Filter entries by active workstream
  const visibleEntries = activeWs
    ? project.entries.filter((e) => e.workstream_id === activeWs)
    : project.entries;

  // Group visible entries by workstream for list view
  const grouped: { ws: Workstream | null; entries: ProjectEntry[] }[] = [];

  if (activeWs) {
    const ws = project.workstreams.find((w) => w.id === activeWs) ?? null;
    grouped.push({ ws, entries: visibleEntries });
  } else {
    // Ungrouped (no workstream)
    const unassigned = visibleEntries.filter((e) => !e.workstream_id);
    if (unassigned.length > 0) grouped.push({ ws: null, entries: unassigned });

    // Each workstream
    for (const ws of project.workstreams) {
      const wsEntries = visibleEntries.filter((e) => e.workstream_id === ws.id);
      if (wsEntries.length > 0) grouped.push({ ws, entries: wsEntries });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-header */}
      <ProjectSubHeader
        project={project}
        view={view}
        onViewChange={setView}
        onAddEntry={() => setAddEntry(true)}
      />

      {/* Body */}
      {view === 'timeline' ? (
        <ProjectTimeline
          project={project}
          onEntryClick={setSelectedEntry}
          onEntryUpdate={handleUpdateEntry}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Workstream sidebar */}
          <WorkstreamSidebar
            workstreams={project.workstreams}
            entries={project.entries}
            activeId={activeWs}
            onSelect={setActiveWs}
            onAddWorkstream={() => setShowAddWs(true)}
          />

          {/* Main content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
            {/* Edit project link */}
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEdit(true)}
                style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Edit project
              </button>
            </div>

            {view === 'kanban' && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Kanban view coming soon.</p>
                <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Switch to List view to manage entries.</p>
              </div>
            )}

            {view === 'list' && grouped.length === 0 && (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>No entries yet.</p>
                <button
                  onClick={() => setAddEntry(true)}
                  style={{ fontSize: 13.5, color: 'var(--accent-blue-dark)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  + Add the first entry
                </button>
              </div>
            )}

            {view === 'list' && grouped.map(({ ws, entries }) => (
              <div key={ws?.id ?? 'unassigned'} style={{ marginBottom: 8 }}>
                {/* Group header */}
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ws && <span style={{ width: 3, height: 14, borderRadius: 2, background: ws.color }} />}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {ws ? ws.name : 'No workstream'}
                  </span>
                </div>

                {/* Entry rows */}
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={handleDeleteEntry}
                    onClick={() => setSelectedEntry(entry)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add workstream inline form */}
      {showAddWs && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(44,56,72,.28)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddWs(false); }}
        >
          <div
            style={{ background: 'var(--bg-base)', borderRadius: 12, width: 360, padding: '22px 24px', boxShadow: '0 16px 56px rgba(44,56,72,.14)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 14px' }}>Add workstream</h3>
            <input
              autoFocus
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddWorkstream(); if (e.key === 'Escape') setShowAddWs(false); }}
              placeholder="Workstream name"
              style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddWs(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 13.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleAddWorkstream}
                disabled={savingWs}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
              >
                {savingWs ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddEntry && (
        <AddEntryModal
          workstreams={project.workstreams}
          defaultWorkstreamId={activeWs ?? undefined}
          onSave={handleAddEntry}
          onClose={() => setAddEntry(false)}
        />
      )}

      {showEdit && (
        <ProjectModal
          project={project}
          onSave={handleUpdateProject}
          onClose={() => setShowEdit(false)}
        />
      )}

      {selectedEntry && (
        <EntryDetailPanel
          entry={selectedEntry}
          project={project}
          workstream={project.workstreams.find((w) => w.id === selectedEntry.workstream_id)}
          onClose={() => setSelectedEntry(null)}
          onUpdate={handleUpdateEntry}
          onDelete={(entryId) => { handleDeleteEntry(entryId); setSelectedEntry(null); }}
          backLabel={view === 'timeline' ? 'Back to Timeline' : 'Back to List'}
        />
      )}
    </div>
  );
}

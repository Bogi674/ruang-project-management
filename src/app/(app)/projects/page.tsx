'use client';

import { useState, useEffect, useCallback } from 'react';
import { Project } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectModal } from '@/components/projects/ProjectModal';

export default function ProjectsPage() {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Partial<Project>) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create');
    const created: Project = await res.json();
    setProjects((prev) => [{ ...created, workstream_count: 0 }, ...prev]);
  }

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1080 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
          Projects
        </h1>
        <button
          onClick={() => setShowModal(true)}
          style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 160, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 }}>
          <p style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: 'var(--text-muted)', margin: 0 }}>
            No projects yet.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Create one to start organizing your work.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{ marginTop: 8, height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
          >
            + New Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {showModal && (
        <ProjectModal onSave={handleCreate} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

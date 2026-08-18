'use client';

import { useEffect, useState } from 'react';
import { TodoCheckbox } from './TodoCheckbox';
import { useTodos } from './TodoProvider';

const DISMISSED_KEY = 'ruang_todo_migration_dismissed';

interface Candidate {
  id: string;
  title: string;
  item_count: number;
  already_converted: boolean;
}

/**
 * The one-time offer to convert the old checklist notes.
 *
 * Opt-in and per-note, not a silent bulk migration on first load: the notes
 * are the user's, some of them are shopping lists from a year ago, and turning
 * four hundred stale items into four hundred to-dos would make the new feature
 * useless on the day it arrived.
 *
 * The note itself is never deleted — each created to-do links back to it.
 */
export function MigrationCard() {
  const { refresh, announce } = useTodos();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Read in an effect, not in the initialiser: localStorage does not exist
    // during the server render and a mismatched first paint is a hydration
    // error.
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    fetch('/api/todos/migrate')
      .then((res) => (res.ok ? res.json() : { notes: [] }))
      .then((body: { notes: Candidate[] }) => {
        if (cancelled) return;
        const pending = (body.notes || []).filter((note) => !note.already_converted);
        setCandidates(pending);
        setSelected(pending.map((note) => note.id));
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  async function convert() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/todos/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_ids: selected }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { converted: number };
      announce(`Converted ${body.converted} checklist items into to-dos`);
      dismiss();
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (dismissed || !candidates || candidates.length === 0) return null;

  const totalItems = candidates
    .filter((note) => selected.includes(note.id))
    .reduce((sum, note) => sum + note.item_count, 0);

  return (
    <div className="bg-bg-base border border-border-default rounded-[14px] shadow-fab-menu p-[18px] flex flex-col gap-3">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
        One-time migration
      </span>
      <h2
        className="m-0 font-serif text-[18px] font-normal text-[color:var(--heading-color)] leading-[1.35]"
        style={{ letterSpacing: '-0.01em' }}
      >
        You have {candidates.length} checklist note{candidates.length === 1 ? '' : 's'}
      </h2>
      <p className="m-0 text-12.5 text-text-secondary leading-[1.55]">
        Their items become real to-dos — unassigned, in the same order, keeping their space. The
        note stays and links to them.
      </p>

      <div className="flex flex-col gap-[7px] max-h-[220px] overflow-y-auto overscroll-none">
        {candidates.map((note) => {
          const checked = selected.includes(note.id);
          return (
            <div
              key={note.id}
              className="flex items-center gap-2.5 border border-border-default rounded-widget px-3 py-2.5 text-12.5"
            >
              <TodoCheckbox
                checked={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked ? current.filter((id) => id !== note.id) : [...current, note.id]
                  )
                }
                label={`Convert ${note.title}`}
                size={16}
                radius={4}
              />
              <span className={`flex-1 min-w-0 truncate ${checked ? 'text-text-primary' : 'text-text-muted'}`}>
                {note.title}
              </span>
              <span className="text-10.5 text-text-faint flex-shrink-0">{note.item_count} items</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={convert}
          disabled={selected.length === 0 || busy}
          className="text-12.5 font-medium text-accent-ink bg-accent-blue rounded-[9px] px-[15px] py-2.5 disabled:opacity-50 transition-opacity duration-120"
        >
          {busy ? 'Converting…' : `Convert ${selected.length} selected · ${totalItems} items`}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-12.5 text-text-secondary border border-border-medium rounded-[9px] px-[15px] py-2.5 hover:bg-bg-surface transition-colors duration-120"
        >
          Later
        </button>
      </div>
    </div>
  );
}

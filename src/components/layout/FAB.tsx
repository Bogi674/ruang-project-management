'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type NoteType = 'note' | 'checklist';
type WidgetType = 'reminder' | 'file' | 'link';

interface FabEntry {
  label: string;
  noteType: NoteType;
  widget?: WidgetType;
  /**
   * A route to push instead of creating a note. To-do is the only entry that
   * uses it: to-dos are their own rows now, so this must not POST /api/notes
   * with `type: 'checklist'` and leave an empty note behind.
   */
  href?: string;
  bg: string;
  color: string;
  icon: React.ReactNode;
}

const FAB_ITEMS: FabEntry[] = [
  {
    label: 'Note',
    noteType: 'note',
    bg: 'var(--accent-blue-bg)',
    color: 'var(--accent-blue-dark)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    label: 'To-do',
    noteType: 'checklist',
    // Opens quick-add on /todo. Desktop focuses the bar, mobile opens the
    // bottom sheet — TodoClient reads `compose` and decides which.
    href: '/todo?compose=1',
    bg: 'var(--accent-green)',
    color: 'var(--accent-green-dark)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    label: 'Reminder',
    noteType: 'note',
    widget: 'reminder',
    bg: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    label: 'File Upload',
    noteType: 'note',
    widget: 'file',
    bg: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
    ),
  },
  {
    label: 'Link / Bookmark',
    noteType: 'note',
    widget: 'link',
    bg: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
];

/** `hideOnMobile` drops the button on phones only — the note editor is
 *  full-screen there, and a fixed FAB would sit over the keyboard. */
export function FAB({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Creation happens here, in a click handler, never in a useEffect.
  // This is the single source of truth for all note/widget creation.
  async function handleCreate(item: FabEntry) {
    if (creating) return;
    setOpen(false);

    // Entries that only navigate write nothing — the to-do is created by the
    // quick-add field once it has a title, so a cancelled compose leaves no
    // empty row behind. Same principle as the widget picker.
    if (item.href) {
      router.push(item.href);
      return;
    }

    setCreating(true);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.noteType }),
      });

      if (!res.ok) throw new Error('Creation failed');
      const data = await res.json();
      // The widget itself is created by its config form in the editor, so a
      // cancelled form leaves no empty widget row behind.
      if (data.id) router.push(item.widget ? `/note/${data.id}?widget=${item.widget}` : `/note/${data.id}`);
    } catch {
      // silent fail - FAB resets so user can retry
    } finally {
      setCreating(false);
    }
  }

  const isLoading = creating;

  return (
    // Mobile offset is derived from the tab bar height so the button always
    // clears the bar (and the iOS home indicator) instead of overlapping it.
    <div
      ref={ref}
      className={`fixed z-50 right-5 md:right-7 ${hideOnMobile ? 'hidden md:block' : ''}`}
      style={{ bottom: 'var(--fab-bottom)' }}
    >
      {open && !isLoading && (
        <div className="absolute bottom-[68px] right-0 bg-bg-base border border-border-default rounded-[14px] shadow-fab-menu p-2 w-52 animate-fadeUp">
          {FAB_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleCreate(item)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-subtle transition-colors duration-120 text-left"
            >
              <span
                className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: item.bg, color: item.color }}
              >
                {item.icon}
              </span>
              <span className="text-13 text-text-primary">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => !isLoading && setOpen(!open)}
        className="w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-fab hover:shadow-fab-hover transition-all duration-150"
        style={{
          background: isLoading || open ? 'var(--accent-slate)' : 'var(--accent-blue)',
          // The plus has to stay legible on a Sand or Sage accent too, so the
          // glyph colour is derived from the fill rather than pinned to white.
          color: isLoading || open ? '#ffffff' : 'var(--accent-ink)',
          transform: open && !isLoading ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        aria-label={isLoading ? 'Creating...' : 'Create'}
      >
        {isLoading ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        )}
      </button>
    </div>
  );
}

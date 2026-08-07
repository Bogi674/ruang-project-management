'use client';

import { useEffect } from 'react';

interface ShortcutRow {
  keys: string[];
  label: string;
}

const SHORTCUTS: { section: string; rows: ShortcutRow[] }[] = [
  {
    section: 'Navigation',
    rows: [
      { keys: ['G', 'H'], label: 'Go to Home' },
      { keys: ['G', 'R'], label: 'Go to My Room' },
      { keys: ['G', 'C'], label: 'Go to Calendar' },
      { keys: ['G', 'S'], label: 'Go to Search' },
    ],
  },
  {
    section: 'Notes',
    rows: [
      { keys: ['N'], label: 'New note' },
      { keys: ['T'], label: 'New to-do list' },
      { keys: ['⌘', 'S'], label: 'Force save (autosave is on by default)' },
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
    ],
  },
  {
    section: 'Formatting',
    rows: [
      { keys: ['⌘', 'B'], label: 'Bold' },
      { keys: ['⌘', 'I'], label: 'Italic' },
      { keys: ['⌘', 'U'], label: 'Underline' },
      { keys: ['⌘', 'K'], label: 'Add link' },
      { keys: ['/'], label: 'Open slash command menu' },
    ],
  },
  {
    section: 'App',
    rows: [
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['F'], label: 'Toggle focus mode' },
      { keys: ['Esc'], label: 'Close panel / dismiss' },
    ],
  },
];

interface KeyboardShortcutsPanelProps {
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ onClose }: KeyboardShortcutsPanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(44,56,72,0.32)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-bg-base rounded-[12px] w-full max-w-[520px] max-h-[80vh] overflow-y-auto animate-fadeUp"
        style={{ boxShadow: 'var(--shadow-modal)', margin: '0 16px' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-light">
          <h2 className="font-serif text-[18px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-6">
          {SHORTCUTS.map(({ section, rows }) => (
            <div key={section}>
              <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">
                {section}
              </p>
              <div className="space-y-1">
                {rows.map(({ keys, label }) => (
                  <div key={label} className="flex items-center justify-between py-1.5">
                    <span className="text-13 text-text-secondary">{label}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded text-[11px] font-medium text-text-secondary border border-border-medium bg-bg-surface"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Space } from '@/types';

/** Flatten the space tree so nested spaces are selectable, with indentation. */
export function flattenSpaces(spaces: Space[], level = 0): Array<Space & { _level: number }> {
  return spaces.flatMap((s) => [
    { ...s, _level: level },
    ...(s.children ? flattenSpaces(s.children, level + 1) : []),
  ]);
}

interface SpaceAssignMenuProps {
  currentSpaceId?: string | null;
  onSelect: (spaceId: string | null) => void;
  /** Rendered as the trigger. Receives an onClick to toggle the menu. */
  children: (props: { onClick: (e: React.MouseEvent) => void; open: boolean }) => React.ReactNode;
}

/**
 * Space picker rendered through a portal with fixed positioning, so it is never
 * clipped by an ancestor with `overflow: hidden` (sidebar, card list, etc).
 */
export function SpaceAssignMenu({ currentSpaceId, onSelect, children }: SpaceAssignMenuProps) {
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/spaces')
      .then((r) => r.json())
      .then((d) => setSpaces(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function close() { setOpen(false); }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function handleTriggerClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const el = e.currentTarget as HTMLElement;
    triggerRef.current = el;
    const rect = el.getBoundingClientRect();
    const MENU_W = 200;
    const MENU_MAX_H = 280;
    // Flip above / shift left when close to a viewport edge.
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_W - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < MENU_MAX_H && rect.top > spaceBelow
      ? Math.max(8, rect.top - Math.min(MENU_MAX_H, rect.top - 8) - 4)
      : rect.bottom + 4;
    setCoords({ top, left });
    setOpen(true);
  }

  function choose(spaceId: string | null) {
    setOpen(false);
    onSelect(spaceId);
  }

  const flat = flattenSpaces(spaces);

  return (
    <>
      {children({ onClick: handleTriggerClick, open })}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-[200px] max-h-[280px] overflow-y-auto bg-bg-base border border-border-default rounded-[10px] py-1.5 z-[100]"
          style={{ top: coords.top, left: coords.left, boxShadow: 'var(--shadow-modal)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pb-1 text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint">
            Move to
          </p>
          <button
            onClick={() => choose(null)}
            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-surface transition-colors flex items-center gap-2 ${
              !currentSpaceId ? 'text-accent-blue-dark font-medium' : 'text-text-muted'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-border-medium flex-shrink-0" />
            My Storeroom
          </button>
          {flat.length > 0 && <div className="h-px bg-border-light mx-2 my-1" />}
          {flat.map((s) => (
            <button
              key={s.id}
              onClick={() => choose(s.id)}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-surface transition-colors flex items-center gap-2 ${
                currentSpaceId === s.id ? 'text-accent-blue-dark font-medium' : 'text-text-secondary'
              }`}
              style={{ paddingLeft: 12 + s._level * 12 }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: s.color || '#738290' }}
              />
              <span className="truncate">{s.icon && `${s.icon} `}{s.name}</span>
            </button>
          ))}
          {flat.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-text-faint">No spaces yet.</p>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

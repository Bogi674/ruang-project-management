'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local-time YYYY-MM-DD. `toISOString()` would shift the day in UTC-negative zones. */
export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISODate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

interface DatePickerPopoverProps {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  /**
   * Ref to the trigger the panel is positioned against. This takes the ref
   * rather than the element because `ref.current` is still null on the render
   * that mounts the panel — reading it in an effect is what makes positioning
   * work on the very first open.
   */
  anchorRef: React.RefObject<HTMLElement>;
}

/**
 * Month-grid date picker rendered in a portal.
 *
 * A hidden `<input type="date">` was the first attempt here, but only Chrome
 * reliably opens its picker from a synthetic click, so on other browsers the
 * chip did nothing at all. This owns the whole interaction instead.
 */
export function DatePickerPopover({ value, onChange, onClose, anchorRef }: DatePickerPopoverProps) {
  const selected = parseISODate(value);
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_W = 258;
  const PANEL_H = 306;

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const GAP = 6;
    const EDGE = 10;
    const flipUp = rect.bottom + GAP + PANEL_H > window.innerHeight && rect.top > PANEL_H + GAP;
    setCoords({
      top: flipUp ? Math.max(EDGE, rect.top - GAP - PANEL_H) : rect.bottom + GAP,
      left: Math.min(Math.max(EDGE, rect.left), window.innerWidth - PANEL_W - EDGE),
    });
  }, [anchorRef]);

  useEffect(() => { place(); }, [place]);

  useEffect(() => {
    function onPointerDown(e: Event) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return;
      place();
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef, onClose, place]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = toISODate(new Date());

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  if (typeof document === 'undefined' || !coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose a date"
      className="fixed z-[130] bg-bg-base border border-border-default rounded-[12px] p-3 animate-fadeIn"
      style={{ top: coords.top, left: coords.left, width: PANEL_W, boxShadow: 'var(--shadow-modal)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="font-serif text-[14px] text-text-primary">{MONTHS[month]} {year}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="h-6 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <span key={`pad-${i}`} className="h-8" />;
          const iso = toISODate(new Date(year, month, day));
          const isSelected = iso === value;
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => { onChange(iso); onClose(); }}
              className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full text-[12.5px] transition-colors duration-120 ${
                isSelected
                  ? 'bg-accent-blue text-white font-semibold'
                  : isToday
                  ? 'text-accent-blue-dark font-semibold ring-1 ring-accent-blue hover:bg-accent-blue-bg'
                  : 'text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={() => { onChange(todayISO); onClose(); }}
          className="text-[12px] text-accent-blue-dark hover:underline"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => { onChange(''); onClose(); }}
          disabled={!value}
          className="text-[12px] text-text-muted hover:text-danger transition-colors duration-120 disabled:opacity-40 disabled:hover:text-text-muted"
        >
          Clear date
        </button>
      </div>
    </div>,
    document.body
  );
}

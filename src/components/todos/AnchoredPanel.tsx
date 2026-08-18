'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface AnchoredPanelProps {
  /**
   * The trigger the panel positions itself against. A ref, not an element,
   * because `ref.current` is still null on the render that mounts the panel —
   * reading it in an effect is what makes placement work on the first open.
   * The same reasoning as ui/DatePickerPopover, which this generalises.
   */
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  width: number;
  /** Used only to decide whether to flip above the anchor; the panel still sizes itself. */
  estimatedHeight?: number;
  label: string;
  children: React.ReactNode;
  className?: string;
}

const GAP = 6;
const EDGE = 10;

/**
 * A panel pinned to a trigger, rendered in a portal.
 *
 * The portal is not optional: to-do rows live inside scroll containers with
 * `overflow` set, and a panel rendered in place is clipped by the first of
 * them. Placement is recomputed on scroll and resize so the panel tracks its
 * anchor rather than detaching from it.
 */
export function AnchoredPanel({
  anchorRef,
  onClose,
  width,
  estimatedHeight = 320,
  label,
  children,
  className = '',
}: AnchoredPanelProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const flipUp =
      rect.bottom + GAP + estimatedHeight > window.innerHeight && rect.top > estimatedHeight + GAP;
    setCoords({
      top: flipUp ? Math.max(EDGE, rect.top - GAP - estimatedHeight) : rect.bottom + GAP,
      // Right-aligned to the anchor where there is room, so a panel opened from
      // a row's trailing edge does not shoot off the side of the window.
      left: Math.min(
        Math.max(EDGE, rect.right - width),
        Math.max(EDGE, window.innerWidth - width - EDGE)
      ),
    });
  }, [anchorRef, estimatedHeight, width]);

  useEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    function onPointerDown(e: Event) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    function onScroll(e: Event) {
      // A scroll inside the panel itself (a long month grid) must not move it.
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

  if (typeof document === 'undefined' || !coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={`fixed z-[130] bg-bg-base border border-border-default rounded-[14px] animate-fadeIn ${className}`}
      style={{ top: coords.top, left: coords.left, width, boxShadow: 'var(--shadow-fab-menu)' }}
    >
      {children}
    </div>,
    document.body
  );
}

/** The mono uppercase caption every popover opens with. */
export function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
      {children}
    </span>
  );
}

/**
 * A row of mutually exclusive chips.
 *
 * Rendered as real radio semantics rather than styled buttons so the group
 * announces itself as one choice with a current value, and arrow keys move
 * between the options the way they do in any other radio group.
 */
export function ChipGroup<T extends string | number | null>({
  name,
  options,
  value,
  onChange,
  className = '',
}: {
  name: string;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`flex gap-1.5 flex-wrap ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 text-11.5 rounded-[7px] px-[11px] py-[5px] transition-colors duration-120 ${
              selected
                ? 'bg-accent-blue text-accent-ink font-medium'
                : 'text-text-secondary border border-border-default hover:bg-bg-surface'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

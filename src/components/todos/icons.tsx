/**
 * The to-do feature's icon set.
 *
 * Inline lucide-style SVGs at 1.5–1.8 stroke width drawing `currentColor`,
 * matching FAB.tsx and MobileTabBar.tsx. They live in one file because the
 * same glyph appears on a row, in the detail panel and inside a popover at
 * three different sizes — duplicating the paths per component is how the
 * clock ends up with two different corner radii.
 *
 * No `use client`: these are plain function components with no state, so they
 * render happily in a server component too.
 */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Stroke({ size = 14, className, strokeWidth = 1.7, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Stroke>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Stroke>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <polyline points="21 3 21 8.5 15.5 8.5" />
    </Stroke>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.6}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Stroke>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Stroke>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Stroke>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Stroke>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Stroke>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 3}>
      <polyline points="20 6 9 17 4 12" />
    </Stroke>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Stroke>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <polyline points="15 18 9 12 15 6" />
    </Stroke>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <polyline points="9 18 15 12 9 6" />
    </Stroke>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <polyline points="6 9 12 15 18 9" />
    </Stroke>
  );
}

/** The To-do tab and FAB entry: a check escaping a square. */
export function CheckSquareIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.6}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Stroke>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.7}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </Stroke>
  );
}

/** Concentric rings — the Focus button and the focus-mode marker. */
export function TargetIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.8}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.4" />
    </Stroke>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Stroke {...props} strokeWidth={props.strokeWidth ?? 1.7}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Stroke>
  );
}

/** Filled glyphs — these take `fill`, not `stroke`. */

export function StarIcon({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

export function OverflowIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

/**
 * The six-dot drag grip.
 *
 * Hidden until row hover on a pointer device, which is why it is a separate
 * glyph from the overflow dots — the two sit at opposite ends of the row and
 * would otherwise read as the same affordance.
 */
export function GripIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <circle cx="9" cy="5" r="1.7" />
      <circle cx="15" cy="5" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="19" r="1.7" />
      <circle cx="15" cy="19" r="1.7" />
    </svg>
  );
}

'use client';

import { CheckIcon } from './icons';

interface TodoCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  /** Box edge in px. 18 on a desktop row, 16 on a sub-task, 20–24 in the panel. */
  size?: number;
  /** Corner radius. Sub-tasks use 4 so they read as a smaller sibling, not a scaled one. */
  radius?: number;
  /** Completed rows fill sage rather than accent — done is not the same as selected. */
  tone?: 'accent' | 'green';
  /** A dependent parent with open sub-tasks. Explained by `disabledReason`. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * The to-do checkbox.
 *
 * A real `<input type="checkbox">` under a drawn box rather than a styled
 * `<button role="checkbox">`: it gets keyboard activation, the checked state in
 * the accessibility tree and form semantics for free, and the app already
 * takes this approach for TipTap's task list.
 *
 * The touch target is grown with padding to 44px on phones while the painted
 * box stays 18px, so the hit area is honest without the design changing.
 */
export function TodoCheckbox({
  checked,
  onChange,
  label,
  size = 18,
  radius = 5,
  tone = 'accent',
  disabled = false,
  disabledReason,
}: TodoCheckboxProps) {
  const fill = tone === 'green' ? 'var(--accent-green-mid)' : 'var(--accent-blue)';

  return (
    <label
      className={`relative flex-shrink-0 inline-flex items-center justify-center -m-3 p-3 md:m-0 md:p-0 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      title={disabled ? disabledReason : undefined}
      style={{ lineHeight: 0 }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        // Covers the painted box exactly so the focus ring below tracks it.
        className="peer absolute opacity-0 w-0 h-0"
      />
      <span
        aria-hidden="true"
        className="flex items-center justify-center transition-colors duration-120 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-blue peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-base"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: checked ? fill : 'transparent',
          border: checked ? `1.5px solid ${fill}` : '1.5px solid var(--border-medium)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {checked && (
          <CheckIcon
            size={Math.round(size * 0.6)}
            className={tone === 'green' ? 'text-accent-green-ink' : 'text-accent-ink'}
            strokeWidth={3}
          />
        )}
      </span>
    </label>
  );
}

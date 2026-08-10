'use client';

import { WidgetType } from '@/types';
import { WidgetIcon } from './WidgetPicker';

interface WidgetRowProps {
  type: WidgetType;
  /** Small line above the title — used by Link rows for the domain. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Newly added rows glow for ~2s and show a "✓ Added" badge. */
  highlight?: boolean;
  href?: string;
  onRemove?: () => void;
}

/**
 * One row in the note's "Attached" zone. All three widget types share this
 * shell so their icon wells, spacing and Remove affordance stay identical.
 */
export function WidgetRow({ type, eyebrow, title, subtitle, highlight, href, onRemove }: WidgetRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3.5 bg-bg-surface rounded-widget animate-fadeUp transition-shadow duration-150 ${
        highlight
          ? 'border-[1.5px] border-accent-blue shadow-[0_0_0_3px_rgba(161,181,216,.12)]'
          : 'border border-border-default'
      }`}
    >
      <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <WidgetIcon type={type} size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {eyebrow && <p className="text-11 text-text-muted mb-0.5 truncate">{eyebrow}</p>}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="block text-13 font-medium text-text-primary truncate no-underline hover:text-accent-blue-dark transition-colors duration-120"
            title={title}
          >
            {title}
          </a>
        ) : (
          <p className="text-13 font-medium text-text-primary truncate" title={title}>
            {title}
          </p>
        )}
        {subtitle && <p className="text-11 text-text-muted mt-0.5 truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {highlight && (
          <span className="text-11 font-medium text-accent-blue-dark bg-accent-blue-bg rounded-full px-2.5 py-0.5 whitespace-nowrap">
            ✓ Added
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-danger hover:border-danger-border transition-colors duration-120"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

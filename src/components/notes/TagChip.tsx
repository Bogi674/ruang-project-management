import { spaceChipStyle } from '@/lib/spaceColor';

interface TagChipProps {
  label: string;
  variant?: 'green' | 'blue';
  size?: 'sm' | 'md';
  /**
   * Space colour. When set the chip is tinted from it and `variant` is
   * ignored, so a note's chip always matches the space it belongs to.
   */
  color?: string | null;
  /** Small leading dot in the solid space colour. */
  showDot?: boolean;
}

export function TagChip({ label, variant = 'green', size = 'md', color, showDot }: TagChipProps) {
  const sizeStyles = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-11';
  const base = 'inline-flex items-center gap-1 rounded-full font-medium max-w-full';

  if (color) {
    const style = spaceChipStyle(color);
    return (
      <span
        className={`${base} border ${sizeStyles}`}
        style={{ background: style.background, color: style.color, borderColor: style.borderColor }}
      >
        {showDot && (
          <span
            className="rounded-full flex-shrink-0"
            style={{ width: size === 'sm' ? 5 : 6, height: size === 'sm' ? 5 : 6, background: color }}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  const styles =
    variant === 'green'
      ? 'bg-accent-green text-accent-green-dark'
      : 'bg-accent-blue-bg text-accent-blue-dark';

  return (
    <span className={`${base} ${styles} ${sizeStyles}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

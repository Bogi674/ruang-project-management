interface TagChipProps {
  label: string;
  variant?: 'green' | 'blue';
  size?: 'sm' | 'md';
}

export function TagChip({ label, variant = 'green', size = 'md' }: TagChipProps) {
  const styles =
    variant === 'green'
      ? 'bg-accent-green text-accent-green-dark'
      : 'bg-accent-blue-bg text-accent-blue-dark';
  const sizeStyles = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-11';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${styles} ${sizeStyles}`}>
      {label}
    </span>
  );
}

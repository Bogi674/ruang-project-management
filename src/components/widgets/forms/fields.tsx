'use client';

/**
 * Shared field primitives for the widget creation forms.
 *
 * The forms live in two places — the in-note picker modal and the standalone
 * FAB flow — so the input chrome is defined once here rather than repeated in
 * each widget form. Sizes match the widget design handoff exactly.
 */

const CONTROL =
  'w-full text-[13.5px] text-text-primary bg-bg-base border border-border-medium rounded-btn px-3 py-2 outline-none transition-colors duration-120 placeholder:text-text-muted focus:border-accent-blue focus:ring-[3px] focus:ring-accent-blue/15';

export function FieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block text-12 font-medium text-text-primary mb-1.5">
      {children}
      {required && <span className="text-danger"> *</span>}
      {optional && <span className="text-11 text-text-muted font-normal"> optional</span>}
    </label>
  );
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${CONTROL} ${className}`} />;
}

export function TextAreaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', rows = 2, ...rest } = props;
  return <textarea {...rest} rows={rows} className={`${CONTROL} resize-none leading-[1.65] ${className}`} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-text-faint mb-3">{children}</p>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-11 text-text-muted mt-1">{children}</p>;
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-11 text-danger mt-1">{children}</p>;
}

/** `<select>` with the chevron drawn on top — native arrows differ per OS. */
export function SelectField({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`w-full h-9 text-[12.5px] text-text-primary bg-bg-base border border-border-medium rounded-btn pl-2.5 pr-7 appearance-none cursor-pointer outline-none transition-colors duration-120 focus:border-accent-blue ${className}`}
      >
        {children}
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9aaab8" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

/** Bounded numeric stepper — minus / value / plus inside one bordered box. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center h-9 bg-bg-base border border-border-medium rounded-btn overflow-hidden">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-9 h-9 flex items-center justify-center text-[18px] leading-none text-text-secondary flex-shrink-0 transition-colors duration-120 hover:bg-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent"
      >
        −
      </button>
      <span className="flex-1 text-center text-[13.5px] font-semibold text-text-primary tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-9 h-9 flex items-center justify-center text-[18px] leading-none text-text-secondary flex-shrink-0 transition-colors duration-120 hover:bg-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}

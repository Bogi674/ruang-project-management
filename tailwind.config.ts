import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /*
       * Every colour is a pointer at a CSS custom property declared in
       * globals.css, never a literal. That is what makes dark mode complete:
       * `[data-theme="dark"]` re-declares the properties once and every
       * Tailwind utility in the app follows. Adding a raw hex here (or in a
       * component) re-opens the half-dark bug this replaced.
       *
       * Note: Tailwind's `/opacity` modifier cannot apply to a bare `var()`.
       * Where a translucent accent is needed, use an explicit colour-mix or
       * rgba value in the component instead of `bg-accent-blue/40`.
       */
      colors: {
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        'bg-base': 'var(--bg-base)',
        'bg-subtle': 'var(--bg-subtle)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-page': 'var(--bg-page)',
        'border-default': 'var(--border-default)',
        'border-light': 'var(--border-light)',
        'border-medium': 'var(--border-medium)',
        'accent-blue': 'var(--accent-blue)',
        'accent-blue-dark': 'var(--accent-blue-dark)',
        'accent-blue-bg': 'var(--accent-blue-bg)',
        // Foreground that stays legible on a filled accent surface.
        'accent-ink': 'var(--accent-ink)',
        'accent-green': 'var(--accent-green)',
        'accent-green-mid': 'var(--accent-green-mid)',
        'accent-green-dark': 'var(--accent-green-dark)',
        'accent-green-ink': 'var(--accent-green-ink)',
        'accent-slate': 'var(--accent-slate)',
        'accent-slate-dark': 'var(--accent-slate-dark)',
        'accent-amber': 'var(--accent-amber)',
        'accent-amber-dark': 'var(--accent-amber-dark)',
        'accent-amber-bg': 'var(--accent-amber-bg)',
        danger: 'var(--danger)',
        'danger-dark': 'var(--danger-dark)',
        'danger-bg': 'var(--danger-bg)',
        'danger-border': 'var(--danger-border)',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      fontSize: {
        '10': '10px',
        '10.5': '10.5px',
        '11': '11px',
        '11.5': '11.5px',
        '12': '12px',
        '13': '13px',
        '13.5': '13.5px',
        '14': '14px',
        '14.5': '14.5px',
        '15': '15px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        modal: 'var(--shadow-modal)',
        fab: 'var(--shadow-fab)',
        'fab-hover': 'var(--shadow-fab-hover)',
        'fab-menu': 'var(--shadow-fab-menu)',
      },
      borderRadius: {
        card: '12px',
        input: '10px',
        btn: '8px',
        widget: '10px',
      },
      transitionDuration: {
        '80': '80ms',
        '120': '120ms',
        '150': '150ms',
        '220': '220ms',
      },
    },
  },
  plugins: [],
};

export default config;

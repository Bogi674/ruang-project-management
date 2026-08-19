/*
 * No `cn()` here any more. It existed for the shadcn/ui components, which this
 * app never adopted — every surface is hand-written Tailwind against the CSS
 * custom properties in globals.css (rule 9). Removing the twelve unused
 * components took `clsx`, `tailwind-merge`, `class-variance-authority` and
 * every `@radix-ui/*` package out of the bundle with it.
 */

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function extractTitleFromTipTap(content: object | null): string | null {
  if (!content) return null;
  const doc = content as { content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
  const firstNode = doc.content?.[0];
  if (!firstNode?.content) return null;
  const text = firstNode.content.map((n) => n.text || '').join('').trim();
  return text || null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

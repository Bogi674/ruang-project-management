/**
 * Reading checklist items out of a TipTap document.
 *
 * The old to-do was a note with `type = 'checklist'`, whose items are
 * `taskItem` nodes inside a `taskList`. Those lists nest (TaskItem is
 * configured with `nested: true`), so this walks the whole tree rather than
 * reading `doc.content[i].content[j]` — the same mistake lib/export.ts was
 * written to fix.
 */

export { POSITION_STEP } from './todos';

/** Titles are capped at 500 in the database; leave room and trim rather than 500-error. */
export const MAX_TITLE_FALLBACK = 500;

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
}

export interface TaskItem {
  text: string;
  checked: boolean;
}

/** Concatenates every text leaf under `node`, in document order. */
function textOf(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join('');
}

/**
 * Every `taskItem` in the document, flattened.
 *
 * A nested item becomes a top-level to-do rather than a sub-task: the nesting
 * in a checklist note is free-form and often several levels deep, while a
 * to-do sub-task is exactly one level. Flattening keeps every item and keeps
 * the order; guessing at a hierarchy would lose items that sit at depth three.
 */
export function extractTaskItems(content: object | null): TaskItem[] {
  if (!content || typeof content !== 'object') return [];

  const items: TaskItem[] = [];

  function walk(node: TipTapNode) {
    if (node.type === 'taskItem') {
      // The item's own text only — a nested taskList inside it is a sibling of
      // its paragraph, and its items are collected by the recursion below.
      const own = (node.content || [])
        .filter((child) => child.type !== 'taskList' && child.type !== 'bulletList' && child.type !== 'orderedList')
        .map(textOf)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (own) items.push({ text: own, checked: node.attrs?.checked === true });
    }
    for (const child of node.content || []) walk(child);
  }

  walk(content as TipTapNode);
  return items;
}

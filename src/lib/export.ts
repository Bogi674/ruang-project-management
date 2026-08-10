/**
 * TipTap JSON → plain text / Markdown.
 *
 * The previous inline exporter only read `doc.content[i].content[j].text`, so
 * it captured top-level paragraphs and dropped everything nested: list items,
 * task lists, blockquotes, tables and code blocks all came out blank. This
 * walks the tree properly instead.
 */

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface Node {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: Node[];
}

type Format = 'text' | 'markdown';

function escapeMarkdown(value: string): string {
  // Only the characters that would actually change block meaning mid-line.
  return value.replace(/([\\`*_[\]])/g, '\\$1');
}

function applyMarks(text: string, marks: Mark[] | undefined, format: Format): string {
  if (format === 'text' || !marks?.length) return text;

  let out = text;
  // `code` wins over emphasis — wrapping backticks in asterisks renders wrong.
  if (marks.some((m) => m.type === 'code')) return `\`${out}\``;

  if (marks.some((m) => m.type === 'bold')) out = `**${out}**`;
  if (marks.some((m) => m.type === 'italic')) out = `*${out}*`;
  if (marks.some((m) => m.type === 'strike')) out = `~~${out}~~`;

  const link = marks.find((m) => m.type === 'link');
  const href = link?.attrs?.href;
  if (typeof href === 'string' && href) out = `[${out}](${href})`;

  return out;
}

/** Inline content of a block: text nodes plus hard breaks. */
function inline(nodes: Node[] | undefined, format: Format): string {
  if (!nodes?.length) return '';
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return format === 'markdown' ? '  \n' : '\n';
      if (typeof node.text === 'string') {
        const raw = format === 'markdown' && !node.marks?.some((m) => m.type === 'code')
          ? escapeMarkdown(node.text)
          : node.text;
        return applyMarks(raw, node.marks, format);
      }
      // Inline nodes that carry their own children (e.g. mentions).
      return inline(node.content, format);
    })
    .join('');
}

function listItemText(item: Node, format: Format, depth: number): string[] {
  // A list item wraps paragraphs; nested lists come through as extra children.
  const lines: string[] = [];
  for (const child of item.content || []) {
    if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      lines.push(...blockLines(child, format, depth + 1));
    } else {
      const value = child.type === 'paragraph' ? inline(child.content, format) : blockLines(child, format, depth).join('\n');
      if (value) lines.push(value);
    }
  }
  return lines;
}

function blockLines(node: Node, format: Format, depth = 0): string[] {
  const pad = '  '.repeat(depth);

  switch (node.type) {
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1);
      const text = inline(node.content, format);
      if (!text) return [];
      return [format === 'markdown' ? `${'#'.repeat(Math.min(6, Math.max(1, level)))} ${text}` : text];
    }

    case 'paragraph': {
      const text = inline(node.content, format);
      return [pad + text];
    }

    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      const start = Number(node.attrs?.start ?? 1);
      const lines: string[] = [];
      (node.content || []).forEach((item, index) => {
        const [first, ...rest] = listItemText(item, format, depth);
        const marker = ordered ? `${start + index}.` : '-';
        lines.push(`${pad}${marker} ${first ?? ''}`.trimEnd());
        // Continuation lines are already padded by the recursive call.
        rest.forEach((line) => lines.push(line.startsWith(' ') ? line : `${pad}  ${line}`));
      });
      return lines;
    }

    case 'taskList': {
      const lines: string[] = [];
      for (const item of node.content || []) {
        const checked = item.attrs?.checked === true;
        const box = format === 'markdown' ? (checked ? '- [x]' : '- [ ]') : (checked ? '[x]' : '[ ]');
        const [first, ...rest] = listItemText(item, format, depth);
        lines.push(`${pad}${box} ${first ?? ''}`.trimEnd());
        rest.forEach((line) => lines.push(line.startsWith(' ') ? line : `${pad}  ${line}`));
      }
      return lines;
    }

    case 'blockquote': {
      const inner = (node.content || []).flatMap((child) => blockLines(child, format, depth));
      return inner.map((line) => (format === 'markdown' ? `> ${line}`.trimEnd() : line));
    }

    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const body = (node.content || []).map((n) => n.text ?? '').join('');
      if (format === 'text') return body.split('\n');
      return ['```' + language, ...body.split('\n'), '```'];
    }

    case 'horizontalRule':
      return [format === 'markdown' ? '---' : '—'];

    case 'table': {
      const rows = (node.content || []).map((row) =>
        (row.content || []).map((cell) =>
          (cell.content || []).map((block) => inline(block.content, format)).join(' ').trim()
        )
      );
      if (!rows.length) return [];
      if (format === 'text') return rows.map((cells) => cells.join('\t'));
      const [header, ...body] = rows;
      return [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...body.map((cells) => `| ${cells.join(' | ')} |`),
      ];
    }

    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      if (!src) return [];
      return [format === 'markdown' ? `![${alt}](${src})` : alt || src];
    }

    default: {
      // Unknown block: keep its text rather than silently dropping it.
      if (typeof node.text === 'string') return [node.text];
      if (node.content) return (node.content || []).flatMap((child) => blockLines(child, format, depth));
      return [];
    }
  }
}

function serialize(content: object | null, format: Format): string {
  const doc = content as Node | null;
  if (!doc?.content?.length) return '';

  const chunks: string[] = [];
  for (const node of doc.content) {
    const lines = blockLines(node, format).join('\n');
    chunks.push(lines);
  }

  return chunks
    .join('\n\n')
    // Collapse the blank runs left behind by empty paragraphs.
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function noteToPlainText(title: string, content: object | null): string {
  const body = serialize(content, 'text');
  const heading = title.trim();
  if (!heading) return body ? `${body}\n` : '';
  const header = `${heading}\n${'='.repeat(heading.length)}`;
  return body ? `${header}\n\n${body}\n` : `${header}\n`;
}

export function noteToMarkdown(title: string, content: object | null): string {
  const body = serialize(content, 'markdown');
  const heading = title.trim();
  if (!heading) return body ? `${body}\n` : '';
  return body ? `# ${heading}\n\n${body}\n` : `# ${heading}\n`;
}

/** Filesystem-safe filename stem derived from the note title. */
export function exportFilename(title: string, extension: string): string {
  const stem =
    title
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .trim() || 'note';
  return `${stem}.${extension}`;
}

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

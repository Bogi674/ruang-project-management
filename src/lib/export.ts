/**
 * TipTap JSON → plain text / Markdown / chat text.
 *
 * The previous inline exporter only read `doc.content[i].content[j].text`, so
 * it captured top-level paragraphs and dropped everything nested: list items,
 * task lists, blockquotes, tables and code blocks all came out blank. This
 * walks the tree properly instead.
 *
 * The `chat` format is what goes on the clipboard as `text/plain`. WhatsApp,
 * Telegram, Slack and Signal all ignore `text/html` and paste that flavour, so
 * it carries formatting the only way those apps understand it: `*bold*`,
 * `_italic_`, `~strike~`, backtick code, `1.` / `-` list markers, `>` quotes —
 * and single newlines between blocks, since a blank line between every item is
 * exactly what made a tidy numbered list arrive as loose, unnumbered prose.
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

type Format = 'text' | 'markdown' | 'chat';

function escapeMarkdown(value: string): string {
  // Only the characters that would actually change block meaning mid-line.
  return value.replace(/([\\`*_[\]])/g, '\\$1');
}

function applyMarks(text: string, marks: Mark[] | undefined, format: Format): string {
  if (format === 'text' || !marks?.length) return text;

  // Marks wrap the text, so applying them to leading/trailing whitespace would
  // put the delimiter next to a space — which chat apps then refuse to render.
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) as RegExpExecArray;
  if (!core) return text;

  let out = core;
  // `code` wins over emphasis — wrapping backticks in asterisks renders wrong.
  if (marks.some((m) => m.type === 'code')) return `${lead}\`${out}\`${trail}`;

  if (format === 'chat') {
    // WhatsApp's own syntax: a single asterisk is bold, underscore is italic.
    if (marks.some((m) => m.type === 'bold')) out = `*${out}*`;
    if (marks.some((m) => m.type === 'italic')) out = `_${out}_`;
    if (marks.some((m) => m.type === 'strike')) out = `~${out}~`;
  } else {
    if (marks.some((m) => m.type === 'bold')) out = `**${out}**`;
    if (marks.some((m) => m.type === 'italic')) out = `*${out}*`;
    if (marks.some((m) => m.type === 'strike')) out = `~~${out}~~`;
  }

  const link = marks.find((m) => m.type === 'link');
  const href = link?.attrs?.href;
  if (typeof href === 'string' && href) {
    // Chat apps auto-link a bare URL; markdown link syntax would just be noise
    // there, so only repeat the href when the label is not the URL itself.
    // TipTap's autolink writes the href with a scheme the label omits, so
    // "ruang.app" and "https://ruang.app" are the same link, not two.
    const bare = (value: string) => value.replace(/^https?:\/\//, '').replace(/\/$/, '');
    out = format === 'chat'
      ? (bare(core) === bare(href) ? href : `${out} (${href})`)
      : `[${out}](${href})`;
  }

  return `${lead}${out}${trail}`;
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
      if (format === 'markdown') return [`${'#'.repeat(Math.min(6, Math.max(1, level)))} ${text}`];
      // Chat apps have no heading syntax; bold is how a heading reads there.
      // Skip it when the line already carries marks that would nest badly.
      if (format === 'chat') return [text.startsWith('*') ? text : `*${text}*`];
      return [text];
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
        const box = format === 'markdown'
          ? (checked ? '- [x]' : '- [ ]')
          // A bracket pair after a chat bullet renders as literal "[ ]"; the
          // box glyphs read as checkboxes wherever the text lands.
          : format === 'chat'
          ? (checked ? '☑' : '☐')
          : (checked ? '[x]' : '[ ]');
        const [first, ...rest] = listItemText(item, format, depth);
        lines.push(`${pad}${box} ${first ?? ''}`.trimEnd());
        rest.forEach((line) => lines.push(line.startsWith(' ') ? line : `${pad}  ${line}`));
      }
      return lines;
    }

    case 'blockquote': {
      const inner = (node.content || []).flatMap((child) => blockLines(child, format, depth));
      // WhatsApp renders "> " as a quote bar, same as Markdown.
      return inner.map((line) => (format === 'text' ? line : `> ${line}`.trimEnd()));
    }

    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const body = (node.content || []).map((n) => n.text ?? '').join('');
      if (format === 'text') return body.split('\n');
      // Chat fences carry no language tag — it would show up as a literal line.
      return ['```' + (format === 'chat' ? '' : language), ...body.split('\n'), '```'];
    }

    case 'horizontalRule':
      return [format === 'markdown' ? '---' : format === 'chat' ? '———' : '—'];

    case 'table': {
      const rows = (node.content || []).map((row) =>
        (row.content || []).map((cell) =>
          (cell.content || []).map((block) => inline(block.content, format)).join(' ').trim()
        )
      );
      if (!rows.length) return [];
      if (format === 'text') return rows.map((cells) => cells.join('\t'));
      // Tabs collapse to a single space in a chat bubble, so cells would run
      // together — a visible separator is the only thing that survives.
      if (format === 'chat') return rows.map((cells) => cells.join(' | '));
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
      if (format === 'markdown') return [`![${alt}](${src})`];
      // A bare URL is at least clickable in a chat; alt text alone is not.
      return [format === 'chat' ? src : alt || src];
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

  // A document's blocks are separated by a blank line in a file, but not in a
  // chat message: there, one line per line is what the writer saw in the
  // editor. An empty paragraph still comes through as its own blank line, so a
  // deliberate spacer survives either way.
  return chunks
    .join(format === 'chat' ? '\n' : '\n\n')
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

/**
 * TipTap JSON → the `text/plain` flavour chat apps paste.
 *
 * Also used for a copied selection, where the fragment handed over is an array
 * of top-level nodes rather than a whole document.
 */
export function tiptapToChatText(content: object | readonly object[] | null): string {
  const doc = Array.isArray(content) ? { type: 'doc', content } : content;
  return serialize(doc as object | null, 'chat');
}

/** Whole note as chat text. The title leads as a bold line when there is one. */
export function noteToChatText(title: string, content: object | null): string {
  const body = tiptapToChatText(content);
  const heading = title.trim();
  if (!heading) return body;
  return body ? `*${heading}*\n\n${body}` : `*${heading}*`;
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

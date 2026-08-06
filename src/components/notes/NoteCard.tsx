'use client';

import Link from 'next/link';
import { Note } from '@/types';
import { formatRelativeTime, extractTitleFromTipTap } from '@/lib/utils';
import { TagChip } from './TagChip';

function getPreview(content: object | null): string {
  if (!content) return '';
  const doc = content as { content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
  const nodes = doc.content || [];
  for (let i = 1; i < nodes.length; i++) {
    const text = nodes[i].content?.map((n) => n.text || '').join('').trim();
    if (text) return text.slice(0, 100);
  }
  return '';
}

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note }: NoteCardProps) {
  const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
  const preview = getPreview(note.content);

  return (
    <Link
      href={`/note/${note.id}`}
      className="block no-underline bg-bg-base border border-border-default rounded-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 p-4 cursor-pointer"
    >
      <div className="flex flex-wrap gap-1 mb-2">
        {note.space && <TagChip label={note.space.name} variant="green" size="sm" />}
        {note.tags?.slice(0, 2).map((tag) => (
          <TagChip key={tag} label={tag} variant="blue" size="sm" />
        ))}
      </div>
      <p className="font-serif text-15 text-text-primary leading-snug mb-1 line-clamp-2">{title}</p>
      {preview && (
        <p className="text-11.5 text-text-muted leading-relaxed line-clamp-2">{preview}</p>
      )}
      <p className="text-10.5 text-text-faint mt-2">{formatRelativeTime(note.updated_at)}</p>
    </Link>
  );
}

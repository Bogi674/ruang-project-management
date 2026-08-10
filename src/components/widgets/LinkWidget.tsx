'use client';

import { LinkContent } from '@/types';
import { WidgetRow } from './WidgetRow';

interface LinkWidgetProps {
  content: LinkContent;
  highlight?: boolean;
  onRemove?: () => void;
}

function domainOf(content: LinkContent): string {
  if (content.domain) return content.domain;
  if (!content.url) return '';
  try {
    return new URL(content.url).hostname.replace(/^www\./, '');
  } catch {
    // A half-typed URL must not take the whole editor down.
    return content.url;
  }
}

export function LinkWidget({ content, highlight, onRemove }: LinkWidgetProps) {
  return (
    <WidgetRow
      type="link"
      eyebrow={domainOf(content)}
      title={content.og_title || content.url || 'Untitled link'}
      subtitle={content.note || content.og_description || undefined}
      href={content.url || undefined}
      highlight={highlight}
      onRemove={onRemove}
    />
  );
}

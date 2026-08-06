'use client';

import { LinkContent } from '@/types';

interface LinkWidgetProps {
  content: LinkContent;
  onRemove?: () => void;
}

export function LinkWidget({ content, onRemove }: LinkWidgetProps) {
  const domain = content.url ? new URL(content.url).hostname.replace('www.', '') : '';

  return (
    <div className="flex items-center gap-3 p-3.5 bg-bg-surface border border-border-default rounded-widget">
      <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-11 text-text-muted mb-0.5">{domain}</p>
        <p className="text-13 font-medium text-text-primary truncate">{content.og_title || content.url}</p>
        {content.og_description && (
          <p className="text-11 text-text-muted truncate mt-0.5">{content.og_description}</p>
        )}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-danger hover:border-danger-border transition-colors duration-120">
          Remove
        </button>
      )}
    </div>
  );
}

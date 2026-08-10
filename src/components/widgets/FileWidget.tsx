'use client';

import { useState } from 'react';
import { FileContent, FileRecord } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { WidgetIcon } from './WidgetPicker';

interface FileWidgetProps {
  file?: FileRecord | null;
  content?: FileContent;
  highlight?: boolean;
  onRemove?: () => void;
}

/**
 * File row. Unlike the other widgets this one cannot use a plain `href` — R2
 * objects are private, so the download URL is minted on demand by
 * `GET /api/files/[id]` and opened once it comes back.
 */
export function FileWidget({ file, content, highlight, onRemove }: FileWidgetProps) {
  const [opening, setOpening] = useState(false);

  const title = content?.display_name?.trim() || file?.filename || 'No file uploaded';
  const subtitle = file
    ? `${formatFileSize(file.size_bytes)} · ${file.mime_type}`
    : content?.description || 'Upload pending';

  async function openFile() {
    if (!file || opening) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/files/${file.id}`);
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className={`flex items-center gap-3 p-3.5 bg-bg-surface rounded-widget animate-fadeUp transition-shadow duration-150 ${
        highlight
          ? 'border-[1.5px] border-accent-blue shadow-[0_0_0_3px_rgba(161,181,216,.12)]'
          : 'border border-border-default'
      }`}
    >
      <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <WidgetIcon type="file" size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {file ? (
          <button
            type="button"
            onClick={openFile}
            className="block max-w-full text-left text-13 font-medium text-text-primary truncate hover:text-accent-blue-dark transition-colors duration-120"
            title={`Open ${title}`}
          >
            {opening ? 'Opening…' : title}
          </button>
        ) : (
          <p className="text-13 font-medium text-text-primary truncate">{title}</p>
        )}
        <p className="text-11 text-text-muted mt-0.5 truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {highlight && (
          <span className="text-11 font-medium text-accent-blue-dark bg-accent-blue-bg rounded-full px-2.5 py-0.5 whitespace-nowrap">
            ✓ Added
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-danger hover:border-danger-border transition-colors duration-120"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

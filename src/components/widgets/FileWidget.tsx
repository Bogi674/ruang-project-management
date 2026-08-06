'use client';

import { FileRecord } from '@/types';
import { formatFileSize } from '@/lib/utils';

interface FileWidgetProps {
  file?: FileRecord | null;
  description?: string;
  onRemove?: () => void;
}

export function FileWidget({ file, description, onRemove }: FileWidgetProps) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-bg-surface border border-border-default rounded-widget">
      <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-13 font-medium text-text-primary truncate">{file?.filename || 'No file uploaded'}</p>
        <p className="text-11 text-text-muted mt-0.5">
          {file ? `${formatFileSize(file.size_bytes)} · ${file.mime_type}` : description || ''}
        </p>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-danger hover:border-danger-border transition-colors duration-120">
          Remove
        </button>
      )}
    </div>
  );
}

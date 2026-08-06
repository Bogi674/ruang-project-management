'use client';

import { WidgetType } from '@/types';

interface WidgetPickerProps {
  onSelect: (type: WidgetType) => void;
  onClose: () => void;
}

const WIDGET_OPTIONS: { type: WidgetType; label: string; description: string; bg: string }[] = [
  { type: 'reminder', label: 'Reminder', description: 'Set a date and time to be notified', bg: '#edf3fa' },
  { type: 'file', label: 'File Attachment', description: 'Attach a file from your device', bg: '#f4faf0' },
  { type: 'link', label: 'Link / Bookmark', description: 'Save a URL with preview', bg: '#edf3fa' },
];

const WIDGET_ICONS: Record<WidgetType, React.ReactNode> = {
  reminder: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  file: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  link: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
};

export function WidgetPicker({ onSelect, onClose }: WidgetPickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 pointer-events-none">
        <div className="bg-bg-base rounded-[16px] shadow-modal w-full max-w-md pointer-events-auto animate-fadeUp">
          <div className="flex items-center justify-between p-5 border-b border-border-default">
            <h3 className="font-serif text-18 text-text-primary">Add Widget</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="p-4 space-y-2">
            {WIDGET_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => { onSelect(opt.type); onClose(); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-default hover:border-accent-blue hover:bg-bg-surface transition-all duration-120 text-left"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: opt.bg }}
                >
                  {WIDGET_ICONS[opt.type]}
                </div>
                <div>
                  <p className="text-14 font-semibold text-text-primary">{opt.label}</p>
                  <p className="text-12 text-text-muted mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

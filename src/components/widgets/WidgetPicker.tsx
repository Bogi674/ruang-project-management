'use client';

import { useEffect, useState } from 'react';
import {
  FileContent,
  LinkContent,
  PendingFileUpload,
  ReminderContent,
  WidgetType,
} from '@/types';
import { ReminderForm } from './forms/ReminderForm';
import { FileForm } from './forms/FileForm';
import { LinkForm } from './forms/LinkForm';

export type WidgetContent = ReminderContent | FileContent | LinkContent;

interface WidgetPickerProps {
  /** Skip the type list and open straight into a form (FAB deep links). */
  initialType?: WidgetType | null;
  submitLabel?: string;
  onSubmit: (type: WidgetType, content: WidgetContent, pendingFile: PendingFileUpload | null) => Promise<void> | void;
  onClose: () => void;
}

const WIDGET_OPTIONS: { type: WidgetType; label: string; description: string; bg: string }[] = [
  { type: 'reminder', label: 'Reminder', description: 'Set a date and time to be notified', bg: '#edf3fa' },
  { type: 'file', label: 'File Attachment', description: 'Attach a file from your device', bg: '#f4faf0' },
  { type: 'link', label: 'Link / Bookmark', description: 'Save a URL with a rich preview', bg: '#edf3fa' },
];

export const WIDGET_ICONS: Record<WidgetType, React.ReactNode> = {
  reminder: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
};

export function WidgetIcon({ type, size = 20 }: { type: WidgetType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#738290"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {WIDGET_ICONS[type]}
    </svg>
  );
}

const TYPE_TITLES: Record<WidgetType, string> = {
  reminder: 'Reminder',
  file: 'File Attachment',
  link: 'Link / Bookmark',
};

/**
 * Two-step widget flow: pick a type, then fill its form. Nothing is written to
 * the database until "Add to Note" — the old behaviour inserted an empty
 * widget row the moment a type was clicked.
 */
export function WidgetPicker({ initialType = null, submitLabel = 'Add to Note', onSubmit, onClose }: WidgetPickerProps) {
  const [type, setType] = useState<WidgetType | null>(initialType);
  const [content, setContent] = useState<WidgetContent | null>(null);
  const [valid, setValid] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFileUpload | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function selectType(next: WidgetType) {
    setType(next);
    setContent(null);
    setValid(false);
    setPendingFile(null);
  }

  function goBack() {
    // With a deep-linked type there is no list to go back to.
    if (initialType) { onClose(); return; }
    setType(null);
    setContent(null);
    setValid(false);
    setPendingFile(null);
  }

  async function handleSubmit() {
    if (!type || !content || !valid || saving) return;
    setSaving(true);
    try {
      await onSubmit(type, content, pendingFile);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pointer-events-none">
        <div
          className={`bg-bg-base rounded-t-[16px] md:rounded-[16px] shadow-modal w-full pointer-events-auto animate-modalIn flex flex-col max-h-[92vh] md:max-h-[90vh] ${
            type ? 'md:max-w-[480px]' : 'md:max-w-[440px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-3.5 border-b border-border-light flex-shrink-0">
            {type && !initialType && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-12 text-text-muted hover:text-text-secondary transition-colors duration-120 flex-shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </button>
            )}
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              {type && (
                <span className="w-[30px] h-[30px] rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                  <WidgetIcon type={type} size={15} />
                </span>
              )}
              <h3 className="font-serif text-18 font-normal text-text-primary tracking-[-0.02em] truncate">
                {type ? TYPE_TITLES[type] : 'Add Widget'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-faint hover:text-text-secondary transition-colors duration-120 flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Step 1 — type list */}
          {!type && (
            <div className="p-3.5 flex flex-col gap-2 overflow-y-auto">
              {WIDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => selectType(opt.type)}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-border-default bg-bg-base hover:border-accent-blue hover:bg-bg-surface transition-all duration-120 text-left"
                >
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: opt.bg }}
                  >
                    <WidgetIcon type={opt.type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-14 font-semibold text-text-primary">{opt.label}</span>
                    <span className="block text-12 text-text-muted mt-0.5">{opt.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — configuration form */}
          {type && (
            <>
              <div className="px-5 py-4 overflow-y-auto flex-1">
                {type === 'reminder' && (
                  <ReminderForm
                    onChange={(next, isValid) => {
                      setContent(next);
                      setValid(isValid);
                    }}
                  />
                )}
                {type === 'file' && (
                  <FileForm
                    onChange={(next, isValid, file) => {
                      setContent(next);
                      setValid(isValid);
                      setPendingFile(file);
                    }}
                  />
                )}
                {type === 'link' && (
                  <LinkForm
                    onChange={(next, isValid) => {
                      setContent(next);
                      setValid(isValid);
                    }}
                  />
                )}
              </div>

              <div
                className="flex justify-end gap-2 px-5 py-3 border-t border-border-light bg-[#fcfcfd] flex-shrink-0 rounded-b-[16px]"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="text-13 text-text-muted px-3.5 py-1.5 rounded-btn hover:bg-bg-subtle transition-colors duration-120"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!valid || saving}
                  className="text-13 font-medium text-white bg-accent-slate px-[18px] py-1.5 rounded-btn transition-colors duration-120 hover:bg-accent-slate-dark disabled:opacity-45 disabled:hover:bg-accent-slate"
                >
                  {saving ? 'Adding…' : submitLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

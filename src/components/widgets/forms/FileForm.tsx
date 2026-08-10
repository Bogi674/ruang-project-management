'use client';

import { useEffect, useRef, useState } from 'react';
import { FileContent, PendingFileUpload } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { FieldError, FieldLabel, TextAreaField, TextField } from './fields';

export interface FileFormProps {
  initial?: Partial<FileContent>;
  onChange: (content: FileContent, valid: boolean, pendingFile: PendingFileUpload | null) => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

/** Uploads the bytes straight to R2 with a presigned PUT, reporting progress. */
function putToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(file);
  });
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot) : '—';
}

function shortType(mime: string): string {
  if (!mime) return 'File';
  const sub = mime.split('/')[1] || mime;
  return sub.split(/[.+-]/).pop()!.toUpperCase();
}

export function FileForm({ initial, onChange }: FileFormProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<PendingFileUpload | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(
      { display_name: displayName.trim(), description: description.trim() },
      state === 'done' && !!uploaded,
      uploaded
    );
  }, [displayName, description, state, uploaded]);

  async function startUpload(file: File) {
    setState('uploading');
    setProgress(0);
    setErrorMessage('');
    setUploaded(null);
    if (!displayName.trim()) setDisplayName(file.name.replace(/\.[^.]+$/, ''));

    try {
      const res = await fetch(
        `/api/files/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(
          file.type || 'application/octet-stream'
        )}`
      );
      if (!res.ok) throw new Error('Could not reach storage');
      const { url, key } = (await res.json()) as { url: string; key: string };

      await putToR2(url, file, setProgress);

      setUploaded({
        filename: file.name,
        r2_object_key: key,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      setProgress(100);
      setState('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setProgress(0);
    setUploaded(null);
    setErrorMessage('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) startUpload(file);
        }}
      />

      {(state === 'idle' || state === 'error') && (
        <div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) startUpload(file);
            }}
            className={`border-2 border-dashed rounded-card p-9 text-center cursor-pointer transition-colors duration-150 outline-none ${
              dragging ? 'border-accent-blue bg-bg-surface' : 'border-border-medium hover:border-accent-blue hover:bg-bg-surface'
            }`}
          >
            <div className="w-10 h-10 rounded-[10px] bg-bg-elevated flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
            <p className="text-[13.5px] font-medium text-text-primary mb-0.5">Drop file here</p>
            <p className="text-12 text-text-muted">or click to browse — any file type</p>
          </div>
          {state === 'error' && <FieldError>{errorMessage}</FieldError>}
        </div>
      )}

      {state === 'uploading' && (
        <div className="border border-border-default rounded-card p-4 bg-bg-surface">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-13 font-medium text-text-primary truncate">{displayName || 'Uploading…'}</p>
              <p className="text-11 text-text-muted">Uploading to storage…</p>
            </div>
          </div>
          <div className="h-[4px] rounded-full bg-border-default overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-blue"
              style={{ width: `${progress}%`, transition: 'width 100ms linear' }}
            />
          </div>
          <p className="text-11 text-text-faint text-right mt-1">{progress}%</p>
        </div>
      )}

      {state === 'done' && uploaded && (
        <div className="border border-border-default rounded-card p-3.5 bg-bg-surface">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-text-primary truncate">{uploaded.filename}</p>
              <span className="flex items-center gap-1 text-11 text-text-muted">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1B5D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Upload complete
              </span>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              onClick={reset}
              className="text-text-faint hover:text-danger transition-colors duration-120 p-1 flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-text-faint mb-2">File Attributes</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Original Name', value: uploaded.filename },
              { label: 'Type · Ext', value: `${shortType(uploaded.mime_type)} · ${extensionOf(uploaded.filename)}` },
              { label: 'File Size', value: formatFileSize(uploaded.size_bytes) },
            ].map((attr) => (
              <div key={attr.label} className="bg-bg-base border border-border-default rounded-[7px] p-2">
                <p className="font-mono text-[8.5px] tracking-[0.08em] uppercase text-text-faint mb-0.5">{attr.label}</p>
                <p className="text-[11.5px] text-text-primary font-medium truncate" title={attr.value}>
                  {attr.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Display Name</FieldLabel>
        <TextField
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Project Brief v3"
        />
      </div>

      <div>
        <FieldLabel optional>Short Description</FieldLabel>
        <TextAreaField
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this file about?"
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkContent, LinkPreview } from '@/types';
import { FieldError, FieldHint, FieldLabel, TextAreaField, TextField } from './fields';

export interface LinkFormProps {
  initial?: Partial<LinkContent>;
  onChange: (content: LinkContent, valid: boolean) => void;
}

function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isUsableUrl(raw: string): boolean {
  const value = normalizeUrl(raw);
  if (!value) return false;
  try {
    const url = new URL(value);
    return !!url.hostname && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function LinkForm({ initial, onChange }: LinkFormProps) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.og_title ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [preview, setPreview] = useState<LinkPreview | null>(
    initial?.og_title
      ? {
          domain: initial.domain ?? '',
          og_title: initial.og_title,
          og_description: initial.og_description ?? '',
          og_image: initial.og_image ?? null,
        }
      : null
  );
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(
      {
        url: normalizeUrl(url),
        og_title: title.trim() || preview?.og_title || '',
        og_description: preview?.og_description ?? '',
        og_image: preview?.og_image ?? null,
        domain: preview?.domain ?? '',
        note: note.trim(),
      },
      isUsableUrl(url)
    );
  }, [url, title, note, preview]);

  async function fetchPreview() {
    if (!isUsableUrl(url)) {
      setErrorMessage('Enter a valid URL first');
      return;
    }
    setFetching(true);
    setErrorMessage('');
    setPreview(null);
    try {
      const res = await fetch(`/api/links/preview?url=${encodeURIComponent(normalizeUrl(url))}`);
      if (!res.ok) throw new Error('Could not load a preview for that URL');
      const data = (await res.json()) as LinkPreview;
      setPreview(data);
      // Never clobber a title the user already typed by hand.
      if (data.og_title && !title.trim()) setTitle(data.og_title);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel required>URL</FieldLabel>
        <div className="flex gap-2">
          <TextField
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fetchPreview();
              }
            }}
            placeholder="https://…"
            className="flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={fetchPreview}
            disabled={fetching}
            className="flex-shrink-0 whitespace-nowrap text-[12.5px] font-medium text-text-secondary bg-bg-surface border border-border-default rounded-btn px-3.5 transition-colors duration-120 hover:bg-bg-elevated hover:border-accent-blue hover:text-accent-blue-dark disabled:opacity-50"
          >
            {fetching ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : <FieldHint>Paste a URL and click Fetch to load a preview</FieldHint>}
      </div>

      {fetching && (
        <div>
          <FieldLabel>Preview</FieldLabel>
          <div className="border border-border-default rounded-widget overflow-hidden">
            <div className="h-[90px] bg-bg-subtle animate-pulse" />
            <div className="p-3">
              <div className="h-2 rounded bg-border-default w-[45%] mb-2 animate-pulse" />
              <div className="h-3 rounded bg-border-default w-[80%] mb-1.5 animate-pulse" />
              <div className="h-2.5 rounded bg-border-default w-[65%] animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {!fetching && preview && (
        <div>
          <FieldLabel>Preview</FieldLabel>
          <div className="border border-border-default rounded-widget overflow-hidden">
            {preview.og_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.og_image}
                alt=""
                className="w-full h-[130px] object-cover bg-bg-subtle"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="h-[130px] flex items-center justify-center"
                style={{
                  background:
                    'repeating-linear-gradient(45deg,var(--bg-subtle),var(--bg-subtle) 8px,var(--bg-elevated) 8px,var(--bg-elevated) 16px)',
                }}
              >
                <span className="font-mono text-[9px] tracking-[0.08em] text-text-faint">no og:image</span>
              </div>
            )}
            <div className="p-3 pb-3.5">
              <p className="font-mono text-[9.5px] tracking-[0.08em] uppercase text-text-faint mb-1">
                {preview.domain}
              </p>
              <p className="text-13 font-semibold text-text-primary leading-snug mb-1">
                {preview.og_title || 'No title found'}
              </p>
              {preview.og_description && (
                <p className="text-[11.5px] text-text-muted leading-relaxed">{preview.og_description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Title</FieldLabel>
        <TextField
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-filled from page title"
        />
      </div>

      <div>
        <FieldLabel optional>Notes</FieldLabel>
        <TextAreaField
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why are you saving this?"
        />
      </div>
    </div>
  );
}

'use client';

import { AutosaveState } from '@/types';

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  if (state.status === 'idle') return null;
  return (
    <div className="flex items-center gap-1.5 text-11 text-text-muted">
      {state.status === 'saving' && (
        <>
          <span className="inline-block w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
          <span>Saving…</span>
        </>
      )}
      {state.status === 'saved' && <span className="text-accent-green-dark">Saved</span>}
      {state.status === 'error' && (
        <span className="text-danger">Couldn&apos;t save — check connection</span>
      )}
    </div>
  );
}

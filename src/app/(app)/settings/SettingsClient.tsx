'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { getInitials } from '@/lib/utils';

interface SettingsClientProps {
  name: string;
  email: string;
  image?: string | null;
}

export function SettingsClient({ name, email }: SettingsClientProps) {
  const [displayName, setDisplayName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: displayName }) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="px-12 py-9 max-w-[660px]">
      <h1 className="font-serif text-[24px] text-text-primary mb-8" style={{ letterSpacing: '-0.02em' }}>Account Settings</h1>

      {/* Profile */}
      <section className="mb-8">
        <div className="flex items-center gap-4 mb-6 p-4 bg-bg-surface border border-border-default rounded-card">
          <div className="w-16 h-16 rounded-full bg-accent-slate flex items-center justify-center text-white text-18 font-semibold flex-shrink-0">
            {getInitials(name || 'U')}
          </div>
          <div className="flex-1">
            <p className="text-15 font-semibold text-text-primary">{name}</p>
            <p className="text-13 text-text-muted">{email}</p>
          </div>
          <button className="text-12 text-text-secondary border border-border-default rounded-btn px-3 py-1.5 hover:bg-bg-surface transition-colors duration-120">
            Change photo
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-13 font-semibold text-text-primary mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-12 px-4 rounded-input border border-border-medium text-14 text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120"
            />
          </div>
          <div>
            <label className="block text-13 font-semibold text-text-primary mb-1.5">Email</label>
            <input
              type="email"
              defaultValue={email}
              disabled
              className="w-full h-12 px-4 rounded-input border border-border-medium text-14 text-text-muted bg-bg-surface outline-none cursor-not-allowed"
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border-default">
            <label className="text-13 font-semibold text-text-primary">Password</label>
            <button type="button" className="text-13 text-text-secondary border border-border-default rounded-btn px-3 py-1.5 hover:bg-bg-surface transition-colors duration-120">
              Change
            </button>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 rounded-btn bg-accent-slate text-white text-13 font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Connected */}
      <section className="mb-8">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Connected Accounts</p>
        <div className="flex items-center gap-3 p-4 border border-border-default rounded-card">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div className="flex-1">
            <p className="text-13 font-semibold text-text-primary">Google</p>
            <p className="text-11 text-text-muted">{email}</p>
          </div>
          <button className="text-12 font-medium border rounded-btn px-3 py-1.5 transition-colors duration-120"
            style={{ color: '#F08050', borderColor: '#f8c8a8' }}>
            Disconnect
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-3">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint">Danger Zone</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full h-11 rounded-btn text-white text-13 font-medium transition-colors duration-120"
          style={{ background: '#F08050' }}
        >
          Sign out
        </button>
        <button
          className="w-full h-11 rounded-btn text-13 font-medium border transition-colors duration-120"
          style={{ color: '#F08050', borderColor: '#f8c8a8' }}
        >
          Delete account
        </button>
      </section>
    </div>
  );
}

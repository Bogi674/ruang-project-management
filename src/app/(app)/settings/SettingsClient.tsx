'use client';

import { useState, useRef } from 'react';
import { TodoSettingsTab } from '@/components/todos/TodoSettingsTab';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import { usePreferences, type PreferenceSaveError } from '@/lib/preferences';
import { ACCENT_PRESETS, resolveTheme } from '@/lib/theme';

interface SettingsClientProps {
  name: string;
  email: string;
  image?: string | null;
  isGoogleUser?: boolean;
}

// Dark stays an explicit choice rather than an OS inheritance: the app is a
// writing surface, and flipping someone's page to dark at sundown because
// their phone did is not a decision to make for them.
const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TYPOGRAPHY_OPTIONS = [
  { value: 'sans', label: 'Sans-serif', sub: 'Clean, modern' },
  { value: 'serif', label: 'Serif', sub: 'Newsreader, editorial' },
];

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

/** Appearance fields that render their own inline rejection notice. */
const INLINE_ERROR_FIELDS = [
  'accent_color',
  'typography_preference',
  'theme_preference',
  'density_preference',
  'surface_preference',
  'app_background_preference',
  'background_tint_preference',
  'landing_page_preference',
];

const LANDING_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'room', label: 'My Room' },
  { value: 'storeroom', label: 'Storeroom' },
];

/*
 * Swatch previews are drawn from the same tokens the real surfaces use
 * (--canvas-ink, --bg-base…), so every preview is already correct in dark
 * mode instead of being a light-mode picture of a dark feature.
 */
const SURFACE_OPTIONS = [
  {
    value: 'clean',
    label: 'Clean',
    sub: 'Plain paper',
    preview: null,
  },
  {
    value: 'dotgrid',
    label: 'Dot Grid',
    sub: 'Graph paper',
    preview: {
      backgroundImage:
        'radial-gradient(circle, color-mix(in srgb, var(--text-faint) 70%, transparent) 1px, transparent 1px)',
      backgroundSize: '10px 10px',
    },
  },
  {
    value: 'warm',
    label: 'Warm Paper',
    sub: 'Cream tone',
    preview: { backgroundColor: 'var(--surface-warm)' },
  },
  {
    value: 'lined',
    label: 'Lined',
    sub: 'Notebook feel',
    preview: {
      backgroundImage:
        'repeating-linear-gradient(to bottom, transparent, transparent 11px, color-mix(in srgb, var(--text-faint) 55%, transparent) 11px, color-mix(in srgb, var(--text-faint) 55%, transparent) 12px)',
    },
  },
];

/** App-wide background graphic. Previews mirror the rules in globals.css. */
const APP_BACKGROUND_OPTIONS = [
  { value: 'plain', label: 'Plain', sub: 'No pattern', preview: null },
  {
    value: 'dots',
    label: 'Dots',
    sub: 'Even dot field',
    preview: {
      backgroundImage: 'radial-gradient(circle, var(--preview-ink) 1px, transparent 1px)',
      backgroundSize: '9px 9px',
    },
  },
  {
    value: 'grid',
    label: 'Grid',
    sub: 'Squared paper',
    preview: {
      backgroundImage:
        'linear-gradient(to right, var(--preview-ink) 1px, transparent 1px), linear-gradient(to bottom, var(--preview-ink) 1px, transparent 1px)',
      backgroundSize: '11px 11px',
    },
  },
  {
    value: 'diagonal',
    label: 'Diagonal',
    sub: 'Fine hatching',
    preview: {
      backgroundImage:
        'repeating-linear-gradient(45deg, var(--preview-ink) 0, var(--preview-ink) 1px, transparent 1px, transparent 7px)',
    },
  },
  {
    value: 'waves',
    label: 'Rings',
    sub: 'Soft concentric',
    preview: {
      backgroundImage:
        'repeating-radial-gradient(circle at 50% -40%, var(--preview-ink) 0, var(--preview-ink) 1px, transparent 1px, transparent 12px)',
    },
  },
  {
    value: 'glow',
    label: 'Glow',
    sub: 'Accent pools',
    preview: {
      backgroundImage:
        'radial-gradient(70% 90% at 10% 0%, var(--canvas-glow) 0%, transparent 70%), radial-gradient(70% 90% at 95% 100%, var(--canvas-glow) 0%, transparent 70%)',
    },
  },
];

/**
 * Page tint. The swatch is painted with the exact colour the canvas will take,
 * resolved live from the theme rather than hard-coded per option.
 */
const TINT_OPTIONS = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'mint', label: 'Mint' },
  { value: 'blush', label: 'Blush' },
  { value: 'accent', label: 'Accent' },
];

type SettingsTab = 'profile' | 'appearance' | 'to-do';

export function SettingsClient({ name, email, image, isGoogleUser }: SettingsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const { preferences, updatePreferences, saveError } = usePreferences();

  return (
    <div className="px-4 py-6 md:px-12 md:py-9 max-w-[720px]">
      <h1 className="font-serif text-[24px] text-text-primary mb-6" style={{ letterSpacing: '-0.02em' }}>
        Settings
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default mb-8">
        {(['profile', 'appearance', 'to-do'] as SettingsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors duration-120 capitalize border-b-2 -mb-px ${
              tab === t
                ? 'text-text-primary border-accent-blue'
                : 'text-text-muted border-transparent hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <ProfileTab name={name} email={email} image={image} isGoogleUser={isGoogleUser} />
      )}

      {tab === 'appearance' && (
        <>
          {/* Every appearance control carries its own inline notice now, so this
              only catches a field that somehow has no section of its own. */}
          {saveError && !saveError.fields.some((f) => INLINE_ERROR_FIELDS.includes(f)) && (
            <p className="mb-5 text-[12.5px] text-danger bg-danger-bg border border-danger-border rounded-[10px] px-3 py-2">
              {saveError.message}
            </p>
          )}
          <AppearanceTab
            preferences={preferences}
            updatePreferences={updatePreferences}
            saveError={saveError}
          />
        </>
      )}

      {tab === 'to-do' && (
        <TodoSettingsTab
          preferences={preferences}
          updatePreferences={updatePreferences}
          saveError={saveError}
        />
      )}

      {/* Danger zone - always visible at bottom */}
      <div className="mt-10 pt-8 border-t border-border-default space-y-3">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint">Danger Zone</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full h-11 rounded-[10px] bg-danger text-white text-[13px] font-medium hover:bg-danger-dark transition-colors duration-120"
        >
          Sign out
        </button>
        <button
          className="w-full h-11 rounded-[10px] text-[13px] font-medium border border-danger-border text-danger hover:bg-danger-bg transition-colors duration-120"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}

function ProfileTab({ name, email, image, isGoogleUser }: { name: string; email: string; image?: string | null; isGoogleUser?: boolean }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [avatarUrl, setAvatarUrl] = useState(image || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: displayName, avatar_url: avatarUrl || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image must be under 2MB.'); return; }

    setAvatarError('');
    setUploadingAvatar(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarUrl(dataUrl);
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: dataUrl }),
      });
      setUploadingAvatar(false);
      router.refresh();
    };
    reader.readAsDataURL(file);
  }

  async function handleAvatarReset() {
    const defaultAvatar = isGoogleUser ? (image || '') : '';
    setAvatarUrl(defaultAvatar);
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: defaultAvatar || null }),
    });
    router.refresh();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must be at least 8 characters with letters and numbers.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setChangingPassword(false);
    const data = await res.json();
    if (res.ok) {
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      setPasswordError(data.error || 'Failed to change password.');
    }
  }

  const displayAvatar = avatarUrl || image;

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Photo</p>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-accent-slate flex items-center justify-center flex-shrink-0">
              {displayAvatar ? (
                <img src={displayAvatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[22px] font-semibold">{getInitials(name || 'U')}</span>
              )}
            </div>
            {uploadingAvatar && (
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'var(--scrim-strong)' }}
              >
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="h-9 px-4 rounded-[10px] border border-border-medium text-[13px] text-text-secondary hover:bg-bg-surface transition-colors"
            >
              Change photo
            </button>
            <button
              onClick={handleAvatarReset}
              className="h-9 px-4 rounded-[10px] border border-border-light text-[13px] text-text-muted hover:bg-bg-surface transition-colors block"
            >
              {isGoogleUser ? 'Reset to Google photo' : 'Remove photo'}
            </button>
          </div>
        </div>
        {avatarError && <p className="text-[12px] text-danger mt-2">{avatarError}</p>}
      </section>

      {/* Profile form */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Profile</p>
        <form onSubmit={handleSave} className="space-y-4 max-w-[440px]">
          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Email</label>
            <input
              type="email"
              defaultValue={email}
              disabled
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-light text-[14px] text-text-muted bg-bg-surface outline-none cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 rounded-[10px] bg-accent-slate text-white text-[13px] font-medium hover:bg-accent-slate-dark transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Change password (local users only) */}
      {!isGoogleUser && (
        <section>
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Change password</p>
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-[440px]">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors placeholder:text-text-faint"
            />
            <input
              type="password"
              placeholder="New password (min 8 chars, letters & numbers)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors placeholder:text-text-faint"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors placeholder:text-text-faint"
            />
            {passwordError && <p className="text-[12px] text-danger">{passwordError}</p>}
            {passwordMsg && <p className="text-[12px] text-accent-green-dark">{passwordMsg}</p>}
            <button
              type="submit"
              disabled={changingPassword}
              className="h-11 px-6 rounded-[10px] bg-accent-slate text-white text-[13px] font-medium hover:bg-accent-slate-dark transition-colors disabled:opacity-60"
            >
              {changingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      )}

      {/* Connected accounts */}
      {isGoogleUser && (
        <section>
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Connected Accounts</p>
          <div className="flex items-center gap-3 p-4 border border-border-default rounded-[12px]">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-text-primary">Google</p>
              <p className="text-[11px] text-text-muted">{email}</p>
            </div>
            <span className="text-[12px] text-accent-green-dark font-medium">Connected</span>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The rejection notice for one section.
 *
 * It renders where the click happened rather than only at the top of the tab.
 * With the message 600px above the App Background grid, a rejected save read as
 * a selector that unselects itself — which is exactly how it was reported.
 */
function SaveErrorNote({ error, field }: { error: PreferenceSaveError | null; field: string }) {
  if (!error || !error.fields.includes(field)) return null;
  return (
    <p
      role="alert"
      className="mt-3 text-[12.5px] text-danger bg-danger-bg border border-danger-border rounded-[10px] px-3 py-2"
    >
      {error.message}
    </p>
  );
}

function AppearanceTab({
  preferences,
  updatePreferences,
  saveError,
}: {
  preferences: ReturnType<typeof usePreferences>['preferences'];
  updatePreferences: ReturnType<typeof usePreferences>['updatePreferences'];
  saveError: PreferenceSaveError | null;
}) {
  return (
    <div className="space-y-8">
      {/* Theme */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Theme</p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ value, label }) => {
            // Anything previously stored as "system" now reads as Light,
            // matching what applyPreferences actually renders.
            const active = (preferences.theme_preference === 'dark' ? 'dark' : 'light') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ theme_preference: value })}
                className="flex-1 h-11 rounded-[10px] text-[13px] font-medium border transition-colors duration-120"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                  color: active ? 'var(--accent-blue-dark)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="theme_preference" />
      </section>

      {/* Accent color */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Accent Color</p>
        <div className="flex items-center gap-2.5 flex-wrap">
          {ACCENT_PRESETS.map(({ label, value }) => {
            const active = (preferences.accent_color || '#A1B5D8') === value;
            return (
              <button
                key={value}
                title={label}
                onClick={() => updatePreferences({ accent_color: value })}
                className="w-9 h-9 rounded-full transition-all duration-120 flex items-center justify-center"
                style={{
                  background: value,
                  outline: active ? `2.5px solid ${value}` : '2.5px solid transparent',
                  outlineOffset: '2px',
                  boxShadow: active ? `0 0 0 1px rgba(0,0,0,0.08)` : undefined,
                }}
              >
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m20 6-11 11-5-5"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="accent_color" />
      </section>

      {/* Typography */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Typography</p>
        <div className="grid grid-cols-2 gap-2">
          {TYPOGRAPHY_OPTIONS.map(({ value, label, sub }) => {
            const active = (preferences.typography_preference || 'sans') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ typography_preference: value })}
                className="p-3.5 rounded-[10px] border text-left transition-colors duration-120"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                }}
              >
                <p
                  className="text-[14px] mb-0.5"
                  style={{
                    fontFamily: value === 'serif' ? "'Newsreader', Georgia, serif" : undefined,
                    color: active ? 'var(--accent-blue-dark)' : 'var(--text-primary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </p>
                <p className="text-[12px] text-text-muted">{sub}</p>
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="typography_preference" />
      </section>

      {/* Density */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Density</p>
        <div className="flex gap-2">
          {DENSITY_OPTIONS.map(({ value, label }) => {
            const active = (preferences.density_preference || 'comfortable') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ density_preference: value })}
                className="flex-1 h-11 rounded-[10px] text-[13px] font-medium border transition-colors duration-120"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                  color: active ? 'var(--accent-blue-dark)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="density_preference" />
      </section>

      {/* Note surface */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Note Surface</p>
        <div className="grid grid-cols-2 gap-2">
          {SURFACE_OPTIONS.map(({ value, label, sub, preview }) => {
            const active = (preferences.surface_preference || 'clean') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ surface_preference: value })}
                className="p-3 rounded-[10px] border text-left transition-colors duration-120 overflow-hidden"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                }}
              >
                <div
                  className="w-full h-9 rounded-[6px] mb-2.5 border border-border-light"
                  style={{ backgroundColor: 'var(--bg-base)', ...(preview || {}) }}
                />
                <p
                  className="text-[13px] mb-0.5"
                  style={{
                    color: active ? 'var(--accent-blue-dark)' : 'var(--text-primary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </p>
                <p className="text-[11px] text-text-muted">{sub}</p>
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="surface_preference" />
      </section>

      {/* App background graphic */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-1.5">App Background</p>
        <p className="text-[12px] text-text-muted mb-4">
          The graphic behind Home, Storeroom, My Room and the rest of the app. The writing
          surface is set separately, above.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {APP_BACKGROUND_OPTIONS.map(({ value, label, sub, preview }) => {
            const active = (preferences.app_background_preference || 'plain') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ app_background_preference: value })}
                aria-pressed={active}
                className="p-3 rounded-[10px] border text-left transition-colors duration-120 overflow-hidden"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                }}
              >
                <div
                  className="w-full h-9 rounded-[6px] mb-2.5 border border-border-light"
                  style={{ backgroundColor: 'var(--canvas-base)', ...(preview || {}) }}
                />
                <p
                  className="text-[13px] mb-0.5"
                  style={{
                    color: active ? 'var(--accent-blue-dark)' : 'var(--text-primary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </p>
                <p className="text-[11px] text-text-muted">{sub}</p>
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="app_background_preference" />
      </section>

      {/* Page tint */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-1.5">Page Tint</p>
        <p className="text-[12px] text-text-muted mb-4">
          The colour of the canvas behind your cards. Each swatch shows the exact tone for your
          current theme.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {TINT_OPTIONS.map(({ value, label }) => {
            const active = (preferences.background_tint_preference || 'neutral') === value;
            // Resolved through the same function the app renders with, so the
            // swatch is the colour, not an approximation of it.
            const swatch = resolveTheme({ ...preferences, background_tint_preference: value })
              .vars['--canvas-base'];
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ background_tint_preference: value })}
                aria-pressed={active}
                className="p-2 rounded-[10px] border text-center transition-colors duration-120"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                }}
              >
                <div
                  className="w-full h-8 rounded-[6px] mb-1.5 border border-border-light"
                  style={{ backgroundColor: swatch }}
                />
                <p
                  className="text-[11.5px]"
                  style={{
                    color: active ? 'var(--accent-blue-dark)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </p>
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="background_tint_preference" />
      </section>

      {/* Landing page */}
      <section>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">Open App To</p>
        <div className="flex gap-2">
          {LANDING_OPTIONS.map(({ value, label }) => {
            const active = (preferences.landing_page_preference || 'home') === value;
            return (
              <button
                key={value}
                onClick={() => updatePreferences({ landing_page_preference: value })}
                className="flex-1 h-11 rounded-[10px] text-[13px] font-medium border transition-colors duration-120"
                style={{
                  background: active ? 'var(--accent-blue-bg)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-medium)',
                  color: active ? 'var(--accent-blue-dark)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <SaveErrorNote error={saveError} field="landing_page_preference" />
      </section>
    </div>
  );
}

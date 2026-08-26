'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Step = 'loading' | 'form' | 'done' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    /*
     * Supabase puts the recovery tokens in the URL hash:
     *   #access_token=xxx&refresh_token=xxx&type=recovery
     *
     * We set the session from those tokens so updateUser() works, then
     * immediately show the password form. The session lives only in memory
     * (persistSession: false) so it disappears when the page closes.
     */
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setStep('invalid');
      return;
    }

    supabase()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error('[reset-password] setSession', error.message);
          setStep('invalid');
        } else {
          setStep('form');
        }
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters with letters and numbers.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase().auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError(error.message || 'Failed to update password. The link may have expired.');
      return;
    }

    setStep('done');
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <p
          className="font-serif text-[28px] text-text-primary mb-1"
          style={{ letterSpacing: '-0.025em' }}
        >
          ruang
        </p>

        {step === 'loading' && (
          <p className="text-[13.5px] text-text-secondary mt-6">Verifying your link…</p>
        )}

        {step === 'invalid' && (
          <div className="mt-6">
            <p className="text-[14px] text-text-primary font-medium mb-1">Link expired or invalid</p>
            <p className="text-[13px] text-text-secondary mb-5">
              This reset link has expired or already been used. Request a new one from the login
              page.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-[10px] bg-accent-blue text-white text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120"
            >
              Back to sign in
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <p className="text-[14px] text-text-primary font-medium mb-4">Choose a new password</p>

            {error && (
              <p className="text-[12.5px] text-danger bg-danger-bg border border-danger-border rounded-[10px] px-3 py-2">
                {error}
              </p>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium bg-bg-base text-[13.5px] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium bg-bg-base text-[13.5px] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-[10px] bg-accent-blue text-white text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6">
            <p className="text-[14px] text-text-primary font-medium mb-1">Password updated</p>
            <p className="text-[13px] text-text-secondary mb-5">
              Your password has been changed. Sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-[10px] bg-accent-blue text-white text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

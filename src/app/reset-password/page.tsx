'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';

type Step = 'loading' | 'form' | 'done' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // One client instance shared across setSession/exchangeCode and updateUser.
  const clientRef = useRef<SupabaseClient | null>(null);
  function getClient(): SupabaseClient {
    if (!clientRef.current) {
      clientRef.current = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return clientRef.current;
  }

  useEffect(() => {
    const client = getClient();

    // PKCE flow — Supabase puts a `code` in the query string.
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      client.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            console.error('[reset-password] exchangeCodeForSession', error.message);
            setStep('invalid');
          } else {
            setStep('form');
          }
        });
      return;
    }

    // Implicit / hash-token flow (older Supabase projects).
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      client.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            console.error('[reset-password] setSession', error.message);
            setStep('invalid');
          } else {
            setStep('form');
          }
        });
      return;
    }

    setStep('invalid');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { error } = await getClient().auth.updateUser({ password });
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
        <div className="mb-8">
          <Logo />
        </div>

        {step === 'loading' && (
          <p className="text-[13.5px] text-text-secondary">Verifying your link…</p>
        )}

        {step === 'invalid' && (
          <div>
            <p className="text-[14px] text-text-primary font-medium mb-1">Link expired or invalid</p>
            <p className="text-[13px] text-text-secondary mb-5">
              This reset link has expired or already been used. Request a new one from the login
              page.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-[10px] bg-accent-blue text-accent-ink text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120"
            >
              Back to sign in
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-3">
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
              className="w-full h-11 rounded-[10px] bg-accent-blue text-accent-ink text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div>
            <p className="text-[14px] text-text-primary font-medium mb-1">Password updated</p>
            <p className="text-[13px] text-text-secondary mb-5">
              Your password has been changed. Sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-[10px] bg-accent-blue text-accent-ink text-[13.5px] font-medium hover:bg-accent-blue-dark transition-colors duration-120"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

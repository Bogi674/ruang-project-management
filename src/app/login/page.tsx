'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

type ForgotStep = 'idle' | 'email' | 'otp' | 'newpass' | 'done';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justVerified, setJustVerified] = useState(false);

  // Forgot-password flow state.
  const [forgotStep, setForgotStep] = useState<ForgotStep>('idle');
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpToken, setFpToken] = useState('');
  const [fpPassword, setFpPassword] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  // OTP attempt tracking (mirrors server-side 30-second lockout).
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('verified') === '1') {
      setJustVerified(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Cooldown countdown timer.
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.ok) {
      router.push('/home');
      return;
    }
    setError("Invalid email or password — or an email you haven't confirmed yet.");
  }

  async function handleGoogle() {
    await signIn('google', { callbackUrl: '/home' });
  }

  // ── Forgot password handlers ────────────────────────────────────────────────

  async function handleForgotSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFpError(data.error || 'Something went wrong.');
        return;
      }
      setForgotStep('otp');
      setOtpAttempts(0);
      setOtpCooldown(0);
    } catch {
      setFpError('Could not reach the server. Please try again.');
    } finally {
      setFpLoading(false);
    }
  }

  async function handleForgotSubmitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpCooldown > 0) return;
    setFpError('');
    setFpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail, code: fpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);
        if (newAttempts >= 3 || res.status === 429) {
          setOtpCooldown(30);
          setFpCode('');
          setFpError('Too many attempts. Please wait 30 seconds before trying again.');
        } else {
          setFpError(data.error || 'Incorrect code.');
        }
        return;
      }
      setFpToken(data.token);
      setForgotStep('newpass');
    } catch {
      setFpError('Could not reach the server. Please try again.');
    } finally {
      setFpLoading(false);
    }
  }

  async function handleForgotSubmitNewPass(e: React.FormEvent) {
    e.preventDefault();
    setFpError('');
    if (fpPassword !== fpConfirm) {
      setFpError('Passwords do not match.');
      return;
    }
    if (fpPassword.length < 8 || !/[a-zA-Z]/.test(fpPassword) || !/[0-9]/.test(fpPassword)) {
      setFpError('Password must be at least 8 characters with letters and numbers.');
      return;
    }
    setFpLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fpToken, password: fpPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFpError(data.error || 'Could not reset password.');
        if (res.status === 400) {
          // Token expired — restart flow.
          setForgotStep('email');
          setFpCode('');
          setFpToken('');
        }
        return;
      }
      setForgotStep('done');
    } catch {
      setFpError('Could not reach the server. Please try again.');
    } finally {
      setFpLoading(false);
    }
  }

  function cancelForgot() {
    setForgotStep('idle');
    setFpEmail('');
    setFpCode('');
    setFpToken('');
    setFpPassword('');
    setFpConfirm('');
    setFpError('');
  }

  // ── Forgot password overlay ─────────────────────────────────────────────────

  if (forgotStep !== 'idle') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-8">
        <div className="w-full max-w-[364px] flex flex-col gap-7">
          <div className="flex flex-col items-center gap-3">
            <Logo variant="text" height={36} href="/login" />
          </div>

          {forgotStep === 'done' ? (
            <div className="flex flex-col gap-5 text-center">
              <h1 className="font-serif text-[22px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
                Password updated
              </h1>
              <p className="text-[13.5px] leading-[1.7] text-text-secondary">
                Your password has been changed. Sign in with your new password.
              </p>
              <button
                type="button"
                onClick={cancelForgot}
                className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120"
              >
                Back to sign in
              </button>
            </div>
          ) : forgotStep === 'email' ? (
            <form onSubmit={handleForgotSubmitEmail} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-[22px] text-text-primary m-0" style={{ letterSpacing: '-0.02em' }}>
                  Reset your password
                </h1>
                <p className="text-[13px] text-text-secondary leading-[1.6]">
                  Enter your email and we&apos;ll send a 6-character code.
                </p>
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                required
                autoFocus
                className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
              />
              {fpError && <p className="text-[12px] text-danger text-center">{fpError}</p>}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={fpLoading}
                  className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60"
                >
                  {fpLoading ? 'Sending…' : 'Send code'}
                </button>
                <button
                  type="button"
                  onClick={cancelForgot}
                  className="h-10 text-[13px] text-text-muted hover:text-text-secondary transition-colors duration-120"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : forgotStep === 'otp' ? (
            <form onSubmit={handleForgotSubmitOtp} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-[22px] text-text-primary m-0" style={{ letterSpacing: '-0.02em' }}>
                  Enter the code
                </h1>
                <p className="text-[13px] text-text-secondary leading-[1.6]">
                  We sent a 6-character code to <span className="text-text-primary">{fpEmail}</span>.
                  It expires in 10 minutes.
                </p>
              </div>
              <input
                type="text"
                placeholder="ABC123"
                value={fpCode}
                onChange={(e) => setFpCode(e.target.value.toUpperCase().slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                spellCheck={false}
                className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted text-center font-mono tracking-widest uppercase"
              />
              {fpError && <p className="text-[12px] text-danger text-center">{fpError}</p>}
              {otpCooldown > 0 && (
                <p className="text-[12px] text-text-muted text-center">
                  Try again in {otpCooldown}s
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={fpLoading || otpCooldown > 0 || fpCode.length < 6}
                  className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60"
                >
                  {fpLoading ? 'Verifying…' : 'Verify code'}
                </button>
                <button
                  type="button"
                  onClick={() => setForgotStep('email')}
                  disabled={fpLoading}
                  className="h-10 text-[13px] text-text-muted hover:text-text-secondary transition-colors duration-120"
                >
                  Resend code
                </button>
              </div>
            </form>
          ) : (
            // forgotStep === 'newpass'
            <form onSubmit={handleForgotSubmitNewPass} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-[22px] text-text-primary m-0" style={{ letterSpacing: '-0.02em' }}>
                  New password
                </h1>
                <p className="text-[13px] text-text-secondary leading-[1.6]">
                  Choose a password with at least 8 characters, letters and numbers.
                </p>
              </div>
              <input
                type="password"
                placeholder="New password"
                value={fpPassword}
                onChange={(e) => setFpPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={fpConfirm}
                onChange={(e) => setFpConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
              />
              {fpError && <p className="text-[12px] text-danger text-center">{fpError}</p>}
              <button
                type="submit"
                disabled={fpLoading}
                className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60"
              >
                {fpLoading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Normal login screen ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-8">
      <div className="w-full max-w-[364px] flex flex-col gap-7">
        {/* Logo lockup */}
        <div className="flex flex-col items-center gap-3">
          <Logo variant="text" height={36} href="/login" />
          <p className="text-[13px] text-text-muted text-center">Your calm, focused personal workspace</p>
        </div>

        {justVerified && (
          <p className="text-[12.5px] text-accent-green-dark bg-accent-green border border-accent-green-mid rounded-[10px] px-3 py-2 text-center">
            Email confirmed. Sign in to open your Ruang.
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
          />
          <div className="flex flex-col gap-1">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFpEmail(email); // pre-fill with whatever's in the login form
                  setFpError('');
                  setForgotStep('email');
                }}
                className="text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-120"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && <p className="text-[12px] text-danger text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border-default" />
          <span className="text-[12px] text-text-muted">or</span>
          <div className="flex-1 h-px bg-border-default" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="h-12 rounded-[10px] border border-border-medium flex items-center justify-center gap-3 text-[14px] text-text-primary hover:bg-bg-surface transition-colors duration-120"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-[12px] text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent-blue-dark underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

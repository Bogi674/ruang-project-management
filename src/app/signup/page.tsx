'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required.'); return; }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.ok) {
        router.push('/home');
      } else {
        setError('Account created. Please sign in.');
        router.push('/login');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await signIn('google', { callbackUrl: '/home' });
  }

  const passwordValid = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-8">
      <div className="w-full max-w-[364px] flex flex-col gap-7">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Logo height={36} href="/signup" />
          <p className="text-[13px] text-text-muted text-center">Create your personal workspace</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
            />
          </div>

          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-12 px-4 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password (min 8 chars, letters & numbers)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full h-12 px-4 rounded-[10px] border text-[14px] text-text-primary bg-bg-base outline-none transition-colors duration-120 placeholder:text-text-muted ${
                password.length > 0
                  ? passwordValid
                    ? 'border-accent-green-mid focus:border-accent-green-mid'
                    : 'border-danger focus:border-danger'
                  : 'border-border-medium focus:border-accent-blue'
              }`}
            />
            {password.length > 0 && !passwordValid && (
              <p className="text-[11px] text-danger mt-1 px-1">Min 8 characters, at least one letter and one number.</p>
            )}
          </div>

          <div>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full h-12 px-4 rounded-[10px] border text-[14px] text-text-primary bg-bg-base outline-none transition-colors duration-120 placeholder:text-text-muted ${
                confirmPassword.length > 0
                  ? passwordsMatch
                    ? 'border-accent-green-mid focus:border-accent-green-mid'
                    : 'border-danger focus:border-danger'
                  : 'border-border-medium focus:border-accent-blue'
              }`}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-danger mt-1 px-1">Passwords don&apos;t match.</p>
            )}
          </div>

          {error && <p className="text-[12px] text-danger text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors duration-120 disabled:opacity-60 mt-1"
          >
            {loading ? 'Creating account…' : 'Create account'}
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
          Already have an account?{' '}
          <Link href="/login" className="text-accent-blue-dark underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

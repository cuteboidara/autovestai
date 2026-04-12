'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';

export function EmailVerificationBanner() {
  const user = useAuthStore((state) => state.user);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!user || (user as unknown as { isEmailVerified?: boolean }).isEmailVerified) {
    return null;
  }

  async function handleResend() {
    setResending(true);
    try {
      const { token } = useAuthStore.getState();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setResent(true);
    } catch {
      // ignore
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-sm">
        <span className="text-amber-600 dark:text-amber-400">
          Please verify your email address to unlock all platform features.
        </span>
        {resent ? (
          <span className="text-amber-600 dark:text-amber-400 text-xs">Verification email sent!</span>
        ) : (
          <button
            onClick={() => void handleResend()}
            disabled={resending}
            className="text-xs font-medium text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:no-underline disabled:opacity-50 transition-opacity"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
        )}
      </div>
    </div>
  );
}

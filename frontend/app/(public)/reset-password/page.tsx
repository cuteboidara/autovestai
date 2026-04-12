'use client';

import { FormEvent, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { BrokerInput } from '@/components/ui/broker-input';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.replace('/login'), 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!res.ok) {
        setError('Link is invalid or has expired.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {success ? (
        <p className="text-sm text-muted-foreground">
          Password reset. Redirecting to login...
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <BrokerInput
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            tone="dark"
            className="h-14 rounded-2xl"
          />
          <BrokerInput
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            tone="dark"
            className="h-14 rounded-2xl"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            type="submit"
            className="h-14 w-full justify-center rounded-2xl text-[13px] uppercase tracking-[0.18em]"
            disabled={submitting}
          >
            {submitting ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      pageLabel="Reset Password"
      title="Set a new password"
      description="Enter your new password below."
      heroTitle="Secure password reset"
      heroDescription="Choose a strong password to protect your account."
      valueProps={[]}
      legalText="Choose a strong, unique password. You will be redirected to login after resetting."
      alternateText="Remember your password?"
      alternateHref="/login"
      alternateLabel="Sign in"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

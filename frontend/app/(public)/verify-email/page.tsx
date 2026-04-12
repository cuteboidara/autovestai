'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    })
      .then((res) => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => router.replace('/dashboard'), 2000);
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        setStatus('error');
      });
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="animate-spin h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
        Verifying your email...
      </div>
    );
  }

  if (status === 'success') {
    return (
      <p className="text-sm text-muted-foreground">
        Email verified! Redirecting to your dashboard...
      </p>
    );
  }

  return (
    <p className="text-sm text-danger">
      Link is invalid or has expired. Please request a new verification email.
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      pageLabel="Verify Email"
      title="Verifying your email"
      description="Please wait while we verify your email address."
      heroTitle="Email verification"
      heroDescription="Verify your email to unlock full platform access."
      valueProps={[]}
      legalText="Email verification confirms your identity and helps secure your account."
      alternateText="Back to login?"
      alternateHref="/login"
      alternateLabel="Sign in"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}

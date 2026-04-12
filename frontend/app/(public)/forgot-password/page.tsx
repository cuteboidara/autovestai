'use client';

import { FormEvent, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { BrokerInput } from '@/components/ui/broker-input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <AuthShell
      pageLabel="Forgot Password"
      title="Reset your password"
      description="Enter your email address and we'll send you a reset link."
      heroTitle="Secure account recovery"
      heroDescription="Reset your password securely. The link expires in 1 hour."
      valueProps={[]}
      legalText="If you did not request a password reset, you can safely ignore this page."
      alternateText="Remember your password?"
      alternateHref="/login"
      alternateLabel="Sign in"
    >
      {submitted ? (
        <p className="text-sm text-muted-foreground">
          If that email exists, a reset link has been sent.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <BrokerInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            tone="dark"
            className="h-14 rounded-2xl"
          />
          <Button
            type="submit"
            className="h-14 w-full justify-center rounded-2xl text-[13px] uppercase tracking-[0.18em]"
            disabled={submitting}
          >
            {submitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

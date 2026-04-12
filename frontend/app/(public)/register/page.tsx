'use client';

import { Landmark, LoaderCircle, ShieldCheck, WalletCards } from 'lucide-react';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { BrokerInput } from '@/components/ui/broker-input';
import { getAuthenticatedHomeRoute } from '@/lib/kyc-access';
import { useAuthStore } from '@/store/auth-store';
import { usePlatformStore } from '@/store/platform-store';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const platformStatus = usePlatformStore((state) => state.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const registrationsEnabled =
    platformStatus?.features.registrationsEnabled ?? true;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!registrationsEnabled) {
      setError(
        platformStatus?.maintenanceMessage ||
          'New registrations are temporarily disabled.',
      );
      return;
    }

    if (!acceptedTerms) {
      setError('Accept the terms and CFD risk disclosure before creating an account.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await register({
        email,
        password,
        referralCode: referralCode || undefined,
      });

      router.replace(getAuthenticatedHomeRoute(response.user));
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      pageLabel="Open Live Account"
      title="Create your production trading login"
      description="Register a live portal account to begin onboarding, funding, and compliance review."
      heroTitle="A launch-ready broker portal for funded live accounts."
      heroDescription="Registration routes directly into wallet setup, KYC review, and terminal access so trading permissions can be enforced from day one."
      valueProps={[
        {
          title: 'Execution controls',
          description: 'Margin-aware order handling and live account permissions stay linked from onboarding through the terminal.',
          icon: <Landmark className="h-5 w-5" />,
        },
        {
          title: 'Wallet readiness',
          description: 'Funding and withdrawal requests remain attached to the same live account once onboarding is complete.',
          icon: <WalletCards className="h-5 w-5" />,
        },
        {
          title: 'Compliance gating',
          description: 'Verification remains mandatory before trading access, wallet operations, and terminal submission are enabled.',
          icon: <ShieldCheck className="h-5 w-5" />,
        },
      ]}
      alternateText="Already registered?"
      alternateHref="/login"
      alternateLabel="Back to login"
      legalText="Trading leveraged products involves risk. Account creation does not guarantee funding approval, KYC approval, or trading activation."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <BrokerInput
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          tone="dark"
          className="h-14 rounded-2xl"
        />
        <BrokerInput
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          tone="dark"
          className="h-14 rounded-2xl"
        />
        <BrokerInput
          label="Referral code"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          tone="dark"
          className="h-14 rounded-2xl"
        />
        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
            required
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="text-amber-300 underline underline-offset-4">
              Terms of Service
            </Link>{' '}
            and acknowledge the CFD and leveraged trading risk disclosure.
          </span>
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!registrationsEnabled ? (
          <p className="text-sm text-warning">
            {platformStatus?.maintenanceMessage ||
              'Registrations are temporarily disabled.'}
          </p>
        ) : null}
        <Button
          type="submit"
          className="h-14 w-full justify-center rounded-2xl text-[13px] uppercase tracking-[0.18em]"
          disabled={submitting || !registrationsEnabled || !acceptedTerms}
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

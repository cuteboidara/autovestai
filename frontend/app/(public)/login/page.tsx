'use client';

import { Landmark, LoaderCircle, ShieldCheck, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { BrokerInput } from '@/components/ui/broker-input';
import { getAuthenticatedHomeRoute } from '@/lib/kyc-access';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await login({ email, password });
      router.replace(getAuthenticatedHomeRoute(response.user));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      pageLabel="Client Login"
      title="Access your live trading workspace"
      description="Sign in to manage funded accounts, terminal access, wallet activity, and compliance workflow."
      heroTitle="Institutional execution and account controls in one portal."
      heroDescription="AutovestAI connects client onboarding, live margin trading, wallet operations, and compliance oversight inside a single production workspace."
      valueProps={[
        {
          title: 'Execution quality',
          description: 'Live pricing, margin-aware order handling, and broker terminal controls built for active accounts.',
          icon: <Landmark className="h-5 w-5" />,
        },
        {
          title: 'Wallet operations',
          description: 'Deposit, withdrawal, and transaction review flows stay connected to the same live account ledger.',
          icon: <WalletCards className="h-5 w-5" />,
        },
        {
          title: 'Compliance infrastructure',
          description: 'KYC checkpoints, approval gating, and auditable account access remain enforced before trading unlocks.',
          icon: <ShieldCheck className="h-5 w-5" />,
        },
      ]}
      alternateText="No account yet?"
      alternateHref="/register"
      alternateLabel="Open a live account"
      legalText="CFDs are leveraged products and involve significant risk of loss. Ensure you understand suitability, operational controls, and funding obligations before trading."
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
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          type="submit"
          className="h-14 w-full justify-center rounded-2xl text-[13px] uppercase tracking-[0.18em]"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

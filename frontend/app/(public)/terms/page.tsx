import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Legal / Terms
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Terms of Service and Risk Disclosure
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          This summary page is intended to capture the minimum operational and
          risk acknowledgements required before granting portal access. Replace
          it with your final legal copy before launch.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">
        <p>
          Leveraged CFDs and margin products carry a high risk of loss. Clients
          can lose more than expected through adverse market moves, slippage,
          spread widening, or forced liquidation.
        </p>
        <p>
          Account access, funding, withdrawals, and live trading permissions are
          subject to KYC approval, sanctions screening, fraud controls, and
          internal operational review.
        </p>
        <p>
          By using the platform, the client confirms that all submitted
          information is accurate, that wallet addresses are under the client’s
          control, and that the platform may suspend or reject requests that
          breach legal or operational policy.
        </p>
      </section>

      <Link
        href="/register"
        className="inline-flex rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
      >
        Back To Registration
      </Link>
    </main>
  );
}

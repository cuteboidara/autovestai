export const metadata = { title: 'Legal — AutovestAI' };

export default function LegalPage() {
  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Legal
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Terms of Service &amp; Client Agreement
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Last updated: April 2026. This document is provided for informational
          purposes only and does not constitute legal advice.
        </p>
      </header>

      {/* 1 — Risk Disclosure */}
      <Section title="1. Risk Disclosure">
        <p>
          Contracts for Difference (&quot;CFDs&quot;) are complex financial
          instruments that carry a high degree of risk. You may lose
          substantially more than your initial deposit due to adverse market
          movements, leverage, slippage, and forced liquidation. Past
          performance is not indicative of future results, and there are no
          guaranteed returns.
        </p>
        <p>
          Leverage amplifies both potential profits and potential losses. Before
          trading leveraged products you should carefully consider your
          investment objectives, level of experience, and risk appetite. CFD
          trading may not be suitable for all investors.
        </p>
      </Section>

      {/* 2 — Scope of Services */}
      <Section title="2. Scope of Services">
        <p>
          AutovestAI provides an electronic trading platform for executing CFD
          transactions across multiple asset classes including, but not limited
          to, foreign exchange, indices, commodities, equities, and
          cryptocurrencies. The platform also offers copy-trading
          functionality, analytics tools, and portfolio management features.
        </p>
        <p>
          AutovestAI acts as a counterparty to client trades. We do not provide
          investment advice, portfolio management, or personalised
          recommendations.
        </p>
      </Section>

      {/* 3 — Client Obligations */}
      <Section title="3. Client Obligations">
        <p>By opening and maintaining an account, you agree to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide accurate, current, and complete identification and financial information during registration and upon request.</li>
          <li>Complete all required Know Your Customer (KYC) and Anti-Money Laundering (AML) verification procedures.</li>
          <li>Ensure that all wallet addresses and payment methods linked to your account are under your sole control.</li>
          <li>Maintain sufficient margin in your account at all times to support open positions.</li>
          <li>Refrain from any form of market manipulation, abusive trading, or exploitation of platform vulnerabilities.</li>
          <li>Comply with all applicable laws and regulations in your jurisdiction.</li>
        </ul>
      </Section>

      {/* 4 — Leverage & Margin */}
      <Section title="4. Leverage &amp; Margin">
        <p>
          Leverage ratios are determined by AutovestAI at its sole discretion
          and may be adjusted at any time based on market conditions,
          regulatory requirements, or internal risk assessments. Margin calls
          may be issued when account equity falls below the required
          maintenance margin. Failure to meet a margin call may result in the
          automatic liquidation of open positions without prior notice.
        </p>
      </Section>

      {/* 5 — Deposits & Withdrawals */}
      <Section title="5. Deposits &amp; Withdrawals">
        <p>
          All deposits and withdrawals are subject to KYC verification,
          compliance review, and operational controls. AutovestAI reserves
          the right to delay or refuse any transaction that does not meet
          internal compliance standards or that raises suspicion of fraud,
          money laundering, or other prohibited activity.
        </p>
      </Section>

      {/* 6 — Account Suspension & Termination */}
      <Section title="6. Account Suspension &amp; Termination">
        <p>
          AutovestAI reserves the right to suspend, restrict, or terminate any
          account at any time and for any reason, including but not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Breach of these Terms of Service or any related agreement.</li>
          <li>Failure to complete required KYC/AML verification.</li>
          <li>Suspected fraudulent, abusive, or illegal activity.</li>
          <li>Regulatory or legal requirements.</li>
          <li>Inactivity for an extended period as defined in the fee schedule.</li>
        </ul>
        <p>
          Upon termination, any remaining balance — net of outstanding
          obligations, fees, and pending investigations — will be returned to
          the client via the original payment method where practicable.
        </p>
      </Section>

      {/* 7 — Limitation of Liability */}
      <Section title="7. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, AutovestAI shall
          not be liable for any indirect, incidental, special, consequential,
          or punitive damages, or any loss of profits or revenues, whether
          incurred directly or indirectly, or any loss of data, use, goodwill,
          or other intangible losses resulting from your use of the platform.
        </p>
      </Section>

      {/* 8 — Dispute Resolution */}
      <Section title="8. Dispute Resolution">
        <p>
          Any dispute arising out of or in connection with these terms shall
          first be submitted to the AutovestAI compliance team via
          support@autovestai.com. We will endeavour to resolve complaints
          within 30 business days. If a satisfactory resolution cannot be
          reached, either party may refer the dispute to binding arbitration
          in accordance with the rules of the jurisdiction in which
          AutovestAI is registered.
        </p>
      </Section>

      {/* 9 — Amendments */}
      <Section title="9. Amendments">
        <p>
          AutovestAI reserves the right to modify these terms at any time.
          Material changes will be communicated via email or platform
          notification. Continued use of the platform following such
          notification constitutes acceptance of the revised terms.
        </p>
      </Section>

      {/* Disclaimer */}
      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
          Disclaimer
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          This page is provided for informational purposes only and does not
          constitute a binding legal agreement. The final client agreement,
          risk disclosure statement, and all supplemental legal documents will
          be provided during the account opening process. Clients should read
          all legal documentation carefully before trading.
        </p>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

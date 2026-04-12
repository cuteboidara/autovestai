export const metadata = { title: 'Privacy Policy — AutovestAI' };

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Privacy
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Privacy Policy
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Last updated: April 2026. AutovestAI (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;) is committed to protecting the privacy of our
          clients and website visitors. This policy explains how we collect,
          use, store, and share your personal data.
        </p>
      </header>

      <Section title="1. Data We Collect">
        <p>We collect the following categories of personal data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong className="text-white">Identity &amp; KYC Data</strong> —
            Full name, date of birth, nationality, government-issued ID
            documents, proof of address, selfie verification images.
          </li>
          <li>
            <strong className="text-white">Contact Data</strong> — Email
            address, phone number, residential address.
          </li>
          <li>
            <strong className="text-white">Financial Data</strong> — Source of
            funds declarations, wallet addresses, bank account details,
            transaction history.
          </li>
          <li>
            <strong className="text-white">Trading Activity</strong> — Orders
            placed, positions opened/closed, profit and loss records, copy
            trading subscriptions.
          </li>
          <li>
            <strong className="text-white">Device &amp; Technical Data</strong>{' '}
            — IP address, browser type and version, operating system, device
            identifiers, time zone, session duration, pages visited.
          </li>
          <li>
            <strong className="text-white">Communication Data</strong> —
            Support tickets, emails, and chat messages exchanged with our team.
          </li>
        </ul>
      </Section>

      <Section title="2. Why We Collect Your Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>To verify your identity and comply with KYC/AML regulations.</li>
          <li>To open, maintain, and administer your trading account.</li>
          <li>To process deposits, withdrawals, and internal transfers.</li>
          <li>To monitor trading activity for surveillance and risk management.</li>
          <li>To provide customer support and resolve disputes.</li>
          <li>To improve platform performance, security, and user experience.</li>
          <li>To send important service communications (e.g., margin calls, compliance notices).</li>
          <li>To comply with legal and regulatory obligations.</li>
        </ul>
      </Section>

      <Section title="3. Legal Basis for Processing (GDPR)">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Contractual necessity</strong> — To provide and manage your trading account and execute transactions.</li>
          <li><strong className="text-white">Legal obligation</strong> — To comply with KYC, AML, tax reporting, and financial regulatory requirements.</li>
          <li><strong className="text-white">Legitimate interest</strong> — To prevent fraud, improve our services, and ensure platform security.</li>
          <li><strong className="text-white">Consent</strong> — For marketing communications and non-essential cookies (where applicable).</li>
        </ul>
      </Section>

      <Section title="4. Data Storage &amp; Security">
        <p>
          Your personal data is stored on encrypted servers with access
          restricted to authorised personnel. We implement industry-standard
          security measures including TLS encryption in transit, AES-256
          encryption at rest, role-based access controls, and regular security
          audits.
        </p>
      </Section>

      <Section title="5. Data Retention">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Active accounts</strong> — Data is retained for the duration of the client relationship.</li>
          <li><strong className="text-white">Closed accounts</strong> — Core account and transaction data is retained for a minimum of 5 years after account closure, or longer if required by applicable regulations.</li>
          <li><strong className="text-white">KYC documents</strong> — Retained for at least 5 years after the end of the business relationship, in line with AML directives.</li>
          <li><strong className="text-white">Technical logs</strong> — Retained for up to 12 months for security and troubleshooting purposes.</li>
        </ul>
      </Section>

      <Section title="6. Third-Party Sharing">
        <p>We may share your data with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Payment processors</strong> — To facilitate deposits and withdrawals.</li>
          <li><strong className="text-white">KYC/AML verification providers</strong> — To verify identity documents and screen against sanctions lists.</li>
          <li><strong className="text-white">Cloud infrastructure providers</strong> — For secure data hosting and processing.</li>
          <li><strong className="text-white">Regulatory authorities</strong> — When required by law or in response to a valid legal request.</li>
          <li><strong className="text-white">Professional advisors</strong> — Legal, accounting, and audit firms acting on our behalf.</li>
        </ul>
        <p>
          We do not sell your personal data to third parties. All third-party
          processors are bound by data processing agreements that require them
          to protect your data to the same standard we do.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          We use cookies and similar technologies for authentication, security,
          preference storage, and analytics. Essential cookies are required for
          the platform to function. Analytics and marketing cookies are only
          set with your consent where required by law. You can manage cookie
          preferences through your browser settings.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <p>
          Under the GDPR and similar data protection regulations, you have the
          right to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Access</strong> — Request a copy of the personal data we hold about you.</li>
          <li><strong className="text-white">Rectification</strong> — Request correction of inaccurate or incomplete data.</li>
          <li><strong className="text-white">Erasure</strong> — Request deletion of your data, subject to legal retention requirements.</li>
          <li><strong className="text-white">Portability</strong> — Request your data in a structured, machine-readable format.</li>
          <li><strong className="text-white">Restriction</strong> — Request that we limit processing of your data in certain circumstances.</li>
          <li><strong className="text-white">Objection</strong> — Object to processing based on legitimate interests or direct marketing.</li>
          <li><strong className="text-white">Withdraw consent</strong> — Where processing is based on consent, you may withdraw it at any time.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a
            href="mailto:support@autovestai.com"
            className="text-[#F5A623] hover:text-[#D97706]"
          >
            support@autovestai.com
          </a>
          . We will respond within 30 days.
        </p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be communicated via email or platform notification. Continued
          use of the platform after notification constitutes acceptance of the
          updated policy.
        </p>
      </Section>
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

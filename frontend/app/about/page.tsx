import Link from 'next/link';

export const metadata = { title: 'About — AutovestAI' };

const values = [
  {
    title: 'AI-Powered Analytics',
    description:
      'Our proprietary analytics engine processes market data in real time, surfacing actionable insights and risk metrics that give traders a measurable edge.',
  },
  {
    title: 'Professional-Grade Tools',
    description:
      'From advanced charting and one-click execution to customisable workspaces, every feature is built for speed, precision, and reliability.',
  },
  {
    title: 'Copy Trading',
    description:
      'Follow experienced strategy providers with full transparency. Set risk limits, monitor performance, and maintain complete control over your capital.',
  },
  {
    title: 'Multi-Asset Coverage',
    description:
      'Trade CFDs on forex, indices, commodities, equities, and cryptocurrencies — all from a single account with unified margin.',
  },
];

export default function AboutPage() {
  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Company
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          About AutovestAI
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          AutovestAI is a professional CFD trading infrastructure platform built
          for clients, affiliates, and dealing teams. We combine institutional
          technology with an intuitive interface so every participant — from
          first-time traders to seasoned portfolio managers — can operate with
          confidence.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Our Mission</h2>
        <p className="text-sm leading-7 text-slate-300">
          To democratise access to institutional-grade trading infrastructure
          while maintaining the highest standards of transparency, compliance,
          and risk management. We believe every trader deserves the same
          tools and market access that were once reserved for large financial
          institutions.
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Our Vision</h2>
        <p className="text-sm leading-7 text-slate-300">
          To become the most trusted and technologically advanced CFD platform
          in the industry — a platform where cutting-edge AI analytics, robust
          risk controls, and seamless execution converge to redefine what
          traders expect from their broker.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white">What Makes Us Different</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-2"
            >
              <h3 className="text-sm font-semibold text-[#F5A623]">{v.title}</h3>
              <p className="text-sm leading-7 text-slate-300">{v.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Regulation &amp; Compliance</h2>
        <p className="text-sm leading-7 text-slate-300">
          AutovestAI operates under strict compliance and KYC/AML frameworks.
          All client funds are held in segregated accounts, and every
          transaction is subject to real-time surveillance and reconciliation.
          We are committed to operating transparently within applicable
          regulatory guidelines.
        </p>
      </section>

      <div className="flex gap-4">
        <Link
          href="/register"
          className="inline-flex rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
        >
          Open an Account
        </Link>
        <Link
          href="/contact"
          className="inline-flex rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
        >
          Contact Us
        </Link>
      </div>
    </main>
  );
}

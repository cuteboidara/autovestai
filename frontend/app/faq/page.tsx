'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

const faqs = [
  {
    q: 'What is AutovestAI?',
    a: 'AutovestAI is a professional CFD trading infrastructure platform that combines AI-powered analytics, institutional-grade execution, and copy trading functionality. We serve individual traders, affiliates, and dealing teams across forex, indices, commodities, equities, and cryptocurrencies.',
  },
  {
    q: 'What are CFDs?',
    a: 'CFDs (Contracts for Difference) are financial derivatives that allow you to speculate on price movements of an underlying asset without owning it. When you trade a CFD, you enter a contract to exchange the difference in price from when you open the position to when you close it. CFDs can be traded with leverage, meaning you can control a larger position with a smaller amount of capital.',
  },
  {
    q: 'What markets can I trade?',
    a: 'AutovestAI offers CFDs across multiple asset classes including major, minor, and exotic forex pairs; global stock indices (S&P 500, NASDAQ, DAX, FTSE, etc.); commodities (gold, silver, oil, natural gas); individual equities; and popular cryptocurrencies (BTC, ETH, and more).',
  },
  {
    q: 'What are the fees?',
    a: 'AutovestAI charges through spreads (the difference between bid and ask prices) and may apply swap/overnight financing charges for positions held past the daily rollover. There are no account opening or maintenance fees. Withdrawal fees cover blockchain network costs and are displayed before you confirm each transaction.',
  },
  {
    q: 'Is my money safe?',
    a: 'Client funds are held in segregated accounts separate from company operational funds. All transactions are subject to real-time surveillance, reconciliation, and compliance review. We implement industry-standard security measures including encrypted communications, multi-factor authentication, and regular audits.',
  },
  {
    q: 'How does copy trading work?',
    a: 'Copy trading allows you to automatically replicate the trades of experienced strategy providers. Browse available providers, review their performance history and risk metrics, and allocate a portion of your capital. Trades are mirrored proportionally in your account in real time. You can set risk limits, pause copying, or disconnect at any time.',
  },
  {
    q: 'What is the minimum deposit?',
    a: 'There is no platform-enforced minimum deposit. However, we recommend depositing at least enough to comfortably meet margin requirements for your intended trading instruments. The margin required depends on the instrument and leverage level you select.',
  },
  {
    q: 'How long do withdrawals take?',
    a: 'Withdrawal requests are reviewed by our compliance team and typically processed within 1–24 hours during business days. After processing, blockchain confirmation times vary: USDT on TRC-20 is usually confirmed within minutes, while BTC may take 30–60 minutes depending on network congestion.',
  },
  {
    q: 'Do I need to complete KYC verification?',
    a: 'Yes. All clients must complete identity verification (KYC) before depositing, trading, or withdrawing funds. This is required by anti-money laundering regulations and helps protect both you and the platform. Verification typically takes less than 24 hours.',
  },
  {
    q: 'What leverage is available?',
    a: 'Leverage varies by instrument and account type. Forex majors may offer up to 1:500, while cryptocurrencies and exotic pairs may have lower leverage limits. Leverage levels are subject to change based on market conditions and regulatory requirements.',
  },
  {
    q: 'Can I trade on mobile?',
    a: 'The AutovestAI platform is fully responsive and works on any modern mobile browser. You can open and close positions, manage your wallet, and monitor your portfolio from your phone or tablet. A dedicated mobile app is on our roadmap.',
  },
  {
    q: 'How do I get help?',
    a: 'You can reach our support team via the Contact page, email support@autovestai.com, or use the in-platform support ticket system. For common questions, check our Help Center for instant answers.',
  },
];

export default function FAQPage() {
  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          FAQ
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Frequently Asked Questions
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Everything you need to know about AutovestAI and CFD trading.
          Can&apos;t find your answer?{' '}
          <Link href="/contact" className="text-[#F5A623] hover:text-[#D97706]">
            Contact us
          </Link>
          .
        </p>
      </header>

      <div className="space-y-2">
        {faqs.map((item) => (
          <Accordion key={item.q} question={item.q} answer={item.a} />
        ))}
      </div>
    </main>
  );
}

function Accordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white"
      >
        {question}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/5 px-5 py-4 text-sm leading-7 text-slate-300">
          {answer}
        </div>
      )}
    </div>
  );
}

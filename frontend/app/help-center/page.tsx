'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const sections = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'How do I register for an account?',
        a: 'Click "Open an Account" on our homepage and complete the registration form with your name, email, and a secure password. You will receive a verification email — click the link to activate your account.',
      },
      {
        q: 'What documents do I need for verification?',
        a: 'You will need a valid government-issued photo ID (passport, national ID, or driving licence) and a proof of address document dated within the last 3 months (utility bill, bank statement, or official correspondence).',
      },
      {
        q: 'How long does KYC verification take?',
        a: 'Most verifications are completed within 24 hours. In some cases, additional review may be required, which can take up to 3 business days. You will be notified by email once your verification is approved.',
      },
      {
        q: 'How do I make my first deposit?',
        a: 'Navigate to Wallet → Deposit in your client portal. Select your preferred cryptocurrency and network, then send funds to the displayed deposit address. Deposits are credited after the required number of blockchain confirmations.',
      },
      {
        q: 'Is there a minimum deposit amount?',
        a: 'There is no platform-enforced minimum deposit. However, you should deposit enough to meet the margin requirements for the instruments you wish to trade. Check the instrument specifications for minimum lot sizes.',
      },
    ],
  },
  {
    title: 'Trading',
    questions: [
      {
        q: 'How do I open a position?',
        a: 'Open the trading terminal, select your instrument, choose your lot size and direction (Buy/Sell), optionally set a Stop Loss and Take Profit, then click the execution button. Your position will appear in the Positions tab.',
      },
      {
        q: 'How do I close a position?',
        a: 'Go to the Positions tab in your trading terminal, find the open position you wish to close, and click the close button. You can also set a Take Profit or Stop Loss to close the position automatically at a specified price.',
      },
      {
        q: 'What is leverage and how does it work?',
        a: 'Leverage allows you to control a larger position with a smaller amount of capital. For example, 1:100 leverage means $100 of margin controls a $10,000 position. While leverage amplifies potential profits, it equally amplifies potential losses.',
      },
      {
        q: 'What is margin and what happens during a margin call?',
        a: 'Margin is the collateral required to maintain open positions. When your account equity falls below the maintenance margin level, a margin call is triggered. If equity continues to decline, positions may be automatically liquidated to protect your account from negative balance.',
      },
      {
        q: 'What order types are available?',
        a: 'AutovestAI supports Market orders (instant execution at current price), Limit orders (execute at a specified price or better), Stop orders (triggered when price reaches a specified level), and Stop-Limit orders (combination of stop and limit).',
      },
    ],
  },
  {
    title: 'Wallet & Payments',
    questions: [
      {
        q: 'What deposit methods are available?',
        a: 'We currently accept cryptocurrency deposits including USDT (TRC-20 and ERC-20) and BTC. Additional deposit methods may be added in the future. All deposits are processed on-chain.',
      },
      {
        q: 'How do I withdraw funds?',
        a: 'Navigate to Wallet → Withdraw in your client portal. Enter your withdrawal address, select the network, and specify the amount. All withdrawals are subject to compliance review and are typically processed within 24 hours.',
      },
      {
        q: 'How long do withdrawals take?',
        a: 'Withdrawal requests are reviewed by our compliance team and are typically processed within 1–24 hours during business days. Blockchain confirmation times vary by network — USDT TRC-20 is usually confirmed within minutes, while BTC may take 30–60 minutes.',
      },
      {
        q: 'Are there withdrawal fees?',
        a: 'AutovestAI charges a small network fee to cover blockchain transaction costs. The exact fee varies by cryptocurrency and network conditions. The fee is displayed before you confirm your withdrawal.',
      },
      {
        q: 'Why is my withdrawal pending?',
        a: 'Withdrawals may be held for compliance review, especially for first-time withdrawals, large amounts, or when additional verification is required. You will be notified if any additional information is needed.',
      },
    ],
  },
  {
    title: 'Account Management',
    questions: [
      {
        q: 'How do I reset my password?',
        a: 'Click "Forgot Password" on the login page and enter your registered email. You will receive a link to create a new password. For security, the link expires after 1 hour.',
      },
      {
        q: 'How do I update my KYC documents?',
        a: 'If your documents have expired or you need to update your information, go to Account Settings and submit new documents. Our compliance team will review and update your profile within 24 hours.',
      },
      {
        q: 'What account types are available?',
        a: 'AutovestAI offers Standard accounts for individual traders, Professional accounts with enhanced leverage and features for experienced traders, and Copy Trading accounts that allow you to follow strategy providers.',
      },
      {
        q: 'Can I have multiple trading accounts?',
        a: 'Each verified client is permitted one primary account. If you require additional sub-accounts for strategy separation, contact our support team to discuss your requirements.',
      },
      {
        q: 'How do I close my account?',
        a: 'To close your account, first ensure all positions are closed and withdraw your remaining balance. Then contact support@autovestai.com with your account closure request. Please note that account data is retained as required by regulation.',
      },
    ],
  },
];

export default function HelpCenterPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Support
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Help Center
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Find answers to common questions about your account, trading,
          deposits, withdrawals, and more.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-[#F5A623]">
            {section.title}
          </h2>
          <div className="space-y-2">
            {section.questions.map((item) => (
              <Accordion key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>
      ))}
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

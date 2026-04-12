'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChartCandlestick,
  Linkedin,
  Menu,
  Send,
  ShieldCheck,
  Twitter,
  X,
  Zap,
} from 'lucide-react';

const navLinks = [
  { label: 'Markets', href: '#markets' },
  { label: 'Platforms', href: '#platforms' },
  { label: 'Copy Trading', href: '#platforms' },
  { label: 'Affiliate', href: '#platforms' },
  { label: 'About', href: '#about' },
] as const;

const trustBadges = [
  '4ms Execution Speed',
  'USDT Treasury Deposits',
  '24/5 Live Support',
] as const;

const tickerItems = [
  { symbol: 'EUR/USD', price: '1.0847', change: '+0.12%' },
  { symbol: 'GBP/USD', price: '1.2674', change: '+0.08%' },
  { symbol: 'XAU/USD', price: '2348.90', change: '+0.41%' },
  { symbol: 'BTC/USD', price: '68240.50', change: '-0.34%' },
  { symbol: 'ETH/USD', price: '3526.80', change: '+0.27%' },
  { symbol: 'US30', price: '39284.1', change: '+0.09%' },
  { symbol: 'NAS100', price: '18242.6', change: '+0.16%' },
  { symbol: 'OIL', price: '82.14', change: '-0.22%' },
] as const;

const featureCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: Zap,
    title: 'Ultra-Fast Execution',
    body: 'Orders filled in under 10ms with zero requotes and institutional-grade liquidity routing.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure USDT Deposits',
    body: 'Fund your account instantly with USDT-TRC20. No bank delays, no chargebacks — just capital ready to trade.',
  },
  {
    icon: ChartCandlestick,
    title: '500+ Instruments',
    body: 'Trade Forex, Gold, Indices, Crypto CFDs, and Stocks from a single unified account.',
  },
];

const platformBenefits = [
  'Web & mobile trading terminal',
  'Copy trading marketplace',
  'Affiliate portal & IB dashboard',
  'Full back-office risk controls',
] as const;

const stats = [
  { value: '500+', label: 'Instruments' },
  { value: '4ms', label: 'Execution' },
  { value: '$0', label: 'Deposit Min' },
  { value: '24/5', label: 'Support' },
] as const;

const footerColumns = [
  {
    title: 'Products',
    links: ['Terminal', 'Copy Trading', 'Affiliate', 'API'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Legal', 'Privacy Policy'],
  },
  {
    title: 'Support',
    links: ['Help Center', 'Contact', 'FAQ', 'Status'],
  },
] as const;

const terminalCandles = [
  { x: 26, high: 40, low: 138, open: 110, close: 78 },
  { x: 58, high: 28, low: 118, open: 84, close: 96 },
  { x: 90, high: 52, low: 144, open: 118, close: 82 },
  { x: 122, high: 36, low: 110, open: 74, close: 90 },
  { x: 154, high: 44, low: 132, open: 96, close: 66 },
  { x: 186, high: 30, low: 116, open: 72, close: 92 },
  { x: 218, high: 56, low: 146, open: 122, close: 94 },
  { x: 250, high: 42, low: 122, open: 88, close: 108 },
  { x: 282, high: 50, low: 136, open: 112, close: 86 },
  { x: 314, high: 32, low: 104, open: 76, close: 96 },
] as const;

const terminalPositions = [
  { symbol: 'EUR/USD', side: 'Long 1.20', pnl: '+$184.20' },
  { symbol: 'XAU/USD', side: 'Short 0.40', pnl: '-$42.10' },
] as const;

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5A623] px-6 py-3 text-sm font-semibold text-[#0A0E1A] transition hover:bg-[#D97706]';

const amberGhostButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-[#F5A623]/70 bg-transparent px-6 py-3 text-sm font-semibold text-white transition hover:border-[#F5A623] hover:bg-white/5';

const whiteGhostButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5';

function getChangeTone(change: string) {
  return change.startsWith('-')
    ? 'text-[#F87171] bg-[#7F1D1D]/30 border-[#7F1D1D]'
    : 'text-[#4ADE80] bg-[#14532D]/30 border-[#14532D]';
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          onClick={onNavigate}
          className="text-sm font-medium text-[#9CA3AF] transition hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

function HeroTerminalCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1F2937] bg-gradient-to-b from-[#111827] to-[#0F172A] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
      <div
        aria-hidden
        className="absolute inset-x-10 top-0 h-24 rounded-full bg-[#F5A623]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9CA3AF]">
              Live Trading Terminal
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">1.0847</p>
          </div>
          <div className="rounded-full border border-[#14532D] bg-[#14532D]/30 px-3 py-1 text-xs font-semibold text-[#4ADE80]">
            +0.12%
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#1F2937] bg-[#0B1220]/90 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">EUR/USD</p>
              <p className="text-xs text-[#9CA3AF]">Institutional spread feed</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <span className="h-2 w-2 rounded-full bg-[#4ADE80]" />
              Live
            </div>
          </div>

          <svg viewBox="0 0 320 120" className="h-32 w-full" aria-hidden>
            <defs>
              <linearGradient id="hero-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M16 88 C 42 74, 58 76, 80 58 S 122 36, 148 50 S 196 86, 224 68 S 266 30, 304 22"
              fill="none"
              stroke="#4ADE80"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M16 88 C 42 74, 58 76, 80 58 S 122 36, 148 50 S 196 86, 224 68 S 266 30, 304 22 L304 116 L16 116 Z"
              fill="url(#hero-spark-fill)"
            />
          </svg>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="rounded-lg bg-[#16A34A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#15803D]">
            Buy
          </button>
          <button className="rounded-lg bg-[#DC2626] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#B91C1C]">
            Sell
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-left">
          <div className="rounded-lg border border-[#1F2937] bg-[#0B1220]/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">Spread</p>
            <p className="mt-1 text-sm font-semibold text-white">0.2 pips</p>
          </div>
          <div className="rounded-lg border border-[#1F2937] bg-[#0B1220]/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">Leverage</p>
            <p className="mt-1 text-sm font-semibold text-white">1:500</p>
          </div>
          <div className="rounded-lg border border-[#1F2937] bg-[#0B1220]/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">Latency</p>
            <p className="mt-1 text-sm font-semibold text-white">4ms</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformMockCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1F2937] bg-[#111827] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
      <div className="flex items-center justify-between border-b border-[#1F2937] px-5 py-4">
        <div>
          <p className="text-base font-semibold text-white">AutovestAI Terminal</p>
          <p className="text-sm text-[#9CA3AF]">Multi-asset execution workspace</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <span className="h-2 w-2 rounded-full bg-[#4ADE80]" />
          Synced
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-xl border border-[#1F2937] bg-[#0B1220] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <BarChart3 className="h-4 w-4 text-[#F5A623]" />
              EUR/USD
            </div>
            <div className="rounded-full border border-[#14532D] bg-[#14532D]/30 px-3 py-1 text-xs font-semibold text-[#4ADE80]">
              +1.8%
            </div>
          </div>

          <svg viewBox="0 0 340 180" className="h-48 w-full" aria-hidden>
            {terminalCandles.map((candle) => {
              const isBullish = candle.close < candle.open;
              const color = isBullish ? '#4ADE80' : '#F87171';
              const bodyTop = Math.min(candle.open, candle.close);
              const bodyHeight = Math.max(8, Math.abs(candle.close - candle.open));

              return (
                <g key={candle.x}>
                  <line
                    x1={candle.x}
                    y1={candle.high}
                    x2={candle.x}
                    y2={candle.low}
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <rect
                    x={candle.x - 8}
                    y={bodyTop}
                    width="16"
                    height={bodyHeight}
                    rx="3"
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#1F2937]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0B1220] text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937] bg-[#111827] text-white">
              {terminalPositions.map((position) => (
                <tr key={position.symbol}>
                  <td className="px-4 py-3 font-medium">{position.symbol}</td>
                  <td className="px-4 py-3 text-[#D1D5DB]">{position.side}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      position.pnl.startsWith('-') ? 'text-[#F87171]' : 'text-[#4ADE80]'
                    }`}
                  >
                    {position.pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MarketingHomePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <main className="overflow-x-hidden bg-[#0A0E1A] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0E1A]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-bold uppercase tracking-[0.34em] text-white">
            AUTOVESTAI
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <NavItems />
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/register" className={amberGhostButtonClass}>
              Open Demo Account
            </Link>
            <Link href="/login" className={primaryButtonClass}>
              Login
            </Link>
          </div>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div className="border-t border-white/10 bg-[#0A0E1A] md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
              <nav className="flex flex-col gap-4">
                <NavItems onNavigate={() => setIsMobileMenuOpen(false)} />
              </nav>
              <div className="flex flex-col gap-3">
                <Link
                  href="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={amberGhostButtonClass}
                >
                  Open Demo Account
                </Link>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={primaryButtonClass}
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,166,35,0.08),transparent_26%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:auto,auto,28px_28px,28px_28px] opacity-70"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(245,166,35,0.12),transparent_58%)]"
        />

        <div className="relative mx-auto grid min-h-[90vh] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#F5A623]">
              Regulated CFD Broker
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Trade Smarter. Execute Faster. Keep the Edge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#9CA3AF] sm:text-xl">
              Access 500+ instruments across Forex, Indices, Commodities, Crypto, and
              Stocks — with institutional-grade execution and AI-powered signals.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={primaryButtonClass}>
                Start Trading Now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className={whiteGhostButtonClass}>
                Try Demo Free
              </Link>
            </div>

            <div className="mt-8 flex flex-col gap-3 text-sm text-[#D1D5DB] sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              {trustBadges.map((badge) => (
                <div key={badge} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#14532D]/40 text-[#4ADE80]">
                    <Check className="h-4 w-4" />
                  </span>
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          <HeroTerminalCard />
        </div>
      </section>

      <section id="markets" className="border-y border-[#1F2937] bg-[#0F1424]/85">
        <div className="overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex min-w-max animate-marquee gap-4 pr-4">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <div
                key={`${item.symbol}-${index}`}
                className="flex items-center gap-4 rounded-lg border border-[#7C5A14]/40 bg-[#151C2C] px-4 py-3"
              >
                <span className="text-sm font-semibold text-white">{item.symbol}</span>
                <span className="text-sm tabular-nums text-[#D1D5DB]">{item.price}</span>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${getChangeTone(
                    item.change,
                  )}`}
                >
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#F5A623]">
              Why AutovestAI
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              Built for serious traders.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featureCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="rounded-xl border border-[#1F2937] bg-[#111827] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#F5A623]/12 text-[#F5A623]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 leading-7 text-[#9CA3AF]">{card.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platforms" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#F5A623]">
              Our Platform
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              One terminal. Every market.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#9CA3AF]">
              AutovestAI&apos;s web terminal gives you live charts, one-click execution,
              risk management tools, and copy trading — all in one place.
            </p>

            <div className="mt-8 space-y-4">
              {platformBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded bg-[#F5A623]/15 text-[#F5A623]">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-base text-[#E5E7EB]">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link href="/register" className={primaryButtonClass}>
                Explore the Platform
              </Link>
            </div>
          </div>

          <PlatformMockCard />
        </div>
      </section>

      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-2xl border border-[#1F2937] bg-[#111827] p-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#1F2937] bg-[#0B1220]/75 px-5 py-6 text-center"
            >
              <p className="text-4xl font-semibold tracking-[-0.04em] text-white">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#F5A623]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#F5A623] to-[#D97706] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#0A0E1A] sm:text-4xl">
            Start trading in under 3 minutes.
          </h2>
          <p className="mt-4 text-lg text-[#1F2937]">
            Open a live or demo account today. No minimum deposit required.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-[#0A0E1A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111827]"
            >
              Open Live Account
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg border border-white/70 bg-white/10 px-6 py-3 text-sm font-semibold text-[#0A0E1A] transition hover:bg-white/20"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </section>

      <footer id="about" className="border-t border-white/5 bg-[#0A0E1A] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <p className="text-lg font-bold uppercase tracking-[0.32em] text-white">AUTOVESTAI</p>
            <p className="mt-5 leading-7 text-[#9CA3AF]">
              Professional CFD infrastructure for clients, affiliates, and dealing teams
              running from one trading stack.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="#"
                aria-label="Twitter"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F2937] bg-[#111827] text-[#9CA3AF] transition hover:border-[#F5A623]/40 hover:text-white"
              >
                <Twitter className="h-4 w-4" />
              </Link>
              <Link
                href="#"
                aria-label="LinkedIn"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F2937] bg-[#111827] text-[#9CA3AF] transition hover:border-[#F5A623]/40 hover:text-white"
              >
                <Linkedin className="h-4 w-4" />
              </Link>
              <Link
                href="#"
                aria-label="Telegram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#1F2937] bg-[#111827] text-[#9CA3AF] transition hover:border-[#F5A623]/40 hover:text-white"
              >
                <Send className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-[#F5A623]">
                {column.title}
              </h3>
              <div className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <Link
                    key={link}
                    href="#"
                    className="text-sm text-[#9CA3AF] transition hover:text-white"
                  >
                    {link}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6">
          <p className="text-sm leading-6 text-[#6B7280]">
            CFDs are complex instruments. 74% of retail accounts lose money. Trade
            responsibly.
          </p>
        </div>
      </footer>
    </main>
  );
}

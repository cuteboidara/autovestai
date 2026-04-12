'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface AuthValueProp {
  title: string;
  description: string;
  icon: ReactNode;
}

interface AuthShellProps {
  pageLabel: string;
  title: string;
  description: string;
  heroTitle: string;
  heroDescription: string;
  valueProps: AuthValueProp[];
  alternateText: string;
  alternateHref: string;
  alternateLabel: string;
  legalText: string;
  children: ReactNode;
}

export function AuthShell({
  pageLabel,
  title,
  description,
  heroTitle,
  heroDescription,
  valueProps,
  alternateText,
  alternateHref,
  alternateLabel,
  legalText,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05080F] text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.42fr_0.58fr]">
        <section
          data-testid="auth-card"
          className="order-1 flex items-center justify-center px-5 py-8 sm:px-8 lg:order-2 lg:px-12 xl:px-16"
        >
          <div className="w-full max-w-[32rem]">
            <div className="rounded-[30px] border border-white/10 bg-[#0E1320]/92 p-6 shadow-[0_36px_120px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8B94A7]">
                {pageLabel}
              </p>
              <h1 className="mt-4 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">{description}</p>

              <div className="mt-8 rounded-[26px] border border-white/8 bg-[#08101A] px-5 py-6 sm:px-6">
                {children}
              </div>

              <div className="mt-6 border-t border-white/8 pt-5 text-sm text-slate-400">
                {alternateText}{' '}
                <Link
                  href={alternateHref}
                  className="font-medium text-[#F8D982] transition hover:text-white"
                >
                  {alternateLabel}
                </Link>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{legalText}</p>
            </div>
          </div>
        </section>

        <section
          data-testid="auth-hero-panel"
          className="order-2 relative flex items-center overflow-hidden border-b border-white/6 bg-[#0A0E15] px-5 py-8 sm:px-8 lg:order-1 lg:border-b-0 lg:border-r lg:px-12 xl:px-16"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(240,180,41,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_26%)]" />

          <div className="relative w-full max-w-xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F0B429]/12 text-sm font-semibold text-[#F8D982]">
                AV
              </span>
              <div>
                <p className="text-base font-semibold text-white">AutovestAI</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Broker Access
                </p>
              </div>
            </div>

            <h2 className="mt-8 max-w-lg text-[clamp(30px,4vw,46px)] font-semibold leading-tight tracking-tight text-white">
              {heroTitle}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
              {heroDescription}
            </p>

            <div className="mt-8 grid gap-3">
              {valueProps.map((item) => (
                <div
                  key={item.title}
                  className={cn(
                    'rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm',
                    'shadow-[0_18px_48px_rgba(0,0,0,0.2)]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F0B429]/12 text-[#F8D982]">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

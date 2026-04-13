import { Mail } from 'lucide-react';

export const metadata = { title: 'Careers — AutovestAI' };

const departments = [
  {
    name: 'Engineering',
    description:
      'Build the trading engine, real-time pricing systems, and client-facing platform that power AutovestAI.',
  },
  {
    name: 'Compliance & Legal',
    description:
      'Ensure our operations meet regulatory requirements across every jurisdiction we serve.',
  },
  {
    name: 'Operations & Support',
    description:
      'Manage client onboarding, KYC workflows, treasury operations, and day-to-day platform reliability.',
  },
  {
    name: 'Marketing & Growth',
    description:
      'Drive user acquisition, affiliate partnerships, and brand awareness in the global fintech space.',
  },
];

export default function CareersPage() {
  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Careers
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Join Our Team
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          AutovestAI is growing. We&apos;re looking for talented, driven people
          who want to shape the future of online trading infrastructure.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-[#F5A623]" />
          <h2 className="text-lg font-semibold text-white">How to Apply</h2>
        </div>
        <p className="text-sm leading-7 text-slate-300">
          We don&apos;t have a formal job board yet — and that&apos;s by design.
          We&apos;re a lean team that values initiative. If you&apos;re
          interested in working with us, send your CV and a short note about
          what excites you to:
        </p>
        <a
          href="mailto:careers@autovestai.com"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#F5A623] transition hover:text-[#D97706]"
        >
          careers@autovestai.com
        </a>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white">Departments</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {departments.map((dept) => (
            <div
              key={dept.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-2"
            >
              <h3 className="text-sm font-semibold text-[#F5A623]">
                {dept.name}
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                {dept.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

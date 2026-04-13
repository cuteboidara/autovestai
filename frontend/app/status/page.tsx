'use client';

import { useEffect, useState } from 'react';

import { env } from '@/lib/env';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'error' | 'checking';
  detail?: string;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API', status: 'checking' },
    { name: 'Database', status: 'checking' },
    { name: 'Redis', status: 'checking' },
    { name: 'Trading Engine', status: 'checking' },
  ]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch(`${env.apiUrl}/health/ready`);
      const data = await res.json();

      setServices([
        {
          name: 'API',
          status: res.ok ? 'ok' : 'degraded',
          detail: res.ok ? 'Responding normally' : 'Responding with errors',
        },
        {
          name: 'Database',
          status: data.database?.status === 'ok' ? 'ok' : 'error',
          detail: data.database?.detail ?? 'Unable to determine status',
        },
        {
          name: 'Redis',
          status: data.redis?.status === 'ok' ? 'ok' : 'error',
          detail: data.redis?.detail ?? 'Unable to determine status',
        },
        {
          name: 'Trading Engine',
          status: data.queues?.status === 'ok' ? 'ok' : data.queues?.status === 'warning' ? 'degraded' : 'error',
          detail:
            data.queues?.status === 'ok'
              ? 'Order execution queues healthy'
              : 'Queue issues detected',
        },
      ]);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setServices([
        { name: 'API', status: 'error', detail: 'Unable to reach API' },
        { name: 'Database', status: 'error', detail: 'API unreachable' },
        { name: 'Redis', status: 'error', detail: 'API unreachable' },
        {
          name: 'Trading Engine',
          status: 'error',
          detail: 'API unreachable',
        },
      ]);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }

  const allOk = services.every((s) => s.status === 'ok');
  const anyError = services.some((s) => s.status === 'error');

  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          System
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Platform Status
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Real-time status of AutovestAI platform services. Auto-refreshes every
          30 seconds.
        </p>
      </header>

      {/* Overall Status */}
      <div
        className={`rounded-3xl border p-6 text-center ${
          allOk
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : anyError
              ? 'border-red-500/20 bg-red-500/5'
              : 'border-amber-500/20 bg-amber-500/5'
        }`}
      >
        <div
          className={`text-lg font-semibold ${
            allOk
              ? 'text-emerald-400'
              : anyError
                ? 'text-red-400'
                : 'text-amber-400'
          }`}
        >
          {services[0].status === 'checking'
            ? 'Checking systems…'
            : allOk
              ? 'All Systems Operational'
              : anyError
                ? 'System Outage Detected'
                : 'Degraded Performance'}
        </div>
        {lastChecked && (
          <p className="mt-1 text-xs text-slate-500">
            Last checked: {lastChecked}
          </p>
        )}
      </div>

      {/* Individual Services */}
      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-white">{service.name}</p>
              {service.detail && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {service.detail}
                </p>
              )}
            </div>
            <StatusIndicator status={service.status} />
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        If you are experiencing issues not reflected here, please contact{' '}
        <a
          href="mailto:support@autovestai.com"
          className="text-[#F5A623] hover:text-[#D97706]"
        >
          support@autovestai.com
        </a>
        .
      </p>
    </main>
  );
}

function StatusIndicator({
  status,
}: {
  status: 'ok' | 'degraded' | 'error' | 'checking';
}) {
  const config = {
    ok: { color: 'bg-emerald-400', label: 'Operational' },
    degraded: { color: 'bg-amber-400', label: 'Degraded' },
    error: { color: 'bg-red-400', label: 'Down' },
    checking: { color: 'bg-slate-400 animate-pulse', label: 'Checking…' },
  }[status];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">{config.label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${config.color}`} />
    </div>
  );
}

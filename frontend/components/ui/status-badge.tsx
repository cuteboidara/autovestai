import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  value: string | null | undefined;
  className?: string;
}

const toneMap: Record<string, string> = {
  approved: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  active: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  completed: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  paid: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  open: 'border border-sky-500/25 bg-sky-500/10 text-sky-300',
  live: 'border border-emerald-500 bg-emerald-500 text-white',
  pending: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
  processing: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
  suggested: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
  rejected: 'border border-red-500/25 bg-red-500/10 text-red-300',
  failed: 'border border-red-500/25 bg-red-500/10 text-red-300',
  suspended: 'border border-red-500/25 bg-red-500/10 text-red-300',
  critical: 'border border-red-500/25 bg-red-500/10 text-red-300',
  high: 'border border-orange-500/25 bg-orange-500/10 text-orange-300',
  medium: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
  low: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  cancelled: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  disabled: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  closed: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  skipped: 'border border-violet-500/25 bg-violet-500/10 text-violet-300',
  not_submitted: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  revoked: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  admin: 'border border-slate-500/25 bg-slate-500/10 text-slate-100',
  user: 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
  ok: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  warning: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
  error: 'border border-red-500/25 bg-red-500/10 text-red-300',
  healthy: 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  degraded: 'border border-amber-500/25 bg-amber-500/10 text-amber-300',
};

function normalize(value: string | null | undefined) {
  return (value ?? 'unknown').toLowerCase();
}

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const normalized = normalize(value);
  const label = normalized.replace(/_/g, ' ');
  const isLive = normalized === 'live';

  return (
    <span
      className={cn(
        'inline-flex min-w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.12em]',
        toneMap[normalized] ?? 'border border-slate-500/25 bg-slate-500/10 text-slate-300',
        className,
      )}
    >
      {isLive ? <span className="h-1.5 w-1.5 rounded-full bg-white/90" /> : null}
      {label}
    </span>
  );
}

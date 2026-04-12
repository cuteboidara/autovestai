'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface BrokerInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  tone?: 'light' | 'dark';
}

export const BrokerInput = forwardRef<HTMLInputElement, BrokerInputProps>(function BrokerInput(
  { className, label, error, helperText, id, tone = 'light', value, defaultValue, ...props },
  ref,
) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const hasValue =
    typeof value === 'number' ||
    Boolean(value) ||
    typeof defaultValue === 'number' ||
    Boolean(defaultValue);

  return (
    <label htmlFor={inputId} className="block">
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          value={value}
          defaultValue={defaultValue}
          className={cn(
            'peer h-[42px] w-full rounded-lg border px-3 pb-1 pt-4 text-[14px] outline-none transition-all duration-150',
            tone === 'dark'
              ? 'border-white/10 bg-[#0B1019] text-white placeholder:text-slate-600 focus:border-[#F0B429] focus:ring-[3px] focus:ring-[#F0B429]/20'
              : 'border-[#E5E7EB] bg-white text-[#0F1117] placeholder:text-[#9CA3AF] focus:border-[#F0B429] focus:ring-[3px] focus:ring-[#F0B429]/15',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : '',
            className,
          )}
          {...props}
        />
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium uppercase tracking-[0.12em] transition-all duration-150 peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px]',
            tone === 'dark'
              ? 'text-slate-500 peer-focus:text-[#F8D982]'
              : 'text-[#6B7280] peer-focus:text-[#6B7280]',
            hasValue ? 'top-2.5 translate-y-0 text-[10px]' : '',
          )}
        >
          {label}
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-danger">{error}</p>
      ) : helperText ? (
        <p className={cn('mt-2 text-xs', tone === 'dark' ? 'text-slate-500' : 'text-secondary')}>
          {helperText}
        </p>
      ) : null}
    </label>
  );
});

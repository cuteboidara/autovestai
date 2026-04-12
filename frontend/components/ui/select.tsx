'use client';

import { ChevronDown } from 'lucide-react';
import { forwardRef, SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, helperText, error, children, id, ...props },
  ref,
) {
  const selectId = id ?? props.name;

  return (
    <label className="block space-y-2">
      {label ? <span className="label-eyebrow">{label}</span> : null}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-10 w-full appearance-none rounded-md border border-border bg-page px-3 pr-10 text-[14px] text-primary outline-none transition-all duration-150 focus:border-accent focus:ring-[3px] focus:ring-accent/15',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : '',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-secondary">{helperText}</p>
      ) : null}
    </label>
  );
});

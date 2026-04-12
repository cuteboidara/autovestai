'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, helperText, error, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <label className="block space-y-2">
      {label ? <span className="label-eyebrow">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-10 w-full rounded-md border border-border bg-page px-3 text-[14px] text-primary outline-none transition-all duration-150 placeholder:text-muted focus:border-accent focus:ring-[3px] focus:ring-accent/15',
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : '',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-secondary">{helperText}</p>
      ) : null}
    </label>
  );
});

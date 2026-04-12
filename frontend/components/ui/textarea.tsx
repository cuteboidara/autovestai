'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, helperText, error, id, ...props },
  ref,
) {
  const textareaId = id ?? props.name;

  return (
    <label className="block space-y-2">
      {label ? <span className="label-eyebrow">{label}</span> : null}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'min-h-28 w-full rounded-md border border-border bg-page px-3 py-3 text-[14px] text-primary outline-none transition-all duration-150 placeholder:text-muted focus:border-accent focus:ring-[3px] focus:ring-accent/15',
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

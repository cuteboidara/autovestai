import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function Panel({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={cn(
        'min-w-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-glow',
        className,
      )}
    >
      {title || description || actions ? (
        <header className="flex min-w-0 flex-col items-start justify-between gap-3 border-b border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:px-6 sm:py-5">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-primary">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn('min-w-0 p-4 sm:p-6', contentClassName)}>{children}</div>
    </section>
  );
}

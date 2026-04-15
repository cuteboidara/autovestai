import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-primary sm:text-[28px] lg:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

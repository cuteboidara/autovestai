import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-borderStrong bg-page px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-lg font-semibold text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-secondary">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

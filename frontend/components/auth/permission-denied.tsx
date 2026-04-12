'use client';

import { Panel } from '@/components/ui/panel';

interface PermissionDeniedProps {
  title: string;
  description: string;
  requiredPermission: string;
}

export function PermissionDenied({
  title,
  description,
  requiredPermission,
}: PermissionDeniedProps) {
  return (
    <Panel title={title} description={description}>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Missing permission: <span className="font-mono">{requiredPermission}</span>
      </div>
    </Panel>
  );
}

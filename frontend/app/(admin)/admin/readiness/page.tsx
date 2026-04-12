'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { ReadinessChecklistItem } from '@/types/admin';

export default function AdminReadinessPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<ReadinessChecklistItem[]>([]);
  const canViewReadiness = hasPermission('readiness.view');

  useEffect(() => {
    if (!canViewReadiness) {
      return;
    }

    void adminApi.getReadiness().then(setItems);
  }, [canViewReadiness]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Readiness"
        title="Readiness"
        description="Backend-driven launch readiness, operational dependencies, seeded roles, and broker control validation."
      />

      {!canViewReadiness ? (
        <PermissionDenied
          title="Readiness unavailable"
          description="This admin account does not have permission to view launch readiness."
          requiredPermission="readiness.view"
        />
      ) : (
        <Panel
          title="Checklist"
          description="Current production readiness state reported by the backend."
        >
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-border bg-page p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-primary">{item.label}</p>
                    <p className="mt-2 text-sm text-secondary">
                      {typeof item.detail === 'string'
                        ? item.detail
                        : JSON.stringify(item.detail)}
                    </p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

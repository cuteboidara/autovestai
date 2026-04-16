'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { ReadinessChecklistItem } from '@/types/admin';

const CATEGORY_ORDER: ReadinessChecklistItem['category'][] = [
  'infra',
  'providers',
  'operations',
  'config',
];

const CATEGORY_META: Record<
  ReadinessChecklistItem['category'],
  { title: string; description: string }
> = {
  infra: {
    title: 'Infrastructure',
    description: 'Database, Redis, queue, and websocket runtime health.',
  },
  providers: {
    title: 'Market Providers',
    description: 'Pricing provider coverage, fallback readiness, and upstream issues.',
  },
  operations: {
    title: 'Operations',
    description: 'Runtime workflows, reconciliation, surveillance, and treasury freshness.',
  },
  config: {
    title: 'Configuration',
    description: 'Required platform, broker, and environment configuration checkpoints.',
  },
};

function formatFieldValue(label: string, value: string): string {
  const normalizedLabel = label.toLowerCase();

  if (
    (normalizedLabel.includes('update') || normalizedLabel.includes('retry')) &&
    value !== 'No successful update yet' &&
    value !== 'unknown'
  ) {
    return formatDateTime(value);
  }

  if (normalizedLabel === 'reason') {
    return value.replace(/_/g, ' ');
  }

  return value;
}

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

  const groupedItems = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: items.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Readiness"
        title="Platform Readiness"
        description="Structured launch readiness across infrastructure, pricing providers, configuration, and operational controls."
      />

      {!canViewReadiness ? (
        <PermissionDenied
          title="Readiness unavailable"
          description="This admin account does not have permission to view launch readiness."
          requiredPermission="readiness.view"
        />
      ) : (
        <div className="space-y-6">
          {groupedItems.map(({ category, items: categoryItems }) => (
            <Panel
              key={category}
              title={CATEGORY_META[category].title}
              description={CATEGORY_META[category].description}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.key}
                    className="min-w-0 rounded-2xl border border-border bg-page p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-primary">{item.label}</p>
                        <p className="mt-2 break-words text-sm text-secondary">
                          {item.summary}
                        </p>
                      </div>
                      <StatusBadge value={item.status} className="shrink-0" />
                    </div>

                    {item.detail ? (
                      <p className="mt-3 break-words text-sm text-secondary">{item.detail}</p>
                    ) : null}

                    {item.fields?.length ? (
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        {item.fields.map((field) => (
                          <div
                            key={`${item.key}-${field.label}`}
                            className="min-w-0 rounded-xl border border-border/70 bg-panel/40 p-3"
                          >
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                              {field.label}
                            </dt>
                            <dd className="mt-1 break-words text-sm text-primary">
                              {formatFieldValue(field.label, field.value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {item.action ? (
                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                          Recommended Action
                        </p>
                        <p className="mt-1 break-words text-sm text-amber-100">
                          {item.action}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

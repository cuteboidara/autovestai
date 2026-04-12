'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { AuditLogRecord } from '@/types/admin';

export default function AdminAuditPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    actorUserId: '',
    targetUserId: '',
  });
  const [items, setItems] = useState<AuditLogRecord[]>([]);
  const [selected, setSelected] = useState<AuditLogRecord | null>(null);
  const canViewAudit = hasPermission('audit.view');

  async function refreshAudit() {
    const response = await adminApi.listAuditLogs(
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => Boolean(value)),
      ),
    );

    setItems(response);
    setSelected((current) =>
      current ? response.find((item) => item.id === current.id) ?? null : response[0] ?? null,
    );
  }

  useEffect(() => {
    if (!canViewAudit) {
      return;
    }

    void refreshAudit();
  }, [canViewAudit]);

  if (!canViewAudit) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Audit"
          title="Audit Log"
          description="Immutable audit history for administrative, wallet, KYC, and trading actions."
        />
        <PermissionDenied
          title="Audit unavailable"
          description="This admin account does not have permission to view audit logs."
          requiredPermission="audit.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="Audit Log"
        description="Immutable audit history for administrative, wallet, KYC, and trading actions."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Audit Records"
          description="Filter by actor, target user, action, or entity type."
          actions={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Input
                value={filters.action}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, action: event.target.value }))
                }
                placeholder="Action"
              />
              <Input
                value={filters.entityType}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, entityType: event.target.value }))
                }
                placeholder="Entity type"
              />
              <Input
                value={filters.actorUserId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, actorUserId: event.target.value }))
                }
                placeholder="Actor user ID"
              />
              <Input
                value={filters.targetUserId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, targetUserId: event.target.value }))
                }
                placeholder="Target user ID"
              />
              <Button variant="secondary" onClick={() => void refreshAudit()}>
                Refresh
              </Button>
            </div>
          }
        >
          <DataTable
            columns={[
              {
                key: 'createdAt',
                header: 'Time',
                render: (item) => formatDateTime(item.createdAt),
              },
              {
                key: 'action',
                header: 'Action',
                render: (item) => <span className="font-medium text-primary">{item.action}</span>,
              },
              {
                key: 'entityType',
                header: 'Entity',
                render: (item) => item.entityType,
              },
              {
                key: 'actor',
                header: 'Actor',
                render: (item) => item.actorUser?.email ?? item.actorRole,
              },
            ]}
            data={items}
            rowKey={(item) => item.id}
            onRowClick={(item) => setSelected(item)}
            emptyTitle="No audit records"
            emptyDescription="Audit records matching the selected filters will appear here."
          />
        </Panel>

        <Panel title="Audit Detail" description="Selected audit record and captured request context.">
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="text-lg font-semibold text-primary">{selected.action}</p>
                <p className="mt-1 text-sm text-secondary">
                  {selected.entityType} / {selected.entityId}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['Actor', selected.actorUser?.email ?? selected.actorRole],
                  ['Target', selected.targetUser?.email ?? selected.targetUserId ?? '--'],
                  ['Request ID', selected.requestId ?? '--'],
                  ['IP Address', selected.ipAddress ?? '--'],
                  ['Created', formatDateTime(selected.createdAt)],
                  ['User Agent', selected.userAgent ?? '--'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-page p-4">
                    <p className="label-eyebrow">{label}</p>
                    <p className="mt-2 break-all text-sm text-primary">{value}</p>
                  </div>
                ))}
              </div>

              <Panel title="Metadata" description="Structured audit metadata captured for the action.">
                <pre className="overflow-x-auto rounded-2xl bg-page p-4 text-xs text-secondary">
                  {JSON.stringify(selected.metadataJson ?? {}, null, 2)}
                </pre>
              </Panel>
            </div>
          ) : (
            <p className="text-sm text-secondary">Select an audit record to inspect request context and metadata.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

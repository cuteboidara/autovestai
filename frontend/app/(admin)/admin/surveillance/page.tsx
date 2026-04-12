'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { SurveillanceAlert, SurveillanceCase } from '@/types/admin';

export default function AdminSurveillancePage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [alerts, setAlerts] = useState<SurveillanceAlert[]>([]);
  const [cases, setCases] = useState<SurveillanceCase[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SurveillanceAlert | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [caseStatus, setCaseStatus] = useState<SurveillanceCase['status']>('OPEN');
  const [notesText, setNotesText] = useState('{}');
  const canViewSurveillance = hasPermission('alerts.view');
  const canManageSurveillance = hasPermission('alerts.manage');

  async function refreshSurveillance() {
    const [alertItems, caseItems] = await Promise.all([
      adminApi.listSurveillanceAlerts(),
      adminApi.listSurveillanceCases(),
    ]);

    setAlerts(alertItems);
    setCases(caseItems);
    setSelectedAlert((current) =>
      current ? alertItems.find((item) => item.id === current.id) ?? null : alertItems[0] ?? null,
    );
  }

  useEffect(() => {
    if (!canViewSurveillance) {
      return;
    }

    void refreshSurveillance();
  }, [canViewSurveillance]);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  useEffect(() => {
    if (!selectedCase) {
      return;
    }

    setAssignedToUserId(selectedCase.assignedToUserId ?? '');
    setCaseStatus(selectedCase.status);
    setNotesText(JSON.stringify(selectedCase.notesJson ?? {}, null, 2));
  }, [selectedCase]);

  async function acknowledgeAlert(alertId: string) {
    try {
      await adminApi.acknowledgeSurveillanceAlert(alertId);
      await refreshSurveillance();
      pushNotification({
        title: 'Alert acknowledged',
        description: 'The surveillance alert has been acknowledged.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Acknowledge failed',
        description: error instanceof Error ? error.message : 'Unable to acknowledge alert',
        type: 'error',
      });
    }
  }

  async function closeAlert(alertId: string) {
    try {
      await adminApi.closeSurveillanceAlert(alertId);
      await refreshSurveillance();
      pushNotification({
        title: 'Alert closed',
        description: 'The surveillance alert has been closed.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Close failed',
        description: error instanceof Error ? error.message : 'Unable to close alert',
        type: 'error',
      });
    }
  }

  async function createCase() {
    if (!selectedAlert) {
      return;
    }

    try {
      const parsedNotes = notesText.trim() ? JSON.parse(notesText) : {};
      await adminApi.createSurveillanceCase({
        alertId: selectedAlert.id,
        userId: selectedAlert.userId ?? undefined,
        assignedToUserId: assignedToUserId || undefined,
        notesJson: parsedNotes,
      });
      await refreshSurveillance();
      pushNotification({
        title: 'Case created',
        description: 'A surveillance case has been opened from the selected alert.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Case creation failed',
        description: error instanceof Error ? error.message : 'Unable to create case',
        type: 'error',
      });
    }
  }

  async function updateCase() {
    if (!selectedCase) {
      return;
    }

    try {
      const parsedNotes = notesText.trim() ? JSON.parse(notesText) : {};
      await adminApi.updateSurveillanceCase(selectedCase.id, {
        status: caseStatus,
        assignedToUserId: assignedToUserId || undefined,
        notesJson: parsedNotes,
      });
      await refreshSurveillance();
      pushNotification({
        title: 'Case updated',
        description: 'The surveillance case has been updated.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Case update failed',
        description: error instanceof Error ? error.message : 'Unable to update case',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Surveillance"
        title="Surveillance"
        description="Rule-based abuse detection alerts, manual acknowledgement, closure, and case assignment for operational review."
      />

      {!canViewSurveillance ? (
        <PermissionDenied
          title="Surveillance unavailable"
          description="This admin account does not have permission to view surveillance alerts or cases."
          requiredPermission="alerts.view"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Panel title="Alerts" description="Open, acknowledged, and closed surveillance alerts.">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setSelectedAlert(alert)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedAlert?.id === alert.id
                        ? 'border-accent/40 bg-amber-50'
                        : 'border-border bg-page hover:border-borderStrong hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-primary">{alert.title}</p>
                        <p className="mt-1 text-sm text-secondary">{alert.description}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">
                          {formatDateTime(alert.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge value={alert.severity} />
                        <StatusBadge value={alert.status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Cases" description="Operational cases linked to surveillance alerts.">
              <div className="space-y-3">
                {cases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCaseId(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedCaseId === item.id
                        ? 'border-accent/40 bg-amber-50'
                        : 'border-border bg-page hover:border-borderStrong hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-primary">{item.alert?.title ?? item.id}</p>
                        <p className="mt-1 text-sm text-secondary">
                          Assigned to {item.assignedToUser?.email ?? item.assignedToUserId ?? '--'}
                        </p>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel
              title="Alert detail"
              description="Review selected alert and perform acknowledgement or closure."
            >
              {selectedAlert ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-page p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-primary">{selectedAlert.title}</p>
                        <p className="mt-2 text-sm text-secondary">{selectedAlert.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge value={selectedAlert.severity} />
                        <StatusBadge value={selectedAlert.status} />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-secondary md:grid-cols-2">
                      <p>User: {selectedAlert.user?.email ?? selectedAlert.userId ?? '--'}</p>
                      <p>Symbol: {selectedAlert.symbol ?? '--'}</p>
                      <p>Type: {selectedAlert.alertType}</p>
                      <p>Created: {formatDateTime(selectedAlert.createdAt)}</p>
                    </div>
                  </div>

                  <Textarea
                    label="Alert metadata"
                    value={JSON.stringify(selectedAlert.metadataJson ?? {}, null, 2)}
                    readOnly
                    className="min-h-40"
                  />

                  {canManageSurveillance ? (
                    <div className="flex flex-wrap gap-3">
                      {selectedAlert.status === 'OPEN' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void acknowledgeAlert(selectedAlert.id)}
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                      {selectedAlert.status !== 'CLOSED' ? (
                        <Button
                          variant="danger"
                          onClick={() => void closeAlert(selectedAlert.id)}
                        >
                          Close alert
                        </Button>
                      ) : null}
                      <Button onClick={() => void createCase()}>Create case</Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-page p-4 text-sm text-secondary">
                      Read-only mode. This account can view surveillance alerts but cannot manage them.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-secondary">Select an alert to review.</p>
              )}
            </Panel>

            <Panel
              title="Case detail"
              description="Update assignment, status, and structured notes."
            >
              {selectedCase ? (
                <div className="space-y-4">
                  <Input
                    label="Assigned to user ID"
                    value={assignedToUserId}
                    onChange={(event) => setAssignedToUserId(event.target.value)}
                    disabled={!canManageSurveillance}
                  />
                  <Select
                    value={caseStatus}
                    onChange={(event) =>
                      setCaseStatus(event.target.value as SurveillanceCase['status'])
                    }
                    disabled={!canManageSurveillance}
                  >
                    <option value="OPEN">Open</option>
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="ESCALATED">Escalated</option>
                  </Select>
                  <Textarea
                    label="Case notes JSON"
                    value={notesText}
                    onChange={(event) => setNotesText(event.target.value)}
                    className="min-h-48"
                    disabled={!canManageSurveillance}
                  />
                  {canManageSurveillance ? (
                    <Button onClick={() => void updateCase()}>Save case</Button>
                  ) : (
                    <div className="rounded-2xl border border-border bg-page p-4 text-sm text-secondary">
                      Read-only mode. This account can inspect cases but cannot update them.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-secondary">Select a case to edit.</p>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

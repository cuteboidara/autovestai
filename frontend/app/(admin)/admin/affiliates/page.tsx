'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { affiliatesApi } from '@/services/api/affiliates';
import { useNotificationStore } from '@/store/notification-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { AffiliateCommission, AffiliateProfile } from '@/types/affiliates';

type AdminAffiliate = AffiliateProfile & {
  referralCount: number;
  user: { email: string };
};

export default function AdminAffiliatesPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<AdminAffiliate | null>(null);
  const [parentAffiliateId, setParentAffiliateId] = useState('');
  const [pendingCommission, setPendingCommission] = useState<{
    type: 'approve' | 'pay';
    item: AffiliateCommission;
  } | null>(null);
  const canManageAffiliates = hasPermission('affiliate.manage');

  async function refreshAffiliateAdmin() {
    const [affiliateList, commissionList] = await Promise.all([
      adminApi.listAffiliates(),
      adminApi.listAffiliateCommissions(),
    ]);

    setAffiliates(affiliateList);
    setCommissions(commissionList);
    setSelectedAffiliate((current) =>
      current ? affiliateList.find((item) => item.id === current.id) ?? null : affiliateList[0] ?? null,
    );
  }

  useEffect(() => {
    if (!canManageAffiliates) {
      return;
    }

    void refreshAffiliateAdmin();
  }, [canManageAffiliates]);

  const commissionSummary = useMemo(
    () =>
      commissions.reduce(
        (result, item) => {
          const amount = Number(item.commissionAmount);
          result.total += amount;
          if (item.status === 'PENDING') {
            result.pending += amount;
          }
          if (item.status === 'PAID') {
            result.paid += amount;
          }
          return result;
        },
        { total: 0, pending: 0, paid: 0 },
      ),
    [commissions],
  );

  if (!canManageAffiliates) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Affiliate Admin"
          title="Hierarchy and commission operations"
          description="View affiliate hierarchy, assign parent relationships, approve commissions, and mark payouts."
        />
        <PermissionDenied
          title="Affiliate management unavailable"
          description="This admin account does not have permission to manage affiliates and commissions."
          requiredPermission="affiliate.manage"
        />
      </div>
    );
  }

  async function assignParent() {
    if (!selectedAffiliate || !parentAffiliateId) {
      return;
    }

    try {
      await affiliatesApi.assignParent(selectedAffiliate.id, parentAffiliateId);
      pushNotification({
        title: 'Parent affiliate assigned',
        description: `${selectedAffiliate.referralCode} hierarchy updated.`,
        type: 'success',
      });
      setParentAffiliateId('');
      await refreshAffiliateAdmin();
    } catch (error) {
      pushNotification({
        title: 'Parent assignment failed',
        description: error instanceof Error ? error.message : 'Assignment failed',
        type: 'error',
      });
    }
  }

  async function confirmCommission() {
    if (!pendingCommission) {
      return;
    }

    try {
      if (pendingCommission.type === 'approve') {
        await affiliatesApi.approveCommission(pendingCommission.item.id);
      } else {
        await affiliatesApi.payCommission(pendingCommission.item.id);
      }

      pushNotification({
        title: `Commission ${pendingCommission.type}d`,
        description: pendingCommission.item.id,
        type: 'success',
      });
      setPendingCommission(null);
      await refreshAffiliateAdmin();
    } catch (error) {
      pushNotification({
        title: 'Commission action failed',
        description: error instanceof Error ? error.message : 'Action failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate Admin"
        title="Affiliates"
        description="View affiliate hierarchy, assign parent relationships, approve commissions, and mark payouts."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-page p-4">
          <p className="label-eyebrow">Total commission</p>
          <p className="price-display mt-2 text-2xl font-semibold text-primary">{formatCurrency(commissionSummary.total)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-page p-4">
          <p className="label-eyebrow">Pending</p>
          <p className="price-display mt-2 text-2xl font-semibold text-primary">{formatCurrency(commissionSummary.pending)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-page p-4">
          <p className="label-eyebrow">Paid</p>
          <p className="price-display mt-2 text-2xl font-semibold text-primary">{formatCurrency(commissionSummary.paid)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Affiliates" description="Hierarchy-ready affiliate list.">
          <div className="space-y-3">
            {affiliates.map((affiliate) => (
              <button
                key={affiliate.id}
                type="button"
                onClick={() => setSelectedAffiliate(affiliate)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedAffiliate?.id === affiliate.id
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-border bg-page hover:border-borderStrong hover:bg-surface'
                }`}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{affiliate.referralCode}</p>
                    <p className="mt-1 truncate text-sm text-secondary">{affiliate.user.email}</p>
                  </div>
                  <StatusBadge value={affiliate.status} />
                </div>
                <p className="mt-3 text-sm text-secondary">
                  Level {affiliate.level} • {affiliate.referralCount} referrals
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Assign Parent Affiliate" description="Manual hierarchy control.">
          {selectedAffiliate ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="font-semibold text-primary">{selectedAffiliate.referralCode}</p>
                <p className="mt-1 text-sm text-secondary">{selectedAffiliate.user.email}</p>
                <p className="mt-3 text-sm text-secondary">
                  Current parent {selectedAffiliate.parentAffiliateId ?? '--'}
                </p>
              </div>
              <Input
                label="Parent affiliate ID"
                value={parentAffiliateId}
                onChange={(event) => setParentAffiliateId(event.target.value)}
              />
              <Button variant="secondary" onClick={() => void assignParent()}>
                Assign parent
              </Button>
            </div>
          ) : (
            <p className="text-sm text-secondary">Select an affiliate to manage hierarchy.</p>
          )}
        </Panel>
      </div>

      <Panel title="Commission Approvals" description="Approve pending commissions and mark approved commissions as paid.">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="min-w-[860px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Created</th>
                <th className="pb-3">Affiliate</th>
                <th className="pb-3">Referred user</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 whitespace-nowrap">Status</th>
                <th className="max-w-none overflow-visible pb-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-secondary">
              {commissions.map((commission) => (
                <tr key={commission.id}>
                  <td className="py-3">{formatDateTime(commission.createdAt)}</td>
                  <td className="py-3">{commission.affiliate?.user?.email ?? commission.affiliateId}</td>
                  <td className="py-3">{commission.referredUser?.email ?? commission.referredUserId}</td>
                  <td className="py-3 text-right tabular-nums">{formatCurrency(Number(commission.commissionAmount))}</td>
                  <td className="py-3 whitespace-nowrap">
                    <StatusBadge value={commission.status} />
                  </td>
                  <td className="max-w-none overflow-visible py-3 whitespace-nowrap">
                    <div className="flex min-w-[120px] flex-wrap gap-2">
                      {commission.status === 'PENDING' ? (
                        <Button className="min-w-[120px] justify-center" variant="secondary" onClick={() => setPendingCommission({ type: 'approve', item: commission })}>
                          Approve
                        </Button>
                      ) : null}
                      {commission.status === 'APPROVED' ? (
                        <Button className="min-w-[120px] justify-center" variant="secondary" onClick={() => setPendingCommission({ type: 'pay', item: commission })}>
                          Mark paid
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingCommission)}
        title={pendingCommission ? `${pendingCommission.type} commission` : ''}
        description={
          pendingCommission
            ? `${formatCurrency(Number(pendingCommission.item.commissionAmount))} will be ${pendingCommission.type === 'approve' ? 'approved' : 'marked paid'}.`
            : ''
        }
        confirmLabel={pendingCommission?.type === 'approve' ? 'Approve' : 'Mark paid'}
        onCancel={() => setPendingCommission(null)}
        onConfirm={() => void confirmCommission()}
      />
    </div>
  );
}

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { affiliatesApi } from '@/services/api/affiliates';
import { useNotificationStore } from '@/store/notification-store';
import { usePlatformStore } from '@/store/platform-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  AffiliateCommission,
  AffiliateProfile,
  AffiliateReferral,
  AffiliateTreeNode,
} from '@/types/affiliates';

function TreeNode({ node }: { node: AffiliateTreeNode }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-page p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-primary">{node.referralCode}</p>
            <p className="mt-1 text-sm text-secondary">Level {node.level}</p>
          </div>
          <StatusBadge value={node.status} />
        </div>
      </div>
      {node.children.length > 0 ? (
        <div className="ml-5 space-y-3 border-l border-border pl-4">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AffiliatesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pushNotification = useNotificationStore((state) => state.push);
  const platformStatus = usePlatformStore((state) => state.status);
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [tree, setTree] = useState<AffiliateTreeNode | null>(null);
  const [referralCodePrefix, setReferralCodePrefix] = useState('');
  const affiliateProgramEnabled =
    platformStatus?.features.affiliateProgramEnabled ?? true;
  const activeTab = searchParams.get('tab') ?? 'overview';

  async function refreshAffiliate() {
    const [me, referralItems, commissionItems, treeData] = await Promise.all([
      affiliatesApi.getMe().catch(() => null),
      affiliatesApi.getReferrals().catch(() => []),
      affiliatesApi.getCommissions().catch(() => []),
      affiliatesApi.getTree().catch(() => null),
    ]);

    setAffiliate(me);
    setReferrals(referralItems);
    setCommissions(commissionItems);
    setTree(treeData);
  }

  useEffect(() => {
    void refreshAffiliate();
  }, []);

  const totals = useMemo(() => {
    return commissions.reduce(
      (result, item) => {
        const amount = Number(item.commissionAmount);

        if (item.status === 'PENDING') {
          result.pending += amount;
        }

        if (item.status === 'APPROVED') {
          result.approved += amount;
        }

        if (item.status === 'PAID') {
          result.paid += amount;
        }

        return result;
      },
      { pending: 0, approved: 0, paid: 0 },
    );
  }, [commissions]);

  async function applyAffiliate() {
    if (!affiliateProgramEnabled) {
      pushNotification({
        title: 'Affiliate program unavailable',
        description:
          platformStatus?.maintenanceMessage ||
          'Affiliate applications are temporarily disabled.',
        type: 'error',
      });
      return;
    }

    try {
      await affiliatesApi.apply({
        referralCodePrefix: referralCodePrefix || undefined,
      });
      pushNotification({
        title: 'Affiliate profile created',
        description: 'Your referral code is active.',
        type: 'success',
      });
      await refreshAffiliate();
    } catch (error) {
      pushNotification({
        title: 'Affiliate application failed',
        description: error instanceof Error ? error.message : 'Application failed',
        type: 'error',
      });
    }
  }

  async function copyReferralLink() {
    if (!affiliate) {
      return;
    }

    await navigator.clipboard.writeText(
      `${window.location.origin}/register?ref=${affiliate.referralCode}`,
    );

    pushNotification({
      title: 'Referral link copied',
      description: 'The referral link is now in your clipboard.',
      type: 'success',
    });
  }

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliates"
        title="Partner Portal"
        description="Referral code management, downstream tree, referrals, and commission tracking."
        actions={
          <SegmentedControl
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'referrals', label: 'Referrals' },
              { value: 'commissions', label: 'Commissions' },
            ]}
            value={activeTab}
            onChange={setTab}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status" value={affiliate ? affiliate.referralCode : 'Not active'} helper={affiliate ? <StatusBadge value={affiliate.status} /> : 'Apply below to activate the affiliate profile.'} />
        <StatCard label="Pending" value={formatCurrency(totals.pending)} />
        <StatCard label="Approved" value={formatCurrency(totals.approved)} />
        <StatCard label="Paid" value={formatCurrency(totals.paid)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Affiliate Status" description="Application state and referral code controls.">
          {affiliate ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">Referral code</p>
                <p className="mt-2 text-2xl font-semibold text-primary">{affiliate.referralCode}</p>
                <div className="mt-4">
                  <StatusBadge value={affiliate.status} />
                </div>
              </div>
              <Button className="w-full justify-center" onClick={() => void copyReferralLink()}>
                Copy referral link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                label="Referral code prefix"
                value={referralCodePrefix}
                onChange={(event) => setReferralCodePrefix(event.target.value)}
                placeholder="Optional custom prefix"
              />
              {!affiliateProgramEnabled ? (
                <p className="text-sm text-warning">
                  {platformStatus?.maintenanceMessage ||
                    'Affiliate applications are temporarily disabled.'}
                </p>
              ) : null}
              <Button
                className="w-full justify-center"
                onClick={() => void applyAffiliate()}
                disabled={!affiliateProgramEnabled}
              >
                {affiliateProgramEnabled
                  ? 'Apply for affiliate status'
                  : 'Affiliate program disabled'}
              </Button>
            </div>
          )}
        </Panel>

        <Panel title="Hierarchy Summary" description="Three-level referral tree where available.">
          {tree ? (
            <TreeNode node={tree} />
          ) : (
            <p className="text-sm text-secondary">No hierarchy available yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Referrals" description="Users referred through your code.">
          <DataTable
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (entry) => entry.referredUser?.email ?? entry.referredUserId,
              },
              {
                key: 'joined',
                header: 'Joined',
                render: (entry) =>
                  entry.referredUser?.createdAt
                    ? formatDateTime(entry.referredUser.createdAt)
                    : formatDateTime(entry.createdAt),
              },
            ]}
            data={referrals}
            rowKey={(entry) => entry.id}
            emptyTitle="No referrals"
            emptyDescription="Users referred through your code will appear here."
          />
        </Panel>

        <Panel title="Commissions" description="Pending, approved, and paid commissions.">
          <DataTable
            columns={[
              { key: 'symbol', header: 'Symbol', render: (entry) => entry.symbol },
              { key: 'level', header: 'Level', render: (entry) => entry.level },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (entry) => formatCurrency(Number(entry.commissionAmount)),
              },
              {
                key: 'status',
                header: 'Status',
                render: (entry) => <StatusBadge value={entry.status} />,
              },
            ]}
            data={commissions}
            rowKey={(entry) => entry.id}
            emptyTitle="No commissions"
            emptyDescription="Commission records will appear here after referred trading activity."
          />
        </Panel>
      </div>
    </div>
  );
}

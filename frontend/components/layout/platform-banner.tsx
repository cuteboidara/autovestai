'use client';

import { useMemo } from 'react';

import { usePlatformStore } from '@/store/platform-store';

export function PlatformBanner() {
  const status = usePlatformStore((state) => state.status);

  const disabledFeatures = useMemo(() => {
    if (!status) {
      return [];
    }

    return [
      !status.features.tradingEnabled ? 'Trading disabled' : null,
      !status.features.registrationsEnabled ? 'Registrations closed' : null,
      !status.features.withdrawalsEnabled ? 'Withdrawals disabled' : null,
      !status.features.copyTradingEnabled ? 'Copy trading disabled' : null,
      !status.features.affiliateProgramEnabled ? 'Affiliate program disabled' : null,
      !status.features.affiliatePayoutsEnabled ? 'Affiliate payouts disabled' : null,
    ].filter((value): value is string => Boolean(value));
  }, [status]);

  if (!status || (!status.maintenanceModeEnabled && disabledFeatures.length === 0)) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-[1800px] px-4 py-3 text-sm text-amber-800 lg:px-6">
        <p className="font-medium text-amber-900">
          {status.maintenanceModeEnabled ? status.maintenanceMessage : 'Platform operating with temporary restrictions.'}
        </p>
        {disabledFeatures.length > 0 ? (
          <p className="mt-1 text-amber-700">{disabledFeatures.join(' • ')}</p>
        ) : null}
      </div>
    </div>
  );
}

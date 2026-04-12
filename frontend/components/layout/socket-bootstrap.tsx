'use client';

import { useEffect } from 'react';

import { socketManager } from '@/lib/socket-manager';
import { useAuthStore } from '@/store/auth-store';
import { useAdminStore } from '@/store/admin-store';
import { useMarketDataStore } from '@/store/market-data-store';
import { useNotificationStore } from '@/store/notification-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';
import { useWalletStore } from '@/store/wallet-store';
import { MarketQuote, CandleUpdatePayload } from '@/types/market-data';
import { AdminExposure, HedgeAction } from '@/types/admin';
import { PositionRecord, OrderRecord } from '@/types/trading';
import { WalletSnapshotResponse } from '@/types/wallet';

export function SocketBootstrap() {
  const token = useAuthStore((state) => state.token);
  const upsertQuote = useMarketDataStore((state) => state.upsertQuote);
  const upsertCandle = useMarketDataStore((state) => state.upsertCandle);
  const upsertOrder = useOrdersStore((state) => state.upsertOrder);
  const upsertPosition = usePositionsStore((state) => state.upsertPosition);
  const mergePositions = usePositionsStore((state) => state.mergePositions);
  const setSnapshot = useWalletStore((state) => state.setSnapshot);
  const pushNotification = useNotificationStore((state) => state.push);
  const upsertExposure = useAdminStore((state) => state.upsertExposure);
  const upsertHedgeAction = useAdminStore((state) => state.upsertHedgeAction);
  const setConnected = useAdminStore((state) => state.setWebsocketConnected);

  useEffect(() => {
    socketManager.connect(token);

    const dispose = [
      socketManager.on('connect', () => setConnected(true)),
      socketManager.on('disconnect', () => setConnected(false)),
      socketManager.on('price_update', (payload) => upsertQuote(payload as MarketQuote)),
      socketManager.on('candle_update', (payload) =>
        upsertCandle(payload as CandleUpdatePayload),
      ),
      socketManager.on('order_update', (payload) => upsertOrder(payload as OrderRecord)),
      socketManager.on('position_update', (payload) => {
        const data = payload as
          | { position?: PositionRecord; positions?: PositionRecord[]; type?: string }
          | undefined;

        if (!data) {
          return;
        }

        if (data.position) {
          upsertPosition(data.position);
        }

        if (data.positions) {
          mergePositions(data.positions);
        }

        if (data.type === 'liquidated') {
          pushNotification({
            title: 'Position liquidated',
            description: 'Stop-out threshold reached and the platform closed the position.',
            type: 'warning',
          });
        }
      }),
      socketManager.on('wallet_update', (payload) =>
        setSnapshot(payload as WalletSnapshotResponse),
      ),
      socketManager.on('liquidation_event', (payload) =>
        pushNotification({
          title: 'Liquidation event',
          description: `Position ${String((payload as { positionId?: string }).positionId ?? '')} was liquidated.`,
          type: 'warning',
        }),
      ),
      socketManager.on('exposure_update', (payload) =>
        upsertExposure(payload as AdminExposure),
      ),
      socketManager.on('hedge_action_created', (payload) => {
        upsertHedgeAction(payload as HedgeAction);
        pushNotification({
          title: 'Hedge suggestion created',
          description: `New hedge action for ${String((payload as { symbol?: string }).symbol ?? '')}.`,
          type: 'info',
        });
      }),
    ];

    return () => {
      dispose.forEach((unsubscribe) => unsubscribe());
      socketManager.disconnect();
    };
  }, [
    token,
    upsertQuote,
    upsertCandle,
    upsertOrder,
    upsertPosition,
    mergePositions,
    setSnapshot,
    pushNotification,
    upsertExposure,
    upsertHedgeAction,
    setConnected,
  ]);

  return null;
}

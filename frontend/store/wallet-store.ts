'use client';

import { create } from 'zustand';

import { WalletSnapshotResponse, WalletSummary, WalletTransaction } from '@/types/wallet';

interface WalletState {
  wallet: WalletSummary | null;
  transactions: WalletTransaction[];
  setSnapshot: (snapshot: WalletSnapshotResponse) => void;
  upsertTransaction: (transaction: WalletTransaction) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  transactions: [],
  setSnapshot(snapshot) {
    const transactions = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];

    set({
      wallet: snapshot.wallet,
      transactions,
    });
  },
  upsertTransaction(transaction) {
    set((state) => ({
      transactions: [
        transaction,
        ...(Array.isArray(state.transactions) ? state.transactions : []).filter(
          (entry) => entry.id !== transaction.id,
        ),
      ],
    }));
  },
}));

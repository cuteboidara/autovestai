import { TreasuryBalanceSnapshotSource } from '../dto/treasury-response.dto';

export interface TreasuryBalanceProviderInput {
  asset: string;
  network: string;
  walletAddress: string | null;
}

export interface TreasuryBalanceObservation {
  id: string;
  asset: string;
  network: string;
  walletAddress: string;
  balance: number;
  source: TreasuryBalanceSnapshotSource;
  sourceReference: string | null;
  observedAt: Date;
  createdByUserId: string | null;
  createdAt: Date;
  createdByUser: {
    id: string;
    email: string;
  } | null;
}

export interface TreasuryBalanceProvider {
  getObservedBalance(
    input: TreasuryBalanceProviderInput,
  ): Promise<TreasuryBalanceObservation | null>;
}

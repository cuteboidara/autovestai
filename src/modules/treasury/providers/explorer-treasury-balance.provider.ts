import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TRON_USDT_CONTRACT } from '../../wallet/wallet.constants';
import { normalizeTreasuryNetwork } from '../treasury.constants';
import {
  TreasuryBalanceObservation,
  TreasuryBalanceProvider,
  TreasuryBalanceProviderInput,
} from './treasury-balance-provider.interface';

interface TronAccountResponse {
  data?: Array<{
    trc20?: Array<Record<string, string>>;
  }>;
}

@Injectable()
export class ExplorerTreasuryBalanceProvider implements TreasuryBalanceProvider {
  constructor(private readonly configService: ConfigService) {}

  async getObservedBalance(
    input: TreasuryBalanceProviderInput,
  ): Promise<TreasuryBalanceObservation | null> {
    if (!input.walletAddress) {
      return null;
    }

    if (normalizeTreasuryNetwork(input.network) !== 'TRC20') {
      return null;
    }

    return this.fetchTronUsdtBalance(input.walletAddress, input.asset);
  }

  private async fetchTronUsdtBalance(
    walletAddress: string,
    asset: string,
  ): Promise<TreasuryBalanceObservation> {
    const tronApiUrl =
      this.configService.get<string>('wallet.tronApiUrl') ?? 'https://api.trongrid.io';
    const tronApiKey = this.configService.get<string>('wallet.trongridApiKey') ?? '';
    const response = await this.fetchJson<TronAccountResponse>(
      `${tronApiUrl.replace(/\/$/, '')}/v1/accounts/${walletAddress}`,
      tronApiKey
        ? {
            headers: {
              'TRON-PRO-API-KEY': tronApiKey,
            },
          }
        : undefined,
    );
    const trc20Balances = response.data?.[0]?.trc20 ?? [];
    const contractKey = trc20Balances
      .flatMap((entry) => Object.keys(entry))
      .find((key) => key.toLowerCase() === TRON_USDT_CONTRACT.toLowerCase());
    const rawBalance =
      trc20Balances.find((entry) => contractKey && contractKey in entry)?.[contractKey ?? ''] ??
      '0';
    const amount = Number(rawBalance) / 1_000_000;

    return {
      id: `api:${walletAddress}:${Date.now()}`,
      asset,
      network: 'TRC20',
      walletAddress,
      balance: Number.isFinite(amount) ? amount : 0,
      source: 'api',
      sourceReference: 'trongrid',
      observedAt: new Date(),
      createdByUserId: null,
      createdAt: new Date(),
      createdByUser: null,
    };
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(`Treasury explorer lookup failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}

import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { WalletService } from '../src/modules/wallet/wallet.service';

describe('WalletService', () => {
  function createService(options?: { approved?: boolean }) {
    return new WalletService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        areWithdrawalsEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {} as never,
      {} as never,
      {
        assertPlatformAccessApproved: options?.approved
          ? jest.fn().mockResolvedValue(undefined)
          : jest
              .fn()
              .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        requestWithdrawal: options?.approved
          ? jest.fn().mockResolvedValue({
              transaction: {
                id: 'tx-1',
              },
            })
          : jest
              .fn()
              .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
        approveWithdrawal: jest.fn(),
        rejectWithdrawal: jest.fn(),
      } as never,
      {} as never,
    );
  }

  it('rejects non-USDT deposit requests', async () => {
    const service = createService({ approved: true });

    await expect(
      service.requestDeposit('user-1', {
        amount: 100,
        asset: 'BTC',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-USDT withdrawal requests', async () => {
    const service = createService({ approved: true });

    await expect(
      service.requestWithdrawal('user-1', {
        amount: 100,
        asset: 'ETH',
        address: '0xabc',
        network: 'USDT-ERC20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects wallet deposit requests for users without approved KYC', async () => {
    const service = createService();

    await expect(
      service.requestDeposit('user-1', {
        amount: 100,
        asset: 'USDT',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });

  it('requires an on-chain transaction hash for deposit requests', async () => {
    const service = createService({ approved: true });

    await expect(
      service.requestDeposit('user-1', {
        amount: 100,
        asset: 'USDT',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(
      'Deposit requests require an on-chain transaction hash and remain pending until manual approval',
    );
  });

  it('rejects wallet withdrawal requests for users without approved KYC', async () => {
    const service = createService();

    await expect(
      service.requestWithdrawal('user-1', {
        amount: 100,
        asset: 'USDT',
        address: 'TTEST123',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });

  it('routes linked withdrawal approvals through the withdrawal workflow', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      rejectWithdrawal: jest.fn(),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.PENDING,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.APPROVED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      });
    const service = new WalletService(
      {
        transaction: {
          findUnique: transactionFindUnique,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      withdrawalsService as never,
      {} as never,
    );

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.APPROVED,
        amount: 100,
      }),
    );

    expect(withdrawalsService.approveWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'approved',
    );
    expect(withdrawalsService.rejectWithdrawal).not.toHaveBeenCalled();
  });

  it('routes linked withdrawal rejections through the withdrawal workflow', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn(),
      rejectWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.PENDING,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.REJECTED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      });
    const service = new WalletService(
      {
        transaction: {
          findUnique: transactionFindUnique,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      withdrawalsService as never,
      {} as never,
    );

    await expect(service.decideTransaction('tx-1', 'admin-1', false)).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.REJECTED,
        amount: 100,
      }),
    );

    expect(withdrawalsService.rejectWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'Rejected by admin',
    );
    expect(withdrawalsService.approveWithdrawal).not.toHaveBeenCalled();
  });

  it('allows generic rejection of already approved linked withdrawals', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn(),
      rejectWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.APPROVED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.REJECTED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:10:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:10:00.000Z'),
      });
    const service = new WalletService(
      {
        transaction: {
          findUnique: transactionFindUnique,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      withdrawalsService as never,
      {} as never,
    );

    await expect(service.decideTransaction('tx-1', 'admin-1', false)).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.REJECTED,
      }),
    );

    expect(withdrawalsService.rejectWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'Rejected by admin',
    );
  });

  it('rejects deposit approval when no matching on-chain deposit has been detected', async () => {
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.PENDING,
        reference: '0xdeposit',
        metadata: {
          network: 'ERC20',
          transactionHash: '0xdeposit',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.PENDING,
        reference: '0xdeposit',
        metadata: {
          network: 'ERC20',
          transactionHash: '0xdeposit',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      });
    const service = new WalletService(
      {
        transaction: {
          findUnique: transactionFindUnique,
        },
        $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
          callback({
            transaction: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'tx-1',
                userId: 'user-1',
                walletId: 'wallet-1',
                accountId: 'account-1',
                type: TransactionType.DEPOSIT,
                amount: new Prisma.Decimal(100),
                asset: 'USDT',
                status: TransactionStatus.PENDING,
                reference: '0xdeposit',
                metadata: {
                  network: 'ERC20',
                  transactionHash: '0xdeposit',
                },
                approvedById: null,
                approvedAt: null,
                createdAt: new Date('2026-04-12T10:00:00.000Z'),
                updatedAt: new Date('2026-04-12T10:00:00.000Z'),
              }),
            },
            deposit: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          }),
        ),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        requestWithdrawal: jest.fn(),
        approveWithdrawal: jest.fn(),
        rejectWithdrawal: jest.fn(),
      } as never,
      {} as never,
    );

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).rejects.toThrow(
      'Deposit must be detected on-chain before it can be approved',
    );
  });
});

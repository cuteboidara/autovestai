import { BadRequestException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';

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
    const service = new WalletService(
      {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'tx-1',
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.PENDING,
            metadata: {
              network: 'TRC20',
              withdrawalRequestId: 'withdrawal-1',
            },
          }),
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

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).resolves.toEqual({
      id: 'withdrawal-1',
    });

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
    const service = new WalletService(
      {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'tx-1',
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.PENDING,
            metadata: {
              network: 'TRC20',
              withdrawalRequestId: 'withdrawal-1',
            },
          }),
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

    await expect(service.decideTransaction('tx-1', 'admin-1', false)).resolves.toEqual({
      id: 'withdrawal-1',
    });

    expect(withdrawalsService.rejectWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'Rejected by admin',
    );
    expect(withdrawalsService.approveWithdrawal).not.toHaveBeenCalled();
  });
});

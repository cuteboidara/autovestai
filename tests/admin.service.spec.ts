import { TransactionType, UserRole } from '@prisma/client';

import { AdminService } from '../src/modules/admin/admin.service';

describe('AdminService', () => {
  it('enforces payout policy before approving a transaction', async () => {
    const walletService = {
      decideTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    };
    const adminPolicyService = {
      assertWalletTransactionAction: jest.fn(),
    };
    const service = new AdminService(
      {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'tx-1',
            type: TransactionType.WITHDRAW,
          }),
        },
      } as never,
      {} as never,
      {} as never,
      walletService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      adminPolicyService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.approveTransaction(
      'tx-1',
      {
        id: 'admin-1',
        email: 'ops@example.com',
        role: UserRole.ADMIN,
        permissions: ['wallet.payout'],
        adminRoles: [],
      },
      'approved',
    );

    expect(adminPolicyService.assertWalletTransactionAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1' }),
      TransactionType.WITHDRAW,
      true,
    );
    expect(walletService.decideTransaction).toHaveBeenCalledWith(
      'tx-1',
      'admin-1',
      true,
      'approved',
    );
  });

  it('returns masked admin session data without secret fields', async () => {
    const prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          wallet: null,
          accounts: [],
          positions: [],
          orders: [],
          transactions: [],
          affiliate: null,
          signalProvider: null,
          kycSubmission: null,
          createdAt: new Date('2026-04-05T10:00:00.000Z'),
          sessions: [
            {
              id: 'session-1',
              deviceFingerprint: 'abc123456789wxyz',
              ipAddress: '10.1.2.3',
              userAgent: 'Mozilla/5.0',
              lastSeenAt: new Date('2026-04-05T11:00:00.000Z'),
              expiresAt: new Date('2026-04-12T11:00:00.000Z'),
              revokedAt: null,
              createdAt: new Date('2026-04-05T09:00:00.000Z'),
            },
          ],
        }),
      },
    };
    const service = new AdminService(
      prismaService as never,
      {} as never,
      {
        getAccountMetrics: jest.fn(),
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
    );

    const detail = await service.getUserDetail('user-1');

    expect(prismaService.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sessions: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              deviceFingerprint: true,
              ipAddress: true,
              userAgent: true,
              lastSeenAt: true,
              expiresAt: true,
              revokedAt: true,
              createdAt: true,
            }),
          }),
        }),
      }),
    );
    expect(detail?.sessions?.[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        deviceFingerprintMasked: 'abc123...wxyz',
        ipAddressMasked: '10.1.2.x',
      }),
    );
    expect(detail?.sessions?.[0]).not.toHaveProperty('deviceFingerprint');
    expect(detail?.sessions?.[0]).not.toHaveProperty('refreshTokenHash');
  });
});

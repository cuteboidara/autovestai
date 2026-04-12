import { UserRole } from '@prisma/client';

import { UsersService } from '../src/modules/users/users.service';

describe('UsersService', () => {
  it('creates a normalized user with a default wallet and live account', async () => {
    const createdUser = {
      id: 'user-1',
      email: 'emmadara229@gmail.com',
      accountNumber: 'AV000001',
      password: 'hashed-password',
      role: UserRole.USER,
    };
    const prismaService = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdUser),
      },
      account: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new UsersService(
      prismaService as never,
      {
        getCurrentAdminProfile: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
      } as never,
      {
        log: jest.fn(),
      } as never,
    );

    const result = await service.createUser({
      email: 'Emmadara229@gmail.com',
      password: 'hashed-password',
    });

    expect(prismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'emmadara229@gmail.com',
        accountNumber: 'AV000001',
        password: 'hashed-password',
        role: UserRole.USER,
        wallet: {
          create: expect.any(Object),
        },
        accounts: {
          create: expect.objectContaining({
            type: 'LIVE',
            name: 'Live Account #1',
          }),
        },
      }),
    });
    expect(result).toEqual(createdUser);
  });

  it('returns the current admin profile when one exists', async () => {
    const adminProfile = {
      id: 'admin-1',
      email: 'ops@example.com',
      role: UserRole.ADMIN,
      adminRole: 'SUPER_ADMIN',
      permissions: ['users.manage'],
      adminRoles: [{ id: 'admin-1', name: 'super_admin' }],
    };
    const service = new UsersService(
      {
        user: {
          findUnique: jest.fn(),
        },
      } as never,
      {
        getCurrentAdminProfile: jest.fn().mockResolvedValue(adminProfile),
        findById: jest.fn().mockResolvedValue(null),
      } as never,
      {
        log: jest.fn(),
      } as never,
    );

    await expect(service.getCurrentUserProfile('admin-1')).resolves.toEqual(adminProfile);
  });

  it('falls back to the persisted user profile for non-admin users', async () => {
    const createdAt = new Date('2026-04-10T10:00:00.000Z');
    const updatedAt = new Date('2026-04-10T12:00:00.000Z');
    const service = new UsersService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'trader@example.com',
            accountNumber: 'AV000123',
            role: UserRole.USER,
            wallet: {
              balance: 0,
            },
            accounts: [
              {
                balance: 2500,
              },
            ],
            affiliate: null,
            copyMaster: null,
            signalProvider: null,
            kycSubmission: null,
            createdAt,
            updatedAt,
          }),
        },
      } as never,
      {
        getCurrentAdminProfile: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
      } as never,
      {
        log: jest.fn(),
      } as never,
    );

    await expect(service.getCurrentUserProfile('user-1')).resolves.toMatchObject({
      id: 'user-1',
      email: 'trader@example.com',
      accountNumber: 'AV000123',
      role: UserRole.USER,
      wallet: {
        balance: 2500,
      },
      permissions: [],
      adminRoles: [],
      kyc: {
        status: 'NOT_SUBMITTED',
      },
      createdAt,
      updatedAt,
    });
  });
});

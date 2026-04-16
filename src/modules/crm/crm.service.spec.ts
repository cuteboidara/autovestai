import { KycStatus } from '@prisma/client';

import { CrmService } from './crm.service';

describe('CrmService', () => {
  function createService() {
    const prismaService = {
      emailSenderConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      emailLog: {
        create: jest.fn(),
      },
    };
    const configService = {
      get: jest.fn(() => 'local-dev-secret'),
    };

    return {
      prismaService,
      configService,
      service: new CrmService(prismaService as never, configService as never),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the resolved user name in KYC decision emails instead of the account number', async () => {
    const { service, prismaService } = createService();
    const sendMail = jest.fn().mockResolvedValue(undefined);

    prismaService.emailSenderConfig.findFirst.mockResolvedValue({
      id: 'sender-1',
      name: 'AutovestAI',
      fromEmail: 'noreply@autovestai.test',
      smtpHost: 'smtp.test',
      smtpPort: 587,
      smtpUser: 'smtp-user',
      smtpPass: 'encrypted-secret',
      isDefault: true,
      isActive: true,
      createdAt: new Date('2026-04-16T00:00:00.000Z'),
      updatedAt: new Date('2026-04-16T00:00:00.000Z'),
    });
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'john@example.com',
      accountNumber: '410200841',
      kycSubmission: {
        fullName: 'John Doe',
      },
    });
    prismaService.emailLog.create.mockResolvedValue({
      id: 'log-1',
    });
    jest.spyOn(service as any, 'createTransport').mockReturnValue({
      sendMail,
    });

    await service.sendKycDecisionEmail({
      userId: 'user-1',
      adminId: 'admin-1',
      status: KycStatus.APPROVED,
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@example.com',
        html: expect.stringContaining('Hello John Doe,'),
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.not.stringContaining('Hello 410200841,'),
      }),
    );
    expect(prismaService.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining('Hello John Doe,'),
        }),
      }),
    );
  });
});

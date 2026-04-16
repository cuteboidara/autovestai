jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue(undefined),
}));

import * as sgMail from '@sendgrid/mail';

import { EmailService } from './email.service';

describe('EmailService', () => {
  function createService() {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'email.sendgridApiKey') {
          return 'test-sendgrid-key';
        }

        if (key === 'email.sendgridFromEmail') {
          return 'noreply@autovestai.test';
        }

        return undefined;
      }),
    };
    const prismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    return {
      configService,
      prismaService,
      service: new EmailService(configService as never, prismaService as never),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds template payloads with both recipient name and account metadata', () => {
    const { service } = createService();

    const variables = (service as any).buildTemplateVariables(
      {
        email: 'john@example.com',
        accountNumber: '410200841',
        kycSubmission: {
          fullName: 'John Doe',
        },
      },
      {
        amount: '100.00',
      },
    );

    expect(variables).toEqual({
      amount: '100.00',
      accountNumber: '410200841',
      recipientName: 'John Doe',
    });
  });

  it('renders transactional greetings with the resolved human name', async () => {
    const { service, prismaService } = createService();
    prismaService.user.findUnique.mockResolvedValue({
      email: 'john@example.com',
      accountNumber: '410200841',
      kycSubmission: {
        fullName: 'John Doe',
      },
    });

    await service.sendWelcome('user-1', 'https://example.com/verify');

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@example.com',
        subject: 'Welcome to AutovestAI',
        html: expect.stringContaining('Hello John Doe,'),
      }),
    );
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.not.stringContaining('Hello 410200841,'),
      }),
    );
  });

  it('falls back to the email local part when no name data exists', async () => {
    const { service, prismaService } = createService();
    prismaService.user.findUnique.mockResolvedValue({
      email: 'terminal.user@example.com',
      accountNumber: '410200841',
      kycSubmission: null,
    });

    await service.sendEmailVerified('user-2');

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'terminal.user@example.com',
        subject: 'Email Verified — AutovestAI',
        html: expect.stringContaining('Hello terminal.user,'),
      }),
    );
  });
});

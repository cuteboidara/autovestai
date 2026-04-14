import { BadRequestException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { KycService } from '../src/modules/kyc/kyc.service';

describe('KycService', () => {
  it('approves a pending KYC submission', async () => {
    const prismaService = {
      kycSubmission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'user-1',
          status: KycStatus.PENDING,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'user-1',
          status: KycStatus.APPROVED,
        }),
      },
      kycDecisionLog: {
        create: jest.fn(),
      },
    };
    const service = new KycService(
      prismaService as never,
      {
        log: jest.fn(),
      } as never,
      {
        sendKycDecisionEmail: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        sendKycSubmitted: jest.fn().mockResolvedValue(undefined),
        sendKycApproved: jest.fn().mockResolvedValue(undefined),
        sendKycRejected: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
    );

    const result = await service.approve('kyc-1', 'admin-1');

    expect(result.status).toBe(KycStatus.APPROVED);
  });

  it('requires a reason when rejecting KYC', async () => {
    const service = new KycService(
      {
        kycSubmission: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        kycDecisionLog: {
          create: jest.fn(),
        },
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        sendKycDecisionEmail: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        sendKycSubmitted: jest.fn().mockResolvedValue(undefined),
        sendKycApproved: jest.fn().mockResolvedValue(undefined),
        sendKycRejected: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
    );

    await expect(service.reject('kyc-1', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows rejected users to resubmit KYC', async () => {
    const prismaService = {
      kycSubmission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'user-1',
          status: KycStatus.REJECTED,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          userId: 'user-1',
          status: KycStatus.PENDING,
          fullName: 'Jane Doe',
          documentType: 'Passport',
          country: 'TR',
        }),
      },
      kycDecisionLog: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          accountNumber: 'AV000001',
          email: 'jane@example.com',
        }),
      },
    };
    const service = new KycService(
      prismaService as never,
      {
        log: jest.fn(),
      } as never,
      {
        sendKycDecisionEmail: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        sendKycSubmitted: jest.fn().mockResolvedValue(undefined),
        sendKycApproved: jest.fn().mockResolvedValue(undefined),
        sendKycRejected: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
    );

    const result = await service.submit('user-1', {
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      country: 'TR',
      addressLine1: 'Istiklal Cd 1',
      city: 'Istanbul',
      postalCode: '34000',
      documentType: 'Passport',
      documentNumber: 'P123456',
      documentFrontUrl: 'front',
      documentBackUrl: 'back',
      selfieUrl: 'selfie',
    });

    expect(prismaService.kycSubmission.update).toHaveBeenCalled();
    expect(result.status).toBe(KycStatus.PENDING);
  });

  it('blocks platform access when KYC is not approved', async () => {
    const service = new KycService(
      {
        kycSubmission: {
          findUnique: jest.fn().mockResolvedValue({
            status: KycStatus.PENDING,
          }),
        },
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        sendKycDecisionEmail: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        sendKycSubmitted: jest.fn().mockResolvedValue(undefined),
        sendKycApproved: jest.fn().mockResolvedValue(undefined),
        sendKycRejected: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        postSystemAlert: jest.fn(),
      } as never,
    );

    await expect(
      service.assertPlatformAccessApproved('user-1'),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });
});

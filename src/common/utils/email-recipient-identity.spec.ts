import {
  formatUserDisplayNameWithAccount,
  getUserDisplayName,
} from './email-recipient-identity';

describe('email recipient identity helpers', () => {
  it('prefers a full name over account metadata', () => {
    expect(
      getUserDisplayName({
        fullName: 'John Doe',
        email: 'john@example.com',
        accountNumber: '410200841',
      }),
    ).toBe('John Doe');
  });

  it('uses kyc full name before falling back to other identifiers', () => {
    expect(
      getUserDisplayName({
        email: 'john@example.com',
        accountNumber: '410200841',
        kycSubmission: {
          fullName: 'John Kyc Doe',
        },
      }),
    ).toBe('John Kyc Doe');
  });

  it('uses first and last name when full name is unavailable', () => {
    expect(
      getUserDisplayName({
        firstName: 'Jane',
        lastName: 'Trader',
        accountNumber: '410200841',
      }),
    ).toBe('Jane Trader');
  });

  it('uses username when that is the best available human identity', () => {
    expect(
      getUserDisplayName({
        username: 'live_trader',
        accountNumber: '410200841',
      }),
    ).toBe('live_trader');
  });

  it('falls back to the email local part and never to account number', () => {
    expect(
      getUserDisplayName({
        email: 'desk.user@example.com',
        accountNumber: '410200841',
      }),
    ).toBe('desk.user');
    expect(
      getUserDisplayName({
        accountNumber: '410200841',
      }),
    ).toBe('Client');
  });

  it('formats name with account metadata only when explicitly requested', () => {
    expect(
      formatUserDisplayNameWithAccount({
        fullName: 'John Doe',
        accountNumber: '410200841',
      }),
    ).toBe('John Doe (Account 410200841)');
  });
});

type MaybeString = string | null | undefined;

export type EmailIdentitySource = {
  email?: MaybeString;
  fullName?: MaybeString;
  firstName?: MaybeString;
  lastName?: MaybeString;
  displayName?: MaybeString;
  username?: MaybeString;
  accountNumber?: MaybeString;
  accountNo?: MaybeString;
  kycSubmission?: {
    fullName?: MaybeString;
  } | null;
};

const cleanString = (value: MaybeString): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const joinNameParts = (firstName: MaybeString, lastName: MaybeString): string | null => {
  const parts = [cleanString(firstName), cleanString(lastName)].filter(
    (part): part is string => part !== null,
  );

  return parts.length > 0 ? parts.join(' ') : null;
};

const getEmailLocalIdentity = (email: MaybeString): string | null => {
  const normalizedEmail = cleanString(email);
  if (!normalizedEmail) {
    return null;
  }

  const [localPart] = normalizedEmail.split('@');
  return cleanString(localPart);
};

export function getUserDisplayName(user?: EmailIdentitySource | null): string {
  const candidates = [
    cleanString(user?.fullName),
    cleanString(user?.kycSubmission?.fullName),
    joinNameParts(user?.firstName, user?.lastName),
    cleanString(user?.displayName),
    cleanString(user?.username),
    getEmailLocalIdentity(user?.email),
  ];

  return candidates.find((candidate): candidate is string => candidate !== null) ?? 'Client';
}

export function getUserAccountReference(
  user?: EmailIdentitySource | null,
  account?: Pick<EmailIdentitySource, 'accountNumber' | 'accountNo'> | null,
): string | null {
  return (
    cleanString(account?.accountNumber) ??
    cleanString(account?.accountNo) ??
    cleanString(user?.accountNumber) ??
    cleanString(user?.accountNo)
  );
}

export function formatUserDisplayNameWithAccount(
  user?: EmailIdentitySource | null,
  account?: Pick<EmailIdentitySource, 'accountNumber' | 'accountNo'> | null,
): string {
  const displayName = getUserDisplayName(user);
  const accountReference = getUserAccountReference(user, account);

  return accountReference ? `${displayName} (Account ${accountReference})` : displayName;
}

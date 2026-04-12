# KYC Ops Runbook

## Review Queue

1. Open `/admin/kyc`.
2. Sort by oldest pending first.
3. Check:
   - full legal name,
   - DOB,
   - country,
   - address,
   - document type/number,
   - document placeholders / references.

## Approve

1. Confirm data is complete and internally acceptable.
2. Approve.
3. Confirm audit entry exists.
4. Spot-check that withdrawal gating is now satisfied for the user.

## Reject

1. Reject only with a specific reason.
2. Record the reason clearly enough for support/compliance follow-up.
3. Confirm audit entry exists.

## Escalate

Escalate instead of deciding immediately if:

- account is already funding heavily,
- device/IP overlap alerts exist,
- user is linked to affiliate or copy-trading abuse alerts,
- submitted identity data conflicts with prior records.

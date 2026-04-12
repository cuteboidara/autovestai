'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, ShieldCheck } from 'lucide-react';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { env } from '@/lib/env';
import { getUserKycStatus } from '@/lib/kyc-access';
import { formatDateTime } from '@/lib/utils';
import { kycApi } from '@/services/api/kyc';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { KycSubmission } from '@/types/kyc';

const initialForm = {
  fullName: '',
  dateOfBirth: '',
  country: '',
  addressLine1: '',
  city: '',
  postalCode: '',
  documentType: '',
  documentNumber: '',
  documentFrontUrl: '',
  documentBackUrl: '',
  selfieUrl: '',
  proofOfAddressUrl: '',
};

function populateForm(submission: KycSubmission) {
  return {
    fullName: submission.fullName ?? '',
    dateOfBirth: submission.dateOfBirth ?? '',
    country: submission.country ?? '',
    addressLine1: submission.addressLine1 ?? '',
    city: submission.city ?? '',
    postalCode: submission.postalCode ?? '',
    documentType: submission.documentType ?? '',
    documentNumber: submission.documentNumber ?? '',
    documentFrontUrl: submission.documentFrontUrl ?? '',
    documentBackUrl: submission.documentBackUrl ?? '',
    selfieUrl: submission.selfieUrl ?? '',
    proofOfAddressUrl: submission.proofOfAddressUrl ?? '',
  };
}

function resolveDocumentUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${env.apiUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

export default function KycPage() {
  const authUser = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const logout = useAuthStore((state) => state.logout);
  const pushNotification = useNotificationStore((state) => state.push);
  const [kyc, setKyc] = useState<KycSubmission>({
    status: getUserKycStatus(authUser),
    rejectionReason: authUser?.kyc?.rejectionReason ?? null,
  });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<keyof typeof initialForm | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [profile, submission] = await Promise.all([
          refreshUser(),
          kycApi.getMine().catch(() => ({ status: 'NOT_SUBMITTED' as const })),
        ]);

        if (!active) {
          return;
        }

        const resolvedSubmission =
          submission.status === 'NOT_SUBMITTED' && profile?.kyc
            ? {
                status: getUserKycStatus(profile),
                rejectionReason: profile.kyc.rejectionReason ?? null,
              }
            : submission;

        setKyc(resolvedSubmission);

        if (resolvedSubmission.status !== 'NOT_SUBMITTED') {
          setForm(populateForm(resolvedSubmission));
        }
      } catch (error) {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load KYC state',
          description: error instanceof Error ? error.message : 'KYC state could not be loaded',
          type: 'error',
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [pushNotification, refreshUser]);

  async function submitKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await kycApi.submit(form);
      setKyc(response);
      await refreshUser();
      pushNotification({
        title: 'KYC submitted',
        description: 'Your submission is now pending manual review.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'KYC submission failed',
        description: error instanceof Error ? error.message : 'Submission failed',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = kyc.status === 'PENDING';
  const isRejected = kyc.status === 'REJECTED';
  const canSubmit = kyc.status === 'NOT_SUBMITTED' || isRejected;

  async function uploadDocument(
    kind: 'DOCUMENT_FRONT' | 'DOCUMENT_BACK' | 'SELFIE' | 'PROOF_OF_ADDRESS',
    field: keyof typeof initialForm,
    file: File | null | undefined,
  ) {
    if (!file) {
      return;
    }

    setUploadingField(field);

    try {
      const response = await kycApi.upload(file, kind);
      setForm((current) => ({
        ...current,
        [field]: response.url,
      }));
      pushNotification({
        title: 'Document uploaded',
        description: `${file.name} is ready for KYC submission.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Document upload failed',
        description: error instanceof Error ? error.message : 'Upload failed',
        type: 'error',
      });
    } finally {
      setUploadingField(null);
    }
  }

  return (
    <ProtectedRoute allowUnapprovedKyc>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(240,180,41,0.18),_transparent_42%),linear-gradient(180deg,_#0B1220_0%,_#111827_42%,_#F5F7FB_42%,_#F5F7FB_100%)] px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/6 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur">
            <p className="label-eyebrow text-amber-300">Required Onboarding</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Compliance approval is required before platform access.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              Trading, wallet activity, and live account access stay locked until your KYC
              review is approved by operations.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Current Status
                    </p>
                    <p className="mt-2 text-lg font-medium">Identity verification</p>
                  </div>
                  <StatusBadge value={kyc.status} />
                </div>
                {isPending ? (
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    Your submission is in review. Platform access stays disabled until
                    compliance changes the status to approved.
                  </p>
                ) : null}
                {isRejected ? (
                  <p className="mt-4 text-sm leading-6 text-rose-200">
                    {kyc.rejectionReason ?? 'The last submission was rejected. Review the details and resubmit.'}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <ShieldCheck className="h-5 w-5 text-amber-300" />
                  <p className="mt-4 text-sm font-medium">Restricted until approved</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Dashboard, terminal, wallet, and account pages stay blocked.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <Clock3 className="h-5 w-5 text-amber-300" />
                  <p className="mt-4 text-sm font-medium">Manual review flow</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Operations review submissions manually before account activation.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <CheckCircle2 className="h-5 w-5 text-amber-300" />
                  <p className="mt-4 text-sm font-medium">Next step after approval</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Approved users are redirected directly into the dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void logout()}>
                Log out
              </Button>
              <p className="self-center text-xs text-slate-400">
                Need to change account details? Contact compliance before resubmitting.
              </p>
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-surface p-8 shadow-shell">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">KYC Checkpoint</p>
                <h2 className="mt-3 text-3xl font-semibold text-primary">
                  {isPending
                    ? 'Review in progress'
                    : isRejected
                      ? 'Resubmit your compliance pack'
                      : 'Submit your KYC application'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                  {isPending
                    ? 'Your account remains locked while compliance reviews the submitted information.'
                    : isRejected
                      ? 'Update the rejected fields and submit again to restart compliance review.'
                      : 'Complete the required identity details to unlock the client platform.'}
                </p>
              </div>
              <StatusBadge value={kyc.status} />
            </div>

            {loading ? (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-5 text-sm text-secondary">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading compliance state...
              </div>
            ) : null}

            {!loading && isPending ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  Manual review is active. Trading and wallet access will remain disabled until
                  your KYC status changes to approved.
                </div>
                <dl className="grid gap-4 rounded-2xl border border-border bg-page p-5 text-sm text-secondary sm:grid-cols-2">
                  <div>
                    <dt className="label-eyebrow">Submitted by</dt>
                    <dd className="mt-2 text-primary">{authUser?.email ?? '--'}</dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow">Submitted at</dt>
                    <dd className="mt-2 text-primary">
                      {kyc.createdAt ? formatDateTime(kyc.createdAt) : '--'}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow">Reviewed at</dt>
                    <dd className="mt-2 text-primary">
                      {kyc.reviewedAt ? formatDateTime(kyc.reviewedAt) : 'Waiting for review'}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow">Platform access</dt>
                    <dd className="mt-2 text-primary">Locked pending approval</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {!loading && isRejected ? (
              <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Previous submission rejected</p>
                    <p className="mt-1 leading-6">
                      {kyc.rejectionReason ??
                        'Compliance rejected the previous submission. Update the details below and resubmit.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && canSubmit ? (
              <form className="mt-8 grid gap-4 lg:grid-cols-2" onSubmit={submitKyc}>
                <Input
                  label="Full name"
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Date of birth"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                  }
                  placeholder="YYYY-MM-DD"
                  required
                />
                <Input
                  label="Country"
                  value={form.country}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, country: event.target.value }))
                  }
                  required
                />
                <Input
                  label="City"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, city: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Address"
                  value={form.addressLine1}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, addressLine1: event.target.value }))
                  }
                  className="md:col-span-2"
                  required
                />
                <Input
                  label="Postal code"
                  value={form.postalCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, postalCode: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Document type"
                  value={form.documentType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, documentType: event.target.value }))
                  }
                  placeholder="Passport / ID card"
                  required
                />
                <Input
                  label="Document number"
                  value={form.documentNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, documentNumber: event.target.value }))
                  }
                  required
                />
                {[
                  {
                    label: 'ID document front',
                    field: 'documentFrontUrl',
                    kind: 'DOCUMENT_FRONT',
                    required: true,
                  },
                  {
                    label: 'ID document back',
                    field: 'documentBackUrl',
                    kind: 'DOCUMENT_BACK',
                    required: false,
                  },
                  {
                    label: 'Selfie',
                    field: 'selfieUrl',
                    kind: 'SELFIE',
                    required: true,
                  },
                  {
                    label: 'Proof of address',
                    field: 'proofOfAddressUrl',
                    kind: 'PROOF_OF_ADDRESS',
                    required: true,
                  },
                ].map((uploadField) => {
                  const url = form[uploadField.field as keyof typeof initialForm];
                  const resolvedUrl = resolveDocumentUrl(url);
                  const isUploading = uploadingField === uploadField.field;

                  return (
                    <label
                      key={uploadField.field}
                      className={`block space-y-2 ${uploadField.field === 'selfieUrl' || uploadField.field === 'proofOfAddressUrl' ? 'md:col-span-2' : ''}`}
                    >
                      <span className="label-eyebrow">
                        {uploadField.label}
                        {uploadField.required ? ' *' : ''}
                      </span>
                      <div className="rounded-2xl border border-border bg-page p-4">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(event) =>
                            void uploadDocument(
                              uploadField.kind as
                                | 'DOCUMENT_FRONT'
                                | 'DOCUMENT_BACK'
                                | 'SELFIE'
                                | 'PROOF_OF_ADDRESS',
                              uploadField.field as keyof typeof initialForm,
                              event.target.files?.[0],
                            )
                          }
                        />
                        <div className="mt-3 text-sm text-secondary">
                          {isUploading ? 'Uploading document...' : url ? 'Document uploaded and attached.' : 'Upload an image or PDF file.'}
                        </div>
                        {resolvedUrl ? (
                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-sm font-medium text-accent hover:underline"
                          >
                            View uploaded document
                          </a>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    className="justify-center"
                    disabled={
                      submitting ||
                      !form.documentFrontUrl ||
                      !form.selfieUrl ||
                      !form.proofOfAddressUrl
                    }
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : isRejected ? (
                      'Resubmit KYC'
                    ) : (
                      'Submit KYC Application'
                    )}
                  </Button>
                  <p className="text-xs leading-5 text-muted">
                    Upload front ID, selfie, and proof-of-address files before submitting. Only approved KYC accounts can access the client platform.
                  </p>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

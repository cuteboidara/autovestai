'use client';

import { ReactNode } from 'react';

import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'primary',
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/30 p-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[1.75rem] border border-border bg-surface p-4 shadow-shell sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
        <p className="mt-2 text-sm text-secondary">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="w-full sm:w-auto"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

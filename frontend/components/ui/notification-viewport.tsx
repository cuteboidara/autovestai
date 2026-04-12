'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification-store';

const toneStyles = {
  success: 'border-emerald-200 bg-white text-primary',
  error: 'border-rose-200 bg-white text-primary',
  info: 'border-sky-200 bg-white text-primary',
  warning: 'border-amber-200 bg-white text-primary',
};

export function NotificationViewport() {
  const items = useNotificationStore((state) => state.items);
  const remove = useNotificationStore((state) => state.remove);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto rounded-2xl border p-4 shadow-shell',
            toneStyles[item.type],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-sm text-secondary">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="rounded-full p-1 text-secondary transition hover:bg-page hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

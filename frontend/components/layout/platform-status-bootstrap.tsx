'use client';

import { useEffect } from 'react';

import { platformApi } from '@/services/api/platform';
import { usePlatformStore } from '@/store/platform-store';

export function PlatformStatusBootstrap() {
  const setStatus = usePlatformStore((state) => state.setStatus);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextStatus = await platformApi.getStatus();

        if (active) {
          setStatus(nextStatus);
        }
      } catch (_error) {
        if (active) {
          setStatus(null);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [setStatus]);

  return null;
}

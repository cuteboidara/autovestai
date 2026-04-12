const DEVICE_FINGERPRINT_KEY = 'autovestai.deviceFingerprint';

function generateFingerprint() {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getDeviceFingerprint(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = window.localStorage.getItem(DEVICE_FINGERPRINT_KEY);

  if (existing) {
    return existing;
  }

  const fingerprint = generateFingerprint();
  window.localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);

  return fingerprint;
}

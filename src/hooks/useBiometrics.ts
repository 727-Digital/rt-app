import { useCallback, useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNative } from '@/lib/capacitor';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

interface BiometricAuthPlugin {
  isAvailable(): Promise<{ isAvailable: boolean; biometryType: number }>;
  verify(options: { reason: string }): Promise<{ verified: boolean }>;
}

const BiometricAuth = registerPlugin<BiometricAuthPlugin>('BiometricAuth');

interface BiometricState {
  available: boolean;
  enabled: boolean;
  biometryType: 'faceId' | 'touchId' | null;
  authenticate: () => Promise<boolean>;
  enable: () => void;
  disable: () => void;
}

export function useBiometrics(): BiometricState {
  const [available, setAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<'faceId' | 'touchId' | null>(null);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true',
  );

  useEffect(() => {
    if (!isNative) return;

    async function check() {
      try {
        const result = await BiometricAuth.isAvailable();
        setAvailable(result.isAvailable);
        if (result.biometryType === 1) setBiometryType('touchId');
        else if (result.biometryType === 2) setBiometryType('faceId');
      } catch {
        setAvailable(false);
      }
    }

    check();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isNative || !available) return false;
    try {
      await BiometricAuth.verify({ reason: 'Unlock Reliable Turf' });
      return true;
    } catch {
      return false;
    }
  }, [available]);

  const enable = useCallback(() => {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    setEnabled(false);
  }, []);

  return { available, enabled, biometryType, authenticate, enable, disable };
}

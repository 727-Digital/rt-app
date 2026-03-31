import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNative } from '@/lib/capacitor';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function usePushNotifications() {
  const { user, orgId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative || !user || !orgId) return;

    let cleanup: (() => void) | undefined;

    async function register() {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;

      await PushNotifications.register();

      const registrationListener = await PushNotifications.addListener(
        'registration',
        async ({ value: token }) => {
          await supabase.from('device_tokens').upsert(
            {
              user_id: user!.id,
              org_id: orgId!,
              token,
              platform: 'ios',
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' },
          );
        },
      );

      const actionListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        ({ notification }) => {
          const data = notification.data as Record<string, string> | undefined;
          if (data?.lead_id) navigate(`/leads/${data.lead_id}`);
          else if (data?.quote_id) navigate(`/quotes/${data.quote_id}/edit`);
        },
      );

      cleanup = () => {
        registrationListener.remove();
        actionListener.remove();
      };
    }

    register();

    return () => cleanup?.();
  }, [user, orgId, navigate]);
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNative } from '@/lib/capacitor';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Debug telemetry — writes each stage to localStorage so we can see push
// registration state directly in the app UI. (The previous remote
// push-debug edge function was an unauthenticated sink and has been
// removed; telemetry is now local-only.)
const DEBUG_KEY = 'rt-push-debug-v1';

function pushDebug(stage: string, info?: Record<string, unknown>) {
  const entry = { stage, info, ts: new Date().toISOString() };
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    if (arr.length > 30) arr.splice(0, arr.length - 30);
    localStorage.setItem(DEBUG_KEY, JSON.stringify(arr));
  } catch {
    // ignore — localStorage might be locked down in some embedded contexts
  }
}

export function readPushDebugLog(): Array<{ stage: string; info?: unknown; ts: string }> {
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function usePushNotifications() {
  const { user, orgId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    pushDebug('hook_fired', {
      isNative,
      hasUser: !!user,
      userId: user?.id,
      orgId,
    });

    if (!isNative) {
      pushDebug('skipped_not_native');
      return;
    }
    if (!user || !orgId) {
      pushDebug('skipped_no_auth', { hasUser: !!user, orgId });
      return;
    }

    let cleanup: (() => void) | undefined;

    async function register() {
      let PushNotifications;
      try {
        ({ PushNotifications } = await import('@capacitor/push-notifications'));
        pushDebug('imported_plugin');
      } catch (e) {
        pushDebug('import_failed', { error: String(e) });
        return;
      }

      // CRITICAL: attach listeners BEFORE calling register(). iOS fires the
      // 'registration' event almost instantly when register() runs, and if the
      // listener isn't already attached the event is lost. Previously the
      // listener attached AFTER register() which meant the token was never
      // captured for first-launch users.
      const registrationListener = await PushNotifications.addListener(
        'registration',
        async ({ value: token }) => {
          pushDebug('token_received', { tokenPrefix: token.slice(0, 12) });
          const { error } = await supabase.from('device_tokens').upsert(
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
          pushDebug('db_upsert_result', { ok: !error, error: error?.message });
        },
      );

      const errorListener = await PushNotifications.addListener(
        'registrationError',
        (err) => {
          pushDebug('registration_error', { error: String(err) });
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
        errorListener.remove();
        actionListener.remove();
      };

      // Now request permissions + register. Listeners are already attached.
      try {
        const permission = await PushNotifications.requestPermissions();
        pushDebug('permission_result', { receive: permission.receive });
        if (permission.receive !== 'granted') return;

        await PushNotifications.register();
        pushDebug('register_called');
      } catch (e) {
        pushDebug('register_threw', { error: String(e) });
      }
    }

    register();

    return () => cleanup?.();
  }, [user, orgId, navigate]);
}

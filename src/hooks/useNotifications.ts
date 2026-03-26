import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/types';

export function useNotificationsForLead(leadId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setNotifications(data as Notification[]);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return { notifications, loading };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchLeads } from '@/lib/queries/leads';
import type { Lead } from '@/lib/types';
import { PIPELINE_STAGES } from '@/lib/types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLeads();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch leads'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) => [payload.new as Lead, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) =>
            prev.map((lead) =>
              lead.id === (payload.new as Lead).id ? (payload.new as Lead) : lead
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { leads, loading, error, refetch: load };
}

export function useLeadsByStatus() {
  const { leads, loading, error, refetch } = useLeads();

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of PIPELINE_STAGES) {
      map.set(stage, []);
    }
    for (const lead of leads) {
      const bucket = map.get(lead.status);
      if (bucket) {
        bucket.push(lead);
      }
    }
    return map;
  }, [leads]);

  return { grouped, loading, error, refetch };
}

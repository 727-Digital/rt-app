import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';
import { useAuth } from './useAuth';

interface OrgContextValue {
  org: Organization | null;
  loading: boolean;
  refetch: () => Promise<void>;
  updateOrganization: (data: Partial<Organization>) => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

function OrgProvider({ children }: { children: ReactNode }) {
  const { orgId } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!orgId) {
      setOrg(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      setOrg(data as Organization);
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function updateOrganization(data: Partial<Organization>) {
    if (!orgId) return;
    const { error } = await supabase
      .from('organizations')
      .update(data)
      .eq('id', orgId);
    if (error) throw error;
    await refetch();
  }

  return (
    <OrgContext value={{ org, loading, refetch, updateOrganization }}>
      {children}
    </OrgContext>
  );
}

function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}

export { OrgProvider, useOrg };

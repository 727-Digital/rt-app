import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  orgId: string | null;
  role: string | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchTeamMembership(userId: string) {
  try {
    const result = await Promise.race([
      supabase
        .from('team_members')
        .select('org_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    const { data, error } = result;
    if (error || !data) return { orgId: null, role: null };
    return { orgId: data.org_id as string, role: data.role as string };
  } catch {
    return { orgId: null, role: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const membership = await fetchTeamMembership(currentUser.id);
        if (cancelled) return;
        setOrgId(membership.orgId);
        setRole(membership.role);
      }

      setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const membership = await fetchTeamMembership(currentUser.id);
        if (!cancelled) {
          setOrgId(membership.orgId);
          setRole(membership.role);
        }
      } else {
        setOrgId(null);
        setRole(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function refreshMembership() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    // Refresh user to pick up updated metadata
    await supabase.auth.refreshSession();
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    if (refreshedUser) setUser(refreshedUser);
    const membership = await fetchTeamMembership(session.user.id);
    setOrgId(membership.orgId);
    setRole(membership.role);
  }

  return (
    <AuthContext value={{
      user,
      orgId,
      role,
      isPlatformAdmin: role === 'platform_admin',
      loading,
      signIn,
      signOut,
      refreshMembership,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

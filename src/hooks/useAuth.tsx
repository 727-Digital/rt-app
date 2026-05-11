import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  orgId: string | null;
  role: string | null;
  isPlatformAdmin: boolean;
  membershipFetchFailed: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type MembershipResult =
  | { status: 'found'; orgId: string; role: string }
  | { status: 'empty' }
  | { status: 'error'; reason: string };

// ---------------------------------------------------------------------------
// Membership cache (localStorage)
// Once a user has a verified team_members row, we cache their orgId+role so
// future page loads NEVER bounce to /onboarding even if Supabase RLS or
// realtime hiccups cause the membership fetch to transiently return empty.
// ---------------------------------------------------------------------------
const CACHE_KEY_PREFIX = 'rt-membership-v1:';

function readCachedMembership(userId: string): { orgId: string; role: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orgId?: string; role?: string };
    if (parsed.orgId && parsed.role) return { orgId: parsed.orgId, role: parsed.role };
  } catch {
    // localStorage might be unavailable (private browsing, etc.) — ignore
  }
  return null;
}

function writeCachedMembership(userId: string, orgId: string, role: string) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + userId,
      JSON.stringify({ orgId, role }),
    );
  } catch {
    // ignore
  }
}

function clearAllMembershipCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

async function fetchTeamMembership(userId: string): Promise<MembershipResult> {
  try {
    const result = await Promise.race([
      supabase
        .from('team_members')
        .select('org_id, role')
        .eq('user_id', userId)
        .limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000),
      ),
    ]);

    const { data, error } = result;
    if (error) {
      console.error('[useAuth] team_members fetch error:', error);
      return { status: 'error', reason: error.message };
    }
    if (!data || data.length === 0) {
      console.warn(
        '[useAuth] team_members empty for user',
        userId,
        '— could be missing row or RLS filter',
      );
      return { status: 'empty' };
    }
    const row = data[0] as { org_id: string; role: string };
    return { status: 'found', orgId: row.org_id, role: row.role };
  } catch (err) {
    console.error('[useAuth] team_members fetch threw:', err);
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'unknown',
    };
  }
}

// Retry with exponential backoff on 'empty' results — Supabase RLS evaluation
// can lag behind session establishment, especially right after sign-in or on
// fresh page loads. Total retry window: ~7 seconds.
async function fetchTeamMembershipWithRetry(
  userId: string,
  shouldCancel: () => boolean,
): Promise<MembershipResult> {
  const delays = [0, 1000, 2000, 4000];
  let lastResult: MembershipResult = { status: 'empty' };
  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (shouldCancel()) return lastResult;
    lastResult = await fetchTeamMembership(userId);
    if (shouldCancel()) return lastResult;
    if (lastResult.status === 'found' || lastResult.status === 'error') {
      return lastResult;
    }
    // status === 'empty' → retry
  }
  return lastResult;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [membershipFetchFailed, setMembershipFetchFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const shouldCancel = () => cancelled;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Synchronously populate from cache so the guard NEVER sees orgId=null
        // for a returning user. This kills the bounce-to-onboarding bug.
        const cached = readCachedMembership(currentUser.id);

        if (cached) {
          // Cached: render immediately, validate in background.
          setOrgId(cached.orgId);
          setRole(cached.role);
          setMembershipFetchFailed(false);
          setLoading(false);

          fetchTeamMembershipWithRetry(currentUser.id, shouldCancel).then(
            (membership) => {
              if (cancelled) return;
              if (membership.status === 'found') {
                setOrgId(membership.orgId);
                setRole(membership.role);
                writeCachedMembership(
                  currentUser.id,
                  membership.orgId,
                  membership.role,
                );
              }
              // empty/error with cache: silently keep cached state.
            },
          );
          return;
        }

        // No cache: must wait for fetch before letting the guard render,
        // otherwise the user gets bounced to /onboarding on first load.
        const membership = await fetchTeamMembershipWithRetry(
          currentUser.id,
          shouldCancel,
        );
        if (cancelled) return;

        if (membership.status === 'found') {
          setOrgId(membership.orgId);
          setRole(membership.role);
          setMembershipFetchFailed(false);
          writeCachedMembership(
            currentUser.id,
            membership.orgId,
            membership.role,
          );
        } else if (membership.status === 'error') {
          setMembershipFetchFailed(true);
        } else {
          // Genuine empty after all retries — let OnboardingGuard route to /onboarding
          setMembershipFetchFailed(false);
        }

        setLoading(false);
        return;
      }

      setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;

        // On sign-out, clear everything including the cache.
        if (event === 'SIGNED_OUT' || !currentUser) {
          clearAllMembershipCache();
          setUser(null);
          setOrgId(null);
          setRole(null);
          setMembershipFetchFailed(false);
          return;
        }

        // Token refresh doesn't change identity — preserve state.
        if (event === 'TOKEN_REFRESHED') {
          setUser(currentUser);
          return;
        }

        // Sign-in or user-updated: use cache immediately if present, then
        // validate in background. Same "empty doesn't clobber cache" rule.
        setUser(currentUser);
        const cached = readCachedMembership(currentUser.id);
        if (cached) {
          setOrgId(cached.orgId);
          setRole(cached.role);
          setMembershipFetchFailed(false);
        }

        const membership = await fetchTeamMembershipWithRetry(
          currentUser.id,
          shouldCancel,
        );
        if (cancelled) return;
        if (membership.status === 'found') {
          setOrgId(membership.orgId);
          setRole(membership.role);
          setMembershipFetchFailed(false);
          writeCachedMembership(currentUser.id, membership.orgId, membership.role);
        } else if (membership.status === 'error') {
          if (!cached) setMembershipFetchFailed(true);
        }
        // empty + cached: do nothing (keep cached state)
        // empty + no cache: leave orgId null so guard routes to onboarding
      },
    );

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
    clearAllMembershipCache();
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

    const membership = await fetchTeamMembershipWithRetry(
      session.user.id,
      () => false,
    );
    if (membership.status === 'found') {
      setOrgId(membership.orgId);
      setRole(membership.role);
      setMembershipFetchFailed(false);
      writeCachedMembership(session.user.id, membership.orgId, membership.role);
    } else if (membership.status === 'error') {
      setMembershipFetchFailed(true);
    } else {
      // Explicit refresh requested by user and got empty → trust it
      setOrgId(null);
      setRole(null);
      setMembershipFetchFailed(false);
    }
  }

  return (
    <AuthContext value={{
      user,
      orgId,
      role,
      isPlatformAdmin: role === 'platform_admin',
      membershipFetchFailed,
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

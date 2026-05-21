import { createClient, type LockFunc } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

// supabase-js v2 uses navigator.locks (Web Locks API) by default to
// coordinate auth-token refreshes across tabs. The downside: if another
// tab on the same Supabase project tries to refresh mid-flight (e.g.
// Supabase Studio open while a rep clicks the invite link), the
// contending request aborts with "Lock was released because another
// request stole it" — silently breaking updateUser() and similar.
//
// For this app we don't need cross-tab refresh coordination — token
// lifetimes are short and supabase-js still serializes refresh-token
// calls *within* a single tab even with this no-op lock. Cross-tab
// state stays consistent via the existing localStorage session sync.
const localLock: LockFunc = async (_name, _acquireTimeout, fn) => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: localLock,
  },
});

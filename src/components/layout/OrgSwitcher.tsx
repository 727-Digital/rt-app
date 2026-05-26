import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Organization } from '@/lib/types';

// Platform-admin-only context switcher. Lets Ty flip between Reliable
// Turf, Pro Green South, and any future white-label orgs from one
// session — Settings, Phone Numbers, Territories, etc. all rebind to
// the selected org so he doesn't have to log out to manage them.
//
// Hidden for non-platform-admin roles entirely. Sales reps and org
// admins only ever see their own org.
function OrgSwitcher() {
  const { isPlatformAdmin, orgId, setActiveOrgId } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click — same UX as the reassign menu on LeadDetail.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Load the full org list once when the switcher first mounts for a
  // platform admin. Platform-admin RLS bypass means we can read every
  // org row in one go.
  useEffect(() => {
    if (!isPlatformAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, primary_color, logo_url')
        .order('name', { ascending: true });
      if (!cancelled && data) setOrgs(data as Organization[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin || orgs.length <= 1) return null;

  const active = orgs.find((o) => o.id === orgId) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {active?.logo_url ? (
            <img
              src={active.logo_url}
              alt={active.name}
              className="h-5 w-5 shrink-0 rounded object-contain"
            />
          ) : (
            <span
              className="h-5 w-5 shrink-0 rounded"
              style={{ backgroundColor: active?.primary_color ?? '#16a34a' }}
            />
          )}
          <span className="truncate font-medium text-slate-900">
            {active?.name ?? 'Select org'}
          </span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Switch context
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveOrgId(o.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                    o.id === orgId && 'bg-emerald-50',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {o.logo_url ? (
                      <img
                        src={o.logo_url}
                        alt={o.name}
                        className="h-5 w-5 shrink-0 rounded object-contain"
                      />
                    ) : (
                      <span
                        className="h-5 w-5 shrink-0 rounded"
                        style={{ backgroundColor: o.primary_color ?? '#16a34a' }}
                      />
                    )}
                    <span className="truncate text-slate-800">{o.name}</span>
                  </span>
                  {o.id === orgId && (
                    <Check size={14} className="shrink-0 text-emerald-600" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { OrgSwitcher };

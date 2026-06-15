import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface SyncRow {
  leadgen_id: string;
  lead_name: string | null;
  fb_created_time: string | null;
  in_app: boolean;
  recovered: boolean;
}

// Lead Sync card — reconciliation between Facebook Lead Center and the
// Reliable Turf app. The reconcile-fb-leads watchdog (pg_cron, every
// 15 min) keeps fb_lead_sync current and auto-recovers anything the
// webhook missed; this card just reads it so the team can confirm, per
// lead, that BOTH systems have it. Read-only — sends nothing.
export function LeadSyncCard() {
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('fb_lead_sync')
        .select('leadgen_id, lead_name, fb_created_time, in_app, recovered')
        .order('fb_created_time', { ascending: false })
        .limit(20);
      if (!cancelled) {
        setRows((data ?? []) as SyncRow[]);
        setLoading(false);
      }
    }

    load();
    // Poll so cron updates surface without a manual refresh.
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Don't show the card until the watchdog has seen at least one FB lead.
  if (!loading && rows.length === 0) return null;

  const recoveredCount = rows.filter((r) => r.recovered).length;
  const missingCount = rows.filter((r) => !r.in_app).length;

  let summary: string;
  let summaryTone: string;
  if (missingCount > 0) {
    summary = `${missingCount} lead${missingCount > 1 ? 's' : ''} not yet in the app — syncing…`;
    summaryTone = 'text-red-600';
  } else if (recoveredCount > 0) {
    summary = `All ${rows.length} confirmed in both · ${recoveredCount} auto-recovered`;
    summaryTone = 'text-amber-600';
  } else {
    summary = `All ${rows.length} confirmed in Facebook + the app`;
    summaryTone = 'text-emerald-600';
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-500" />
        <h2 className="text-sm font-semibold text-slate-900">Lead Sync</h2>
        <span className="text-xs text-slate-400">Facebook ↔ Reliable Turf</span>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <p className={`text-sm font-medium ${summaryTone}`}>{summary}</p>
          {loading && <RefreshCw size={14} className="animate-spin text-slate-300" />}
        </div>

        <ul className="divide-y divide-slate-50">
          {rows.map((r) => (
            <li
              key={r.leadgen_id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {r.lead_name || 'Facebook lead'}
                </p>
                {r.fb_created_time && (
                  <p className="text-xs text-slate-400">
                    {formatDistanceToNow(parseISO(r.fb_created_time), { addSuffix: true })}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={12} /> Facebook
                </span>
                {r.in_app ? (
                  r.recovered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <AlertTriangle size={12} /> App · recovered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={12} /> App
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={12} /> App · pending
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// Scheduled dispatcher for the follow_ups table.
//
// Reads every pending follow-up whose scheduled_for has arrived, sends the
// SMS via Signal House, and marks the row sent (or failed). Designed to be
// invoked every minute by a pg_cron job in Supabase.
//
// pg_cron schedule (run once in the SQL editor):
//
//   select cron.schedule(
//     'process-follow-ups-every-minute',
//     '* * * * *',
//     $$
//     select net.http_post(
//       url := 'https://exigoosajrdbqjqtricl.supabase.co/functions/v1/process-follow-ups',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
//       ),
//       body := '{}'::jsonb,
//       timeout_milliseconds := 25000
//     );
//     $$
//   );
//
// Hard-limited to PROCESS_LIMIT rows per run to avoid runaway when the
// dispatcher catches up after an outage.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { resolveOutboundNumber } from "../_shared/numbers.ts";

const PROCESS_LIMIT = 50;

interface FollowUp {
  id: string;
  lead_id: string;
  org_id: string | null;
  type: string;
  scheduled_for: string;
  channel: string | null;
  body: string | null;
}

Deno.serve(async (_req: Request) => {
  const supabase = getServiceClient();
  const startedAt = new Date().toISOString();

  // Pick up everything that's overdue. Order oldest-first so reminders fire
  // in chronological order if multiple are due in the same tick.
  const { data: due, error } = await supabase
    .from("follow_ups")
    .select("id, lead_id, org_id, type, scheduled_for, channel, body")
    .eq("status", "pending")
    .lte("scheduled_for", startedAt)
    .order("scheduled_for", { ascending: true })
    .limit(PROCESS_LIMIT)
    .returns<FollowUp[]>();

  if (error) {
    console.error("[process-follow-ups] query failed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!due || due.length === 0) {
    return new Response(
      JSON.stringify({ startedAt, processed: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  let failed = 0;

  for (const followUp of due) {
    // Only SMS is implemented today; if we add email or push reminders later
    // this is where the dispatch switch lives.
    if ((followUp.channel || "sms") !== "sms") {
      console.warn(
        `[process-follow-ups] skipping unsupported channel ${followUp.channel} on ${followUp.id}`,
      );
      continue;
    }
    if (!followUp.body) {
      await markFailed(supabase, followUp.id, "no body");
      failed++;
      continue;
    }

    // Pull the lead's phone fresh — never trust stale data on the queue row.
    // Also need org_id + assignment to resolve which Signal House number sends.
    const { data: lead } = await supabase
      .from("leads")
      .select("phone, name, org_id, assigned_team_member_id")
      .eq("id", followUp.lead_id)
      .single();

    if (!lead?.phone) {
      await markFailed(supabase, followUp.id, "lead missing phone");
      failed++;
      continue;
    }

    try {
      const fromNumber = await resolveOutboundNumber(supabase, {
        leadId: followUp.lead_id,
        orgId: (lead as { org_id: string | null }).org_id,
        assignedTeamMemberId:
          (lead as { assigned_team_member_id: string | null }).assigned_team_member_id,
      });
      const ok = await sendSms(lead.phone, followUp.body, fromNumber);
      if (ok) {
        await supabase
          .from("follow_ups")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", followUp.id);

        // Mirror to the lead's message thread so the rep sees what was sent.
        await supabase.from("messages").insert({
          lead_id: followUp.lead_id,
          org_id: followUp.org_id,
          direction: "outbound",
          channel: "sms",
          from_number: fromNumber ?? null,
          to_number: lead.phone,
          body: followUp.body,
          status: "queued",
        });

        sent++;
      } else {
        await markFailed(supabase, followUp.id, "signalhouse returned !ok");
        failed++;
      }
    } catch (e) {
      console.error(`[process-follow-ups] send threw on ${followUp.id}:`, e);
      await markFailed(supabase, followUp.id, e instanceof Error ? e.message : "unknown");
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      startedAt,
      finishedAt: new Date().toISOString(),
      eligible: due.length,
      sent,
      failed,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

async function markFailed(
  supabase: ReturnType<typeof getServiceClient>,
  id: string,
  reason: string,
) {
  console.warn(`[process-follow-ups] marking ${id} failed: ${reason}`);
  await supabase
    .from("follow_ups")
    .update({ status: "cancelled", sent_at: new Date().toISOString() })
    .eq("id", id);
}

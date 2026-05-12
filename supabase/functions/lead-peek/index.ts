// One-off diagnostic. Returns recent leads + counts from the tables that
// today's notification + scheduling pipeline writes to. Delete after auditing.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const supabase = getServiceClient();

  // ?test=dispatch — round-trip test: queue a follow_up scheduled for "now",
  // hit the dispatcher, verify it processed + sent, then clean up the rows.
  const url = new URL(req.url);
  if (url.searchParams.get("test") === "dispatch") {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, org_id, phone")
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!lead) {
      return new Response(JSON.stringify({ error: "no lead with phone" }));
    }
    const probeBody = `Audit ${new Date().toISOString().slice(11, 19)} ignore`;
    const ins = await supabase
      .from("follow_ups")
      .insert({
        lead_id: lead.id,
        org_id: lead.org_id,
        type: "appointment_reminder",
        scheduled_for: new Date(Date.now() - 5000).toISOString(),
        channel: "sms",
        body: probeBody,
      })
      .select()
      .single();
    if (ins.error || !ins.data) {
      return new Response(JSON.stringify({ step: "insert", error: ins.error?.message }));
    }
    const fuId = (ins.data as { id: string }).id;
    const dispatch = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-follow-ups`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    const dispatchBody = await dispatch.json().catch(() => ({}));
    const after = await supabase
      .from("follow_ups")
      .select("status, sent_at")
      .eq("id", fuId)
      .single();
    await supabase.from("follow_ups").delete().eq("id", fuId);
    await supabase
      .from("messages")
      .delete()
      .eq("lead_id", lead.id)
      .eq("body", probeBody);
    return new Response(
      JSON.stringify(
        {
          dispatchStatus: dispatch.status,
          dispatchResponse: dispatchBody,
          followUpStatusAfter: after.data,
        },
        null,
        2,
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const notifAll = await supabase
    .from("notifications")
    .select("id, channel, type, sent_at", { count: "exact", head: false })
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(5);

  const [
    leads,
    messages,
    followUpsPending,
    followUpsSentRecent,
    notifications,
    appointments,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, created_at, name, phone, status, source, site_visit_date, install_date, satellite_image_url, polygon_data")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("messages")
      .select("created_at, direction, to_number, body, status, lead_id")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("follow_ups")
      .select("id, lead_id, type, scheduled_for, status")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(10),
    supabase
      .from("follow_ups")
      .select("id, lead_id, type, scheduled_for, status, sent_at")
      .neq("status", "pending")
      .order("sent_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("sent_at, channel, type, recipient, lead_id")
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase
      .from("appointments")
      .select("id, lead_id, title, start_time, end_time")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return new Response(
    JSON.stringify(
      {
        leads: leads.data,
        recentMessages: messages.data,
        pendingFollowUpsCount: followUpsPending.data?.length ?? 0,
        pendingFollowUps: followUpsPending.data,
        recentSentFollowUps: followUpsSentRecent.data,
        recentNotifications: notifications.data,
        recentAppointments: appointments.data,
        notificationsRawCount: notifAll.count,
        notificationsLatest: notifAll.data,
        notificationsError: notifAll.error?.message ?? null,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
});

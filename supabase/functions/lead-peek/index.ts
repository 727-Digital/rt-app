// One-off diagnostic. Returns recent leads + counts from the tables that
// today's notification + scheduling pipeline writes to. Delete after auditing.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { resolveOutboundNumber } from "../_shared/numbers.ts";

Deno.serve(async (req) => {
  const supabase = getServiceClient();
  const url = new URL(req.url);

  // ?fix=reminder_names — strip last names from already-queued
  // appointment_reminder rows. Older queued reminders baked the full
  // lead name into the body before we unified on first-name-only; this
  // patches them in place so the customer doesn't get "Hi Ty Hanson,"
  // when they should get "Hi Ty,". Only touches pending rows.
  if (url.searchParams.get("fix") === "reminder_names") {
    const supabase = getServiceClient();
    const { data: pending } = await supabase
      .from("follow_ups")
      .select("id, body")
      .eq("type", "appointment_reminder")
      .eq("status", "pending");
    const updated: Array<{ id: string; before: string; after: string }> = [];
    for (const row of (pending ?? []) as Array<{ id: string; body: string | null }>) {
      if (!row.body) continue;
      // Match "Hey {first} {rest of name}," or "Hi {first} {rest of name},"
      // and collapse to "Hi/Hey {first},". If the body only has a first
      // name already, the regex doesn't match and we leave it alone.
      const next = row.body.replace(
        /^(Hi|Hey) ([^ ,]+) [^,]+,/,
        "$1 $2,",
      );
      if (next === row.body) continue;
      await supabase.from("follow_ups").update({ body: next }).eq("id", row.id);
      updated.push({ id: row.id, before: row.body.slice(0, 80), after: next.slice(0, 80) });
    }
    return new Response(JSON.stringify({
      pendingCount: pending?.length ?? 0,
      updatedCount: updated.length,
      updated,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // ?audit=config — list every signal_house_numbers row, every territory
  // with a rep, and resolve the number that an assigned lead would use.
  if (url.searchParams.get("audit") === "config") {
    const numbers = await supabase
      .from("signal_house_numbers")
      .select("phone_number, display_number, is_default_for_org, status, team_member_id, org_id");
    const memberMap = new Map<string, string>();
    if (numbers.data?.length) {
      const memberIds = (numbers.data as Array<{ team_member_id: string | null }>)
        .map((r) => r.team_member_id)
        .filter((x): x is string => !!x);
      if (memberIds.length) {
        const m = await supabase
          .from("team_members")
          .select("id, name")
          .in("id", memberIds);
        for (const row of (m.data ?? []) as Array<{ id: string; name: string }>) {
          memberMap.set(row.id, row.name);
        }
      }
    }
    const territories = await supabase
      .from("territories")
      .select("name, zip_codes, team_member_id, is_active")
      .order("name");
    return new Response(JSON.stringify({
      numbers: (numbers.data ?? []).map((n) => ({
        ...(n as Record<string, unknown>),
        team_member_name: memberMap.get((n as { team_member_id: string | null }).team_member_id ?? "") ?? null,
      })),
      territories: territories.data,
      numbersError: numbers.error?.message ?? null,
      territoriesError: territories.error?.message ?? null,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // ?audit=schema — verify the rep-numbers / territories / lead-assignment
  // migration actually landed in production.
  if (url.searchParams.get("audit") === "schema") {
    const [nums, terr, leads] = await Promise.all([
      supabase.from("signal_house_numbers").select("*", { count: "exact", head: true }),
      supabase
        .from("territories")
        .select("id, team_member_id", { count: "exact" })
        .not("team_member_id", "is", null),
      supabase
        .from("leads")
        .select("id, assigned_team_member_id", { count: "exact" })
        .not("assigned_team_member_id", "is", null),
    ]);
    // Confirm the columns exist even when no rows yet by reading 0 rows
    const colCheck = await supabase
      .from("leads")
      .select("id, assigned_team_member_id, org_id")
      .limit(1);
    return new Response(
      JSON.stringify({
        signal_house_numbers: {
          tableExists: !nums.error,
          rowCount: nums.count,
          error: nums.error?.message ?? null,
        },
        territories_with_rep: {
          rowCount: terr.count,
          error: terr.error?.message ?? null,
        },
        leads_with_rep: {
          rowCount: leads.count,
          error: leads.error?.message ?? null,
        },
        leadsColumnsOk: !colCheck.error,
        leadsColumnsError: colCheck.error?.message ?? null,
      }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // ?audit=routing — end-to-end test the outbound-number resolver. Inserts a
  // throwaway signal_house_numbers row, exercises every branch of
  // resolveOutboundNumber, then deletes the row. No SMS are sent.
  if (url.searchParams.get("audit") === "routing") {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "reliable-turf")
      .maybeSingle();
    if (!org) return new Response(JSON.stringify({ error: "no org" }));
    const orgId = (org as { id: string }).id;

    const { data: members } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("org_id", orgId)
      .limit(1);
    const member = (members ?? [])[0] as { id: string; name: string } | undefined;
    if (!member) return new Response(JSON.stringify({ error: "no member" }));

    // Insert two throwaway numbers: one rep-bound, one org-default.
    const repNumberValue = "10000000001";
    const defaultNumberValue = "10000000002";

    const ins = await supabase
      .from("signal_house_numbers")
      .insert([
        { org_id: orgId, phone_number: repNumberValue, display_number: "rep test", team_member_id: member.id, is_default_for_org: false },
        { org_id: orgId, phone_number: defaultNumberValue, display_number: "default test", team_member_id: null, is_default_for_org: true },
      ])
      .select();
    if (ins.error) return new Response(JSON.stringify({ insertError: ins.error.message }));

    const results = {
      caseA_assignedRep: await resolveOutboundNumber(supabase, {
        orgId,
        assignedTeamMemberId: member.id,
      }),
      caseB_unassignedSameOrg: await resolveOutboundNumber(supabase, {
        orgId,
        assignedTeamMemberId: null,
      }),
      caseC_noOrgNoRep: await resolveOutboundNumber(supabase, {
        orgId: null,
        assignedTeamMemberId: null,
      }),
    };

    // Cleanup
    await supabase
      .from("signal_house_numbers")
      .delete()
      .in("phone_number", [repNumberValue, defaultNumberValue]);

    return new Response(JSON.stringify({
      member: member.name,
      expected: {
        caseA: repNumberValue + " (rep-bound row)",
        caseB: defaultNumberValue + " (org default)",
        caseC: "env-var SIGNALHOUSE_FROM_NUMBER fallback",
      },
      actual: results,
      pass: {
        caseA: results.caseA_assignedRep === repNumberValue,
        caseB: results.caseB_unassignedSameOrg === defaultNumberValue,
        caseC: results.caseC_noOrgNoRep !== null,
      },
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // ?test=dispatch — round-trip test: queue a follow_up scheduled for "now",
  // hit the dispatcher, verify it processed + sent, then clean up the rows.
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

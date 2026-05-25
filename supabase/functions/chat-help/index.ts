// chat-help: in-app help bot for Reliable Turf reps.
//
// Feeds Claude 4.5 Sonnet the entire current codebase (via the
// auto-generated snapshot in _shared/codebase-snapshot.txt) as cached
// system context. Because the snapshot is regenerated on every build,
// the bot's answers always reflect the deployed code — no stale docs,
// no manual maintenance.
//
// Anthropic prompt caching keeps cost sane: the snapshot (~183K
// tokens) is marked cache_control, so after the first query of a
// 5-minute window we pay ~10% of the snapshot's input cost on
// subsequent queries. Per-query economics in practice:
//   cold:  ~$0.55  (full snapshot input)
//   warm:  ~$0.06  (cache hit + small per-query delta)
// At 5 reps × 10 questions/week with reasonable cache hits, ~$5/mo.
//
// Streams the response back as Server-Sent Events so the widget shows
// tokens as Claude writes them.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { CODEBASE_SNAPSHOT_B64 } from "../_shared/codebase-snapshot.ts";

// Snapshot is shipped base64-encoded (see scripts/generate-codebase-snapshot.mjs
// for why). Decode once at module init; cost is paid on cold start
// only, then reused across requests on the same instance.
const codebaseSnapshot = atob(CODEBASE_SNAPSHOT_B64);

const SYSTEM_PROMPT_INTRO = `You are the in-app help assistant for Reliable Turf, a white-label CRM for artificial-turf installation companies (Reliable Turf, Pro Green South, etc.). Reps use the app on iPhone and web to manage leads, send quotes, schedule installs, and message customers.

Your job: answer the rep's question in clear, step-by-step instructions based on the EXACT current state of the codebase below. Never invent features that aren't in the code. If something doesn't exist yet, say so honestly.

Style:
- Direct and concise. No fluff or "I'd be happy to help" preamble.
- Numbered steps for any multi-step flow.
- Reference the actual button labels and page names from the code so the rep can find them.
- If the rep is on a specific page, anchor your answer to that page.
- If a question is about backend behavior (RLS, notifications, follow-ups), explain it plainly without dumping code.

If you genuinely don't know or the codebase doesn't cover it, say "I'm not sure — text Ty." Never bluff.

Below is the entire current codebase snapshot. Use it as the source of truth.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  question?: string;
  messages?: ChatMessage[];
  current_path?: string;
  org_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Support both forms: a one-shot { question } or a full { messages }
  // conversation. Widget uses messages so follow-up questions retain
  // context.
  const turns: ChatMessage[] =
    body.messages && body.messages.length > 0
      ? body.messages
      : body.question
        ? [{ role: "user", content: body.question }]
        : [];

  if (turns.length === 0) {
    return new Response(
      JSON.stringify({ error: "No question or messages provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const pageContext = body.current_path
    ? `\n\nThe rep is currently viewing: ${body.current_path}`
    : "";
  const orgContext = body.org_name
    ? `\nThey work for: ${body.org_name}`
    : "";

  // System prompt is split into two blocks so the heavy codebase snapshot
  // gets a cache_control marker. Anthropic caches everything up to and
  // including the marked block; subsequent requests reuse it.
  const system = [
    {
      type: "text",
      text: SYSTEM_PROMPT_INTRO + pageContext + orgContext,
    },
    {
      type: "text",
      text: `\n\n=== CODEBASE SNAPSHOT ===\n\n${codebaseSnapshot}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Standard 200K context. We keep the snapshot under that ceiling by
  // stripping comments and skipping low-value files in the generator
  // (see scripts/generate-codebase-snapshot.mjs).
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      stream: true,
      system,
      messages: turns,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text();
    console.error("[chat-help] upstream error:", upstream.status, errText);
    return new Response(
      JSON.stringify({ error: `Claude API error: ${upstream.status}`, detail: errText }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Re-stream the SSE response straight through to the widget. The
  // widget parses Anthropic's standard event format (content_block_delta
  // → text_delta chunks).
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

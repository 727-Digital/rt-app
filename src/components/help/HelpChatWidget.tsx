import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useOrg } from '@/hooks/useOrg';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Floating bottom-right help bot. Powered by chat-help edge function
// which feeds the entire current codebase to Claude as cached system
// context. Answers always match the deployed code — no doc maintenance.
//
// Lives in Shell so it appears on every authed route. Page context
// (current_path) is included with each question so Claude can give
// answers anchored to where the rep is right now ("you're on the lead
// detail page; click the green Reassign chip…").
function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { org } = useOrg();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    setError(null);
    setInput('');
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: question },
    ];
    // Add an empty assistant message so we can stream into it in place.
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setPending(true);

    try {
      // We invoke the edge function manually (instead of via supabase.functions.invoke)
      // because the SDK doesn't expose streaming responses — it always
      // buffers the full body. Direct fetch lets us pipe SSE chunks
      // straight into the assistant message as they arrive.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/chat-help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          messages: nextMessages,
          current_path: location.pathname,
          org_name: org?.name,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
      }

      // Anthropic streams SSE events. We only care about
      // content_block_delta events with text_delta chunks; everything
      // else (message_start, ping, message_stop) we ignore.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta?.text
            ) {
              const chunk = parsed.delta.text;
              setMessages((current) => {
                const next = [...current];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = {
                    role: 'assistant',
                    content: last.content + chunk,
                  };
                }
                return next;
              });
            }
          } catch {
            // Ignore parse errors on partial chunks.
          }
        }
      }
    } catch (e) {
      console.error('[HelpChatWidget] error:', e);
      setError(
        e instanceof Error ? e.message : 'Something went wrong.',
      );
      // Strip the trailing empty assistant message.
      setMessages((current) =>
        current[current.length - 1]?.content === ''
          ? current.slice(0, -1)
          : current,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Floating launcher — visible everywhere when chat is closed. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help chat"
          className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:bg-emerald-800 lg:bottom-6"
        >
          <MessageCircleQuestion size={22} />
        </button>
      )}

      {/* Expanded chat panel. */}
      {open && (
        <div
          className={cn(
            'fixed bottom-20 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:bottom-6',
            'h-[min(560px,calc(100dvh-8rem))]',
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-emerald-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion size={18} />
              <span className="text-sm font-semibold">Help</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help chat"
              className="rounded-full p-1 hover:bg-emerald-700"
            >
              <X size={16} />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3"
          >
            {messages.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Ask me anything</p>
                <p className="mt-1 text-xs text-slate-500">
                  I know every feature in this app. Try:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                  <li>· How do I text a lead?</li>
                  <li>· How do I send a quote?</li>
                  <li>· How do I schedule a site visit?</li>
                  <li>· How do I add photos to a quote?</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'ml-6 bg-emerald-600 text-white'
                    : 'mr-6 bg-white text-slate-800 shadow-sm border border-slate-100',
                )}
              >
                {m.content ||
                  (pending && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <Dot delay={0} />
                      <Dot delay={120} />
                      <Dot delay={240} />
                    </span>
                  ) : null)}
              </div>
            ))}
            {error && (
              <div className="mr-6 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pending ? 'Thinking…' : 'Ask anything…'}
              disabled={pending}
              className="min-h-[44px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

export { HelpChatWidget };

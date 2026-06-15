import { useCallback, useEffect, useRef, useState } from 'react';
// Note: scroll-to-bottom intentionally only fires when the message count grows.
// Polling re-fetches every 8s with a fresh array reference, so a naive
// [messages] dependency would jerk the page down every poll — annoying when
// the user is reading the page.
import { CheckCheck, AlertCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { fetchMessages, sendMessage } from '@/lib/queries/messages';
import { updateLead } from '@/lib/queries/leads';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface MessageThreadProps {
  leadId: string;
  leadPhone: string;
  orgId: string | null;
  // Present iff this lead came in (or is being worked) over FB Messenger.
  // The composer routes outbound through Graph API when set; SMS path
  // when not.
  fbPsid?: string | null;
  leadCreatedAt?: string;
  firstResponseAt?: string | null;
  onFirstResponse?: () => void;
  // When true (set by the Leads/Customers list "Text Lead" icon path), the
  // input is focused on first mount so the iOS keyboard pops up immediately.
  // Defaulted to false so existing call sites keep working unchanged.
  autoFocusInput?: boolean;
}

function MessageThread({
  leadId,
  leadPhone,
  orgId,
  fbPsid,
  leadCreatedAt,
  firstResponseAt,
  onFirstResponse,
  autoFocusInput = false,
}: MessageThreadProps) {
  const channel: 'sms' | 'messenger' = fbPsid ? 'messenger' : 'sms';
  // For Messenger threads we don't have a phone number; the PSID stands
  // in as the to-address. Channel + recipient ID is what the edge
  // function uses to route.
  const toAddress = channel === 'messenger' ? (fbPsid as string) : leadPhone;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchMessages(leadId);
        if (!cancelled) setMessages(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    // Polling fallback — refetches every 8s in case the realtime subscription
    // misses an event (Supabase realtime occasionally drops INSERTs when RLS
    // filtering or publication settings race). Cheap insurance, keeps inbound
    // SMS visible without requiring a manual refresh.
    const intervalId = setInterval(() => {
      if (!cancelled && document.visibilityState === 'visible') {
        load();
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [leadId]);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

  // One-shot focus when autoFocusInput is true (set by the Leads list icon).
  // Waits until the initial fetch finishes so the input element exists in
  // the DOM. iOS Safari is finicky about programmatic focus outside a user
  // gesture; the tap that triggered the navigation is recent enough that
  // the WKWebView usually accepts it. setTimeout lets the layout settle
  // before we focus and scroll-into-view.
  const focusedOnceRef = useRef(false);
  useEffect(() => {
    if (!autoFocusInput || loading || focusedOnceRef.current) return;
    focusedOnceRef.current = true;
    const id = setTimeout(() => {
      const input = document.getElementById('message-thread-input') as
        | HTMLInputElement
        | null;
      if (!input) return;
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }, 350);
    return () => clearTimeout(id);
  }, [autoFocusInput, loading]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === (payload.new as Message).id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
          }
          if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (payload.new as Message).id ? (payload.new as Message) : m,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  async function recordFirstResponse() {
    if (firstResponseAt) return;
    const now = new Date().toISOString();
    const responseSeconds = leadCreatedAt
      ? Math.round(
          (new Date(now).getTime() - new Date(leadCreatedAt).getTime()) / 1000,
        )
      : null;
    await updateLead(leadId, {
      first_response_at: now,
      response_time_seconds: responseSeconds,
    } as Partial<import('@/lib/types').Lead>);
    onFirstResponse?.();
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        lead_id: leadId,
        org_id: orgId,
        direction: 'outbound',
        channel,
        from_number: null,
        to_number: toAddress,
        body: trimmed,
        twilio_sid: null,
        status: 'queued',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setBody('');
      scrollToBottom();

      await recordFirstResponse();

      const sent = await sendMessage({
        lead_id: leadId,
        org_id: orgId,
        to_number: toAddress,
        body: trimmed,
        channel,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? sent : m)),
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 overflow-y-auto px-1 py-2" style={{ maxHeight: '400px' }}>
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            No messages yet. Send the first text below.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col',
              msg.direction === 'outbound' ? 'items-end' : 'items-start',
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                msg.direction === 'outbound'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-900',
              )}
            >
              {msg.body}
            </div>
            <div className="mt-0.5 flex items-center gap-1 px-1">
              <span className="text-[10px] text-slate-400">
                {format(parseISO(msg.created_at), 'MMM d, h:mm a')}
              </span>
              {msg.direction === 'outbound' && msg.status === 'delivered' && (
                <CheckCheck size={12} className="text-emerald-500" />
              )}
              {msg.direction === 'outbound' && msg.status === 'failed' && (
                <AlertCircle size={12} className="text-red-500" />
              )}
              {msg.direction === 'outbound' && msg.status === 'delivered' && (
                <span className="text-[10px] text-emerald-500">Delivered</span>
              )}
              {msg.direction === 'outbound' && msg.status === 'failed' && (
                <span className="text-[10px] text-red-500">Failed</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-3">
        <input
          id="message-thread-input"
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            // Belt-and-suspenders for iOS: wait for the keyboard animation to
            // start (~300ms), then scroll the input into the visible area.
            // Shell handles the layout shrink via visualViewport, but if the
            // user was scrolled high on the page we still need this nudge.
            const el = e.currentTarget;
            setTimeout(() => {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 300);
          }}
          placeholder={channel === 'messenger' ? 'Reply via Messenger…' : 'Type a message...'}
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <Button
          size="sm"
          onClick={handleSend}
          loading={sending}
          disabled={!body.trim()}
        >
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}

export { MessageThread };

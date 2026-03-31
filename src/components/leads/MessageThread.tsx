import { useCallback, useEffect, useRef, useState } from 'react';
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
  leadCreatedAt?: string;
  firstResponseAt?: string | null;
  onFirstResponse?: () => void;
}

function MessageThread({
  leadId,
  leadPhone,
  orgId,
  leadCreatedAt,
  firstResponseAt,
  onFirstResponse,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchMessages(leadId);
        setMessages(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
        channel: 'sms',
        from_number: null,
        to_number: leadPhone,
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
        to_number: leadPhone,
        body: trimmed,
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
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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

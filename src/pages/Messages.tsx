import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, AlertCircle, Send, Search, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import type { Message } from '@/lib/types';

interface ConversationPreview {
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  last_message: string;
  last_message_at: string;
  direction: 'inbound' | 'outbound';
  unread_count: number;
}

function formatDate(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function Messages() {
  const { org } = useOrg();
  const { isPlatformAdmin } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      setLoading(true);
      try {
        let query = supabase
          .from('messages')
          .select('lead_id, direction, body, created_at, status, leads!inner(name, phone, org_id)')
          .order('created_at', { ascending: false });

        if (!isPlatformAdmin && org?.id) {
          query = query.eq('org_id', org.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Group by lead_id to get conversations
        const grouped = new Map<string, ConversationPreview>();
        for (const msg of data || []) {
          const lead = msg.leads as unknown as { name: string; phone: string; org_id: string };
          if (!grouped.has(msg.lead_id)) {
            grouped.set(msg.lead_id, {
              lead_id: msg.lead_id,
              lead_name: lead?.name || 'Unknown',
              lead_phone: lead?.phone || '',
              last_message: msg.body,
              last_message_at: msg.created_at,
              direction: msg.direction,
              unread_count: 0,
            });
          }
        }

        setConversations(Array.from(grouped.values()));
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, [org?.id, isPlatformAdmin]);

  // Load messages for selected lead
  useEffect(() => {
    if (!selectedLead) return;

    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('lead_id', selectedLead!.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data as Message[]);
      } finally {
        setMessagesLoading(false);
      }
    }
    loadMessages();
  }, [selectedLead]);

  // Real-time messages
  useEffect(() => {
    if (!selectedLead) return;

    const channel = supabase
      .channel(`inbox-${selectedLead.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `lead_id=eq.${selectedLead.id}`,
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
  }, [selectedLead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !selectedLead) return;

    setSending(true);
    try {
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        lead_id: selectedLead.id,
        org_id: org?.id || null,
        direction: 'outbound',
        channel: 'sms',
        from_number: null,
        to_number: selectedLead.phone,
        body: trimmed,
        twilio_sid: null,
        status: 'queued',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setBody('');

      await supabase.functions.invoke('send-sms', {
        body: {
          lead_id: selectedLead.id,
          org_id: org?.id || null,
          to_number: selectedLead.phone,
          body: trimmed,
        },
      });

      const { data: inserted } = await supabase
        .from('messages')
        .insert({
          lead_id: selectedLead.id,
          org_id: org?.id || null,
          direction: 'outbound',
          channel: 'sms',
          to_number: selectedLead.phone,
          body: trimmed,
          status: 'queued',
        })
        .select()
        .single();

      if (inserted) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? (inserted as Message) : m)),
        );
      }

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.lead_id === selectedLead.id
            ? { ...c, last_message: trimmed, last_message_at: new Date().toISOString(), direction: 'outbound' }
            : c,
        ),
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

  const filtered = conversations.filter(
    (c) =>
      c.lead_name.toLowerCase().includes(search.toLowerCase()) ||
      c.lead_phone.includes(search),
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Conversation list */}
      <div
        className={cn(
          'w-full border-r border-slate-200 bg-white lg:w-80',
          selectedLead ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
        )}
      >
        <div className="border-b border-slate-200 p-4">
          <h1 className="mb-3 text-lg font-bold text-slate-900">Messages</h1>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <MessageSquare size={32} />
              <p className="text-sm">No conversations yet</p>
            </div>
          )}
          {filtered.map((conv) => (
            <button
              key={conv.lead_id}
              onClick={() =>
                setSelectedLead({ id: conv.lead_id, name: conv.lead_name, phone: conv.lead_phone })
              }
              className={cn(
                'flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                selectedLead?.id === conv.lead_id && 'bg-emerald-50',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                {conv.lead_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 truncate">{conv.lead_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(conv.last_message_at)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {conv.direction === 'outbound' ? 'You: ' : ''}
                  {conv.last_message}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div
        className={cn(
          'flex flex-1 flex-col bg-slate-50',
          !selectedLead ? 'hidden lg:flex' : 'flex',
        )}
      >
        {!selectedLead ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <MessageSquare size={48} />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <button
                onClick={() => setSelectedLead(null)}
                className="text-sm text-emerald-600 lg:hidden"
              >
                Back
              </button>
              <div className="flex-1">
                <Link
                  to={`/leads/${selectedLead.id}`}
                  className="text-sm font-semibold text-slate-900 hover:text-emerald-600"
                >
                  {selectedLead.name}
                </Link>
                <p className="text-xs text-slate-500">{selectedLead.phone}</p>
              </div>
              <a
                href={`tel:${selectedLead.phone}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                <Phone size={16} />
              </a>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={20} />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No messages yet. Send the first text below.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
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
                          'max-w-[75%] rounded-xl px-3 py-2 text-sm',
                          msg.direction === 'outbound'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-900 shadow-sm',
                        )}
                      >
                        {msg.body}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 px-1">
                        <span className="text-[10px] text-slate-400">
                          {format(parseISO(msg.created_at), 'h:mm a')}
                        </span>
                        {msg.direction === 'outbound' && msg.status === 'delivered' && (
                          <>
                            <CheckCheck size={12} className="text-emerald-500" />
                            <span className="text-[10px] text-emerald-500">Delivered</span>
                          </>
                        )}
                        {msg.direction === 'outbound' && msg.status === 'failed' && (
                          <>
                            <AlertCircle size={12} className="text-red-500" />
                            <span className="text-[10px] text-red-500">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Compose */}
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <Button size="sm" onClick={handleSend} loading={sending} disabled={!body.trim()}>
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

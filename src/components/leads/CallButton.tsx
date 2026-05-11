import { useEffect, useRef, useState } from 'react';
import { Phone, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { updateLead } from '@/lib/queries/leads';
import { formatPhone } from '@/lib/utils';
import type { Lead } from '@/lib/types';

interface CallButtonProps {
  phone: string;
  leadId: string;
  leadCreatedAt?: string;
  firstResponseAt?: string | null;
  onFirstResponse?: () => void;
}

function CallButton({
  phone,
  leadId,
  leadCreatedAt,
  firstResponseAt,
  onFirstResponse,
}: CallButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function recordFirstResponse() {
    if (firstResponseAt) return;
    const now = new Date().toISOString();
    const responseSeconds = leadCreatedAt
      ? Math.round(
          (new Date(now).getTime() - new Date(leadCreatedAt).getTime()) / 1000,
        )
      : null;
    try {
      await updateLead(leadId, {
        first_response_at: now,
        response_time_seconds: responseSeconds,
      } as Partial<Lead>);
      onFirstResponse?.();
    } catch {
      // noop — first response tracking is best-effort
    }
  }

  function handleCall() {
    setOpen(false);
    recordFirstResponse();
    window.location.href = `tel:${phone}`;
  }

  function handleText() {
    setOpen(false);
    // Scroll to the in-app message thread input and focus it. Uses the company
    // SMS number (Signal House), not the user's personal phone.
    const input = document.getElementById('message-thread-input');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Slight delay so scroll completes before focus visually engages.
      setTimeout(() => (input as HTMLTextAreaElement).focus(), 350);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Phone size={14} />
        {formatPhone(phone)}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCall}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Phone size={14} className="text-emerald-600" />
            Call Lead
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleText}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare size={14} className="text-emerald-600" />
            Text Lead
          </button>
        </div>
      )}
    </div>
  );
}

export { CallButton };

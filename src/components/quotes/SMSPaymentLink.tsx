import { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { sendMessage } from '@/lib/queries/messages';
import { formatCurrency } from '@/lib/utils';

interface SMSPaymentLinkProps {
  quoteId: string;
  leadId: string;
  leadPhone: string;
  total: number;
  orgId: string | null;
}

function SMSPaymentLink({ quoteId, leadId, leadPhone, total, orgId }: SMSPaymentLinkProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const paymentUrl = `${window.location.origin}/q/${quoteId}`;
      const body = `Your turf installation quote for ${formatCurrency(total)} is ready for payment: ${paymentUrl}`;
      await sendMessage({
        lead_id: leadId,
        org_id: orgId,
        to_number: leadPhone,
        body,
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleSend}
      loading={sending}
      disabled={sent}
    >
      {sent ? <Check size={14} /> : <MessageSquare size={14} />}
      {sent ? 'Link Sent' : 'Text Payment Link'}
    </Button>
  );
}

export { SMSPaymentLink };

import { useState } from 'react';
import { Gift, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createReferral } from '@/lib/queries/referrals';

interface ReferralRequestProps {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  orgId: string | null;
}

function ReferralRequest({ leadId, leadName, leadPhone, orgId }: ReferralRequestProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const referralUrl = `${window.location.origin}/refer/${leadId}`;

  async function handleSend() {
    if (!leadPhone) return;
    setSending(true);
    try {
      await createReferral({
        referrer_lead_id: leadId,
        org_id: orgId,
        reward_amount: 250,
      });

      const body = `Thanks for your amazing review! Know someone who wants a perfect yard? Share this link and they'll get $250 off: ${referralUrl}`;
      window.open(`sms:${leadPhone}?body=${encodeURIComponent(body)}`);
      setSent(true);
    } catch {
      setSending(false);
    }
  }

  return (
    <Card className="mt-4 border-emerald-200 bg-emerald-50">
      <div className="flex items-center gap-2">
        <Gift size={18} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-emerald-900">
          Know someone who wants a perfect yard?
        </h3>
      </div>
      <p className="mt-2 text-sm text-emerald-700">
        Refer a friend and they get $250 off their project.
      </p>
      {sent ? (
        <p className="mt-3 text-sm font-medium text-emerald-600">
          Referral link sent to {leadName}!
        </p>
      ) : (
        <Button
          size="sm"
          onClick={handleSend}
          loading={sending}
          disabled={!leadPhone}
          className="mt-3"
        >
          <Send size={14} />
          Send Referral Link
        </Button>
      )}
    </Card>
  );
}

export { ReferralRequest };

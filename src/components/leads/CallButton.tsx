import { Phone } from 'lucide-react';
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
  async function handleClick() {
    if (!firstResponseAt) {
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
        // noop
      }
    }
  }

  return (
    <a href={`tel:${phone}`} onClick={handleClick}>
      <Button variant="secondary" size="sm">
        <Phone size={14} />
        {formatPhone(phone)}
      </Button>
    </a>
  );
}

export { CallButton };

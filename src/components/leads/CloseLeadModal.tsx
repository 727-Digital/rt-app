import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { updateLead } from '@/lib/queries/leads';
import { cn } from '@/lib/utils';

interface CloseLeadModalProps {
  leadId: string;
  currentStatus: string;
  onClose: () => void;
  onClosed: () => void;
}

const LOSS_REASONS = [
  'Price too high',
  'Went with competitor',
  'Changed mind / no longer interested',
  'Timing not right',
  "Couldn't reach customer",
  'Other',
];

function CloseLeadModal({ leadId, onClose, onClosed }: CloseLeadModalProps) {
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [lossNotes, setLossNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!outcome) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { status: 'closed' };
      if (outcome === 'lost') {
        updates.loss_reason = lossReason === 'Other' ? customReason : lossReason;
        updates.loss_notes = lossNotes || null;
      }
      await updateLead(leadId, updates);
      onClosed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Close Lead">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Outcome</label>
          <div className="flex gap-3">
            <button
              onClick={() => setOutcome('won')}
              className={cn(
                'flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition-colors',
                outcome === 'won'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              Won
            </button>
            <button
              onClick={() => setOutcome('lost')}
              className={cn(
                'flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition-colors',
                outcome === 'lost'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              Lost
            </button>
          </div>
        </div>

        {outcome === 'lost' && (
          <>
            <Select
              label="Loss Reason"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
            >
              <option value="">Select a reason...</option>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>

            {lossReason === 'Other' && (
              <Input
                label="Custom Reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter reason..."
              />
            )}

            <Textarea
              label="Notes"
              value={lossNotes}
              onChange={(e) => setLossNotes(e.target.value)}
              rows={3}
              placeholder="Additional context..."
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={saving}
            disabled={
              !outcome ||
              (outcome === 'lost' && !lossReason) ||
              (outcome === 'lost' && lossReason === 'Other' && !customReason)
            }
          >
            Close Lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { CloseLeadModal };

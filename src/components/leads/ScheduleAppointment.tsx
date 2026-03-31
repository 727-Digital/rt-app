import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { createAppointment } from '@/lib/queries/appointments';
import { createFollowUp } from '@/lib/queries/follow_ups';
import { updateLead } from '@/lib/queries/leads';

interface ScheduleAppointmentProps {
  leadId: string;
  orgId: string | null;
  leadName: string;
  onScheduled: () => void;
  open: boolean;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];

function ScheduleAppointment({
  leadId,
  orgId,
  leadName,
  onScheduled,
  open,
  onClose,
}: ScheduleAppointmentProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function getEndTime() {
    if (!date || !time) return '';
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60000);
    return end.toTimeString().slice(0, 5);
  }

  async function handleSubmit() {
    if (!date || !time) return;
    setSaving(true);
    try {
      const startIso = new Date(`${date}T${time}`).toISOString();
      const endIso = new Date(
        new Date(`${date}T${time}`).getTime() + duration * 60000,
      ).toISOString();

      await createAppointment({
        lead_id: leadId,
        org_id: orgId,
        title: `Site Visit - ${leadName}`,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
      });

      const startDate = new Date(`${date}T${time}`);
      const formattedDate = format(startDate, 'EEEE, MMMM d');
      const formattedTime = format(startDate, 'h:mm a');
      const now = Date.now();

      const reminders: { offset: number; body: string }[] = [
        {
          offset: 48 * 60 * 60 * 1000,
          body: `Hi ${leadName}, just a reminder about your turf consultation on ${formattedDate} at ${formattedTime}. Looking forward to meeting you!`,
        },
        {
          offset: 24 * 60 * 60 * 1000,
          body: `Hey ${leadName}, your turf consultation is tomorrow at ${formattedTime}. See you then!`,
        },
        {
          offset: 2 * 60 * 60 * 1000,
          body: `Hi ${leadName}, we'll be at your property in about 2 hours for your turf consultation. See you soon!`,
        },
      ];

      const reminderPromises = reminders
        .filter((r) => startDate.getTime() - r.offset > now)
        .map((r) =>
          createFollowUp({
            lead_id: leadId,
            org_id: orgId,
            type: 'appointment_reminder',
            scheduled_for: new Date(startDate.getTime() - r.offset).toISOString(),
            channel: 'sms',
            body: r.body,
          }),
        );

      await Promise.all(reminderPromises);

      await updateLead(leadId, {
        status: 'site_visit_scheduled',
        site_visit_date: date,
      });

      onScheduled();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Appointment">
      <div className="flex flex-col gap-4">
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label="Start Time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {date && time && (
          <p className="text-sm text-slate-500">
            End time: {getEndTime()}
          </p>
        )}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes for this appointment..."
        />
        <Button onClick={handleSubmit} loading={saving} disabled={!date || !time}>
          <CalendarDays size={16} />
          Schedule
        </Button>
      </div>
    </Modal>
  );
}

export { ScheduleAppointment };

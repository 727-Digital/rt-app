import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { createAppointment } from '@/lib/queries/appointments';
import {
  createFollowUp,
  cancelPendingFollowUpsForLead,
} from '@/lib/queries/follow_ups';
import { updateLead } from '@/lib/queries/leads';
import { sendMessage } from '@/lib/queries/messages';
import { fetchLead } from '@/lib/queries/leads';

function firstNameOf(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || 'there';
}

type EventType = 'site_visit' | 'install';

interface ScheduleAppointmentProps {
  leadId: string;
  orgId: string | null;
  leadName: string;
  type?: EventType;
  onScheduled: () => void;
  open: boolean;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
  { label: 'All day', value: 480 },
];

// ---------------------------------------------------------------------------
// Quick picks. One tap fills date+time so reps can confirm in two taps total.
// ---------------------------------------------------------------------------

interface QuickPick {
  label: string;
  dayOffset: (now: Date) => number; // days from today
  hour: number;
}

function nextWeekday(now: Date, targetDow: number): number {
  // targetDow: 0 = Sun ... 6 = Sat
  const today = now.getDay();
  let offset = (targetDow - today + 7) % 7;
  if (offset === 0) offset = 7; // never "today"
  return offset;
}

const SITE_VISIT_PICKS: QuickPick[] = [
  { label: 'Tomorrow 9am', dayOffset: () => 1, hour: 9 },
  { label: 'Tomorrow 1pm', dayOffset: () => 1, hour: 13 },
  { label: 'Friday 9am', dayOffset: (n) => nextWeekday(n, 5), hour: 9 },
  { label: 'Mon 9am', dayOffset: (n) => nextWeekday(n, 1), hour: 9 },
];

const INSTALL_PICKS: QuickPick[] = [
  { label: 'Mon 8am', dayOffset: (n) => nextWeekday(n, 1), hour: 8 },
  { label: 'Wed 8am', dayOffset: (n) => nextWeekday(n, 3), hour: 8 },
  { label: 'In 1 week', dayOffset: () => 7, hour: 8 },
  { label: 'In 2 weeks', dayOffset: () => 14, hour: 8 },
];

function dateOnly(d: Date): string {
  // local YYYY-MM-DD (avoid timezone shift from toISOString)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------

function ScheduleAppointment({
  leadId,
  orgId,
  leadName,
  type = 'site_visit',
  onScheduled,
  open,
  onClose,
}: ScheduleAppointmentProps) {
  const isInstall = type === 'install';
  const defaultDuration = isInstall ? 240 : 60;
  const defaultHour = isInstall ? 8 : 9;
  const defaultDayOffset = isInstall ? 7 : 1;
  const picks = isInstall ? INSTALL_PICKS : SITE_VISIT_PICKS;

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(defaultDuration);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset to smart defaults each time the modal opens so the rep can usually
  // hit Confirm in one tap.
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() + defaultDayOffset);
    setDate(dateOnly(target));
    setTime(`${String(defaultHour).padStart(2, '0')}:00`);
    setDuration(defaultDuration);
    setNotes('');
  }, [open, defaultDayOffset, defaultHour, defaultDuration]);

  function applyPick(p: QuickPick) {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() + p.dayOffset(now));
    setDate(dateOnly(target));
    setTime(`${String(p.hour).padStart(2, '0')}:00`);
  }

  function getEndTime(): string {
    if (!date || !time) return '';
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60000);
    return format(end, 'h:mm a');
  }

  function summaryLine(): string {
    if (!date || !time) return '';
    const start = new Date(`${date}T${time}`);
    return `${format(start, 'EEEE, MMM d')} at ${format(start, 'h:mm a')}`;
  }

  async function handleSubmit() {
    if (!date || !time) return;
    setSaving(true);
    try {
      const startDate = new Date(`${date}T${time}`);
      const startIso = startDate.toISOString();
      const endIso = new Date(startDate.getTime() + duration * 60000).toISOString();

      // Reschedule cleanup: cancel any still-pending SMS reminders from the
      // previous time so the customer doesn't get two reminder chains. The
      // rep doesn't see this — it just works.
      await cancelPendingFollowUpsForLead(leadId, 'appointment_reminder');

      await createAppointment({
        lead_id: leadId,
        org_id: orgId,
        title: `${isInstall ? 'Install' : 'Site Visit'} - ${leadName}`,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
      });

      const formattedDate = format(startDate, 'EEEE, MMMM d');
      const formattedTime = format(startDate, 'h:mm a');
      const now = Date.now();

      const reminderTemplates = isInstall
        ? [
            {
              offset: 7 * 24 * 60 * 60 * 1000,
              body: `Hi ${leadName}, just a reminder that your turf install is scheduled for ${formattedDate} at ${formattedTime}. We'll be in touch with any prep details.`,
            },
            {
              offset: 24 * 60 * 60 * 1000,
              body: `Hi ${leadName}, your turf install is tomorrow at ${formattedTime}. See you then!`,
            },
            {
              offset: 2 * 60 * 60 * 1000,
              body: `Hi ${leadName}, our crew is heading your way and will be on site in about 2 hours for the turf install.`,
            },
          ]
        : [
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

      const reminderPromises = reminderTemplates
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
        ...(isInstall
          ? { status: 'install_scheduled', install_date: date }
          : { status: 'site_visit_scheduled', site_visit_date: date }),
      });

      // Immediate "you're confirmed" SMS to the customer. We need the lead's
      // phone — fetch fresh so we don't bake stale data into the modal.
      try {
        const lead = await fetchLead(leadId);
        if (lead.phone) {
          const first = firstNameOf(leadName);
          const what = isInstall ? 'turf install' : 'turf consultation';
          const startsAt = isInstall ? 'starting at ' : '';
          const confirmBody = `Hi ${first}, your ${what} is confirmed for ${formattedDate} ${startsAt}${formattedTime}. We'll text you reminders before.`;
          await sendMessage({
            lead_id: leadId,
            org_id: orgId,
            to_number: lead.phone,
            body: confirmBody,
          });
        }
      } catch (e) {
        console.error('Customer confirmation SMS failed:', e);
      }

      onScheduled();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const reminderCopy = isInstall
    ? 'Customer auto-reminders: 1 week, 1 day, and 2 hours before.'
    : 'Customer auto-reminders: 48 hours, 24 hours, and 2 hours before.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isInstall ? 'Schedule Install' : 'Schedule Site Visit'}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {picks.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPick(p)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Start time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {date && time && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start gap-2">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-emerald-900">{summaryLine()}</p>
                <p className="mt-0.5 flex items-center gap-1 text-emerald-700">
                  <Clock size={12} />
                  Ends {getEndTime()}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700/80">
                  <Bell size={12} />
                  {reminderCopy}
                </p>
              </div>
            </div>
          </div>
        )}

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything the crew should know?"
        />

        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!date || !time}
          size="md"
        >
          <CalendarDays size={16} />
          {isInstall ? 'Confirm Install' : 'Confirm Site Visit'}
        </Button>
      </div>
    </Modal>
  );
}

export { ScheduleAppointment };

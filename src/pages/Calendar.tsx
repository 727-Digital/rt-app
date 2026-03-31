import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Search,
} from 'lucide-react';
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { fetchAppointments, createAppointment } from '@/lib/queries/appointments';
import { updateLead } from '@/lib/queries/leads';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, Lead } from '@/lib/types';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 border-blue-300 text-blue-800',
  confirmed: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  completed: 'bg-slate-100 border-slate-300 text-slate-600',
  cancelled: 'bg-red-100 border-red-300 text-red-600',
  no_show: 'bg-amber-100 border-amber-300 text-amber-700',
};

function getGoogleCalendarUrl(appt: Appointment) {
  const start = parseISO(appt.start_time);
  const end = parseISO(appt.end_time);
  const formatGCal = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lead = appt.lead as Lead | undefined;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appt.title,
    dates: `${formatGCal(start)}/${formatGCal(end)}`,
    details: appt.notes || '',
    location: lead?.address || '',
  });
  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

export default function Calendar() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate],
  );
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAppointments({
        orgId: orgId ?? undefined,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      });
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  }, [orgId, weekStart, weekEnd]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function getAppointmentsForDayHour(day: Date, hour: number) {
    return appointments.filter((a) => {
      const start = parseISO(a.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  }

  function getAppointmentsForDay(day: Date) {
    return appointments.filter((a) => isSameDay(parseISO(a.start_time), day));
  }

  function getStatusBadgeVariant(status: string) {
    if (status === 'confirmed' || status === 'completed') return 'emerald' as const;
    if (status === 'cancelled') return 'red' as const;
    if (status === 'no_show') return 'amber' as const;
    return 'blue' as const;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add Appointment
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setCurrentDate((d) => (isMobile ? addDays(d, -1) : subWeeks(d, 1)))
          }
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCurrentDate(new Date())}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setCurrentDate((d) => (isMobile ? addDays(d, 1) : addWeeks(d, 1)))
          }
        >
          <ChevronRight size={16} />
        </Button>
        <span className="ml-2 text-sm font-medium text-slate-700">
          {isMobile
            ? format(currentDate, 'EEEE, MMM d, yyyy')
            : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : isMobile ? (
        <MobileDayView
          appointments={getAppointmentsForDay(currentDate)}
          onAppointmentClick={(a) => {
            if (a.lead_id) navigate(`/leads/${a.lead_id}`);
          }}
          getStatusBadgeVariant={getStatusBadgeVariant}
        />
      ) : (
        <Card className="mt-4 overflow-x-auto p-0">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 border-b border-slate-200">
              <div className="p-2" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'p-2 text-center text-sm font-medium',
                    isToday(day) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600',
                  )}
                >
                  <div>{format(day, 'EEE')}</div>
                  <div
                    className={cn(
                      'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm',
                      isToday(day) && 'bg-emerald-600 text-white',
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-slate-100">
                <div className="p-2 text-right text-xs text-slate-400">
                  {format(new Date().setHours(hour, 0), 'h a')}
                </div>
                {weekDays.map((day) => {
                  const dayAppts = getAppointmentsForDayHour(day, hour);
                  return (
                    <div
                      key={day.toISOString()}
                      className="min-h-[48px] border-l border-slate-100 p-0.5"
                    >
                      {dayAppts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            if (a.lead_id) navigate(`/leads/${a.lead_id}`);
                          }}
                          className={cn(
                            'mb-0.5 w-full truncate rounded border px-1.5 py-0.5 text-left text-xs',
                            STATUS_COLORS[a.status] ?? 'bg-blue-100 border-blue-300 text-blue-800',
                          )}
                        >
                          <div className="truncate font-medium">
                            {(a.lead as Lead | undefined)?.name ?? a.title}
                          </div>
                          <div className="text-[10px] opacity-75">
                            {format(parseISO(a.start_time), 'h:mm a')}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showAddModal && (
        <AddAppointmentModal
          orgId={orgId}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}

function MobileDayView({
  appointments,
  onAppointmentClick,
  getStatusBadgeVariant,
}: {
  appointments: Appointment[];
  onAppointmentClick: (a: Appointment) => void;
  getStatusBadgeVariant: (s: string) => 'emerald' | 'red' | 'amber' | 'blue';
}) {
  if (appointments.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-slate-400 py-12">
        No appointments for this day.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {appointments
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        )
        .map((a) => (
          <Card key={a.id} onClick={() => onAppointmentClick(a)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {(a.lead as Lead | undefined)?.name ?? a.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {format(parseISO(a.start_time), 'h:mm a')} -{' '}
                  {format(parseISO(a.end_time), 'h:mm a')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(a.status)}>
                  {a.status}
                </Badge>
                <a
                  href={getGoogleCalendarUrl(a)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-400 hover:text-emerald-600"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </Card>
        ))}
    </div>
  );
}

function AddAppointmentModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searching, setSearching] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);
      setSearchResults((data as Lead[]) ?? []);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }

  function getEndTime() {
    if (!date || !time) return '';
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60000);
    return end.toTimeString().slice(0, 5);
  }

  async function handleSubmit() {
    if (!selectedLead || !date || !time) return;
    setSaving(true);
    try {
      const startIso = new Date(`${date}T${time}`).toISOString();
      const endIso = new Date(
        new Date(`${date}T${time}`).getTime() + duration * 60000,
      ).toISOString();

      await createAppointment({
        lead_id: selectedLead.id,
        org_id: orgId,
        title: `Site Visit - ${selectedLead.name}`,
        start_time: startIso,
        end_time: endIso,
        notes: notes || null,
      });

      await updateLead(selectedLead.id, {
        status: 'site_visit_scheduled',
        site_visit_date: date,
      });

      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Appointment">
      <div className="flex flex-col gap-4">
        {!selectedLead ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                label="Search Lead"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name..."
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSearch}
                loading={searching}
                className="mt-6"
              >
                <Search size={14} />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {searchResults.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {lead.name}
                    </span>
                    <span className="ml-2 text-slate-500">{lead.address}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-900">
                {selectedLead.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLead(null)}
              >
                Change
              </Button>
            </div>
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
              <label className="text-sm font-medium text-slate-700">
                Duration
              </label>
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
              <p className="text-sm text-slate-500">End time: {getEndTime()}</p>
            )}
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes for this appointment..."
            />
            <Button
              onClick={handleSubmit}
              loading={saving}
              disabled={!date || !time}
            >
              <CalendarDays size={16} />
              Schedule
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

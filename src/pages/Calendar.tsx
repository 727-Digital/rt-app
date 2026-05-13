import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Hammer,
  MapPin,
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
import { ScheduleAppointment } from '@/components/leads/ScheduleAppointment';
import { fetchAppointments } from '@/lib/queries/appointments';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, Lead } from '@/lib/types';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

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
  // Two-step modal flow:
  //   1. pickerType ≠ null → "pick a lead" sheet (filtered by event type)
  //   2. lead chosen → ScheduleAppointment modal takes over (full flow:
  //      customer confirmation SMS, 48h/24h/2h reminders, team push)
  // This used to be a stripped-down "Add Appointment" that skipped all of
  // the above. Routing through ScheduleAppointment keeps every scheduling
  // path consistent.
  const [pickerType, setPickerType] = useState<'site_visit' | 'install' | null>(
    null,
  );
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerType('site_visit')}
          >
            <MapPin size={16} />
            Schedule Site Visit
          </Button>
          <Button
            size="sm"
            onClick={() => setPickerType('install')}
          >
            <Hammer size={16} />
            Schedule Install
          </Button>
        </div>
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

      {/* Step 1: lead picker (no lead chosen yet) */}
      {pickerType && !scheduleLead && (
        <LeadPickerModal
          eventType={pickerType}
          onClose={() => setPickerType(null)}
          onPick={(lead) => setScheduleLead(lead)}
        />
      )}

      {/* Step 2: full schedule flow (lead chosen) */}
      {pickerType && scheduleLead && (
        <ScheduleAppointment
          leadId={scheduleLead.id}
          orgId={scheduleLead.org_id ?? orgId}
          leadName={scheduleLead.name}
          type={pickerType}
          isReschedule={
            pickerType === 'install'
              ? !!scheduleLead.install_date
              : !!scheduleLead.site_visit_date
          }
          open
          onClose={() => {
            setScheduleLead(null);
            setPickerType(null);
          }}
          onScheduled={() => {
            setScheduleLead(null);
            setPickerType(null);
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

// Step-1 modal: pick which lead this appointment is for. Once picked, the
// parent component hands off to <ScheduleAppointment>, which is the same
// flow used from the lead detail page (customer SMS + reminders + team push).
function LeadPickerModal({
  eventType,
  onClose,
  onPick,
}: {
  eventType: 'site_visit' | 'install';
  onClose: () => void;
  onPick: (lead: Lead) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);

  // Load the 10 most recent leads on open, regardless of status. Tighter
  // pre-filtering by event type was previously hiding leads (e.g. a new
  // lead booked for a same-day install). Status filtering is the wrong
  // gate — let the user pick whoever they want.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!cancelled) setSearchResults((data as Lead[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live search-as-you-type, debounced so we don't slam the DB on every
  // keystroke. Empty query reverts to the 10 most recent leads. No need
  // to press Enter or click a magnifier — the placeholder previously
  // implied "Start typing" but typing didn't actually do anything.
  useEffect(() => {
    const q = searchQuery.trim();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        let query = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        if (q) query = query.ilike('name', `%${q}%`);
        const { data } = await query;
        setSearchResults((data as Lead[]) ?? []);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  return (
    <Modal
      open
      onClose={onClose}
      title={
        eventType === 'install' ? 'Schedule Install — Pick Lead' : 'Schedule Site Visit — Pick Lead'
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Input
            label="Search by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing a name..."
            autoFocus
            className="pr-9"
          />
          <Search
            size={14}
            className={cn(
              'absolute right-3 bottom-3 text-slate-400',
              searching && 'animate-pulse text-emerald-600',
            )}
          />
        </div>

        {/*
          No max-h here — the parent Modal already caps height at 90dvh and
          handles overflow-y. A nested scroll container collides with the
          iOS keyboard: dvh shrinks correctly but the inner max-h-[50vh]
          locks the list to half the FULL viewport, hiding rows under the
          keyboard with no way to reach them.
        */}
        <div className="flex flex-col gap-1">
          {searchResults.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No leads found.
            </p>
          ) : (
            searchResults.map((lead) => (
              <button
                key={lead.id}
                onClick={() => onPick(lead)}
                className="rounded-lg border border-slate-100 px-3 py-2.5 text-left text-sm hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="font-medium text-slate-900">{lead.name}</p>
                {lead.address && (
                  <p className="mt-0.5 text-xs text-slate-500">{lead.address}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

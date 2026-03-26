import { Mail, MessageSquare, User, Calendar, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import type { Lead, Notification } from '@/lib/types';

interface LeadTimelineProps {
  lead: Lead;
  notifications: Notification[];
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  detail?: string;
}

function buildEvents(lead: Lead, notifications: Notification[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: 'created',
    timestamp: lead.created_at,
    icon: User,
    iconColor: 'text-emerald-500',
    title: 'Lead created',
    detail: `Source: ${lead.source}`,
  });

  if (lead.site_visit_date) {
    events.push({
      id: 'site_visit',
      timestamp: lead.site_visit_date,
      icon: Calendar,
      iconColor: 'text-blue-500',
      title: 'Site visit',
    });
  }

  if (lead.install_date) {
    events.push({
      id: 'install',
      timestamp: lead.install_date,
      icon: Truck,
      iconColor: 'text-emerald-500',
      title: 'Installation',
    });
  }

  for (const n of notifications) {
    events.push({
      id: n.id,
      timestamp: n.sent_at,
      icon: n.channel === 'email' ? Mail : MessageSquare,
      iconColor: n.channel === 'email' ? 'text-blue-500' : 'text-amber-500',
      title: n.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: `${n.channel === 'email' ? 'Email' : 'SMS'} to ${n.recipient}`,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

function LeadTimeline({ lead, notifications }: LeadTimelineProps) {
  const events = buildEvents(lead, notifications);

  if (events.length === 0) return null;

  return (
    <div className="relative">
      {events.map((event, idx) => {
        const Icon = event.icon;
        const isLast = idx === events.length - 1;

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200',
                  event.iconColor,
                )}
              >
                <Icon size={14} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200" />}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p className="text-sm font-medium text-slate-900">{event.title}</p>
              {event.detail && (
                <p className="text-xs text-slate-500">{event.detail}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(event.timestamp)} ({formatRelativeTime(event.timestamp)})
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { LeadTimeline };

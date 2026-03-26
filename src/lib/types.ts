export type LeadStatus =
  | 'new_lead'
  | 'site_visit_scheduled'
  | 'site_visit_complete'
  | 'quote_sent'
  | 'quote_viewed'
  | 'quote_approved'
  | 'install_scheduled'
  | 'install_complete'
  | 'review_requested'
  | 'review_received'
  | 'closed';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  sqft: number;
  polygon_data: unknown;
  satellite_image_url: string | null;
  estimate_min: number;
  estimate_max: number;
  status: LeadStatus;
  assigned_to: string | null;
  notes: string | null;
  site_visit_date: string | null;
  install_date: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  description: string;
  details: string[];
  qty: number;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  lead_id: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
  notes: string | null;
  warranty_text: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
}

export interface QuoteView {
  id: string;
  quote_id: string;
  ip_address: string | null;
  user_agent: string | null;
  viewed_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  notify_sms: boolean;
  notify_email: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  lead_id: string | null;
  quote_id: string | null;
  channel: 'sms' | 'email';
  type: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  sent_at: string;
}

export interface Review {
  id: string;
  lead_id: string;
  status: 'pending' | 'sent' | 'clicked' | 'completed';
  review_url: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  lead_id: string;
  quote_id: string;
  amount: number;
  method: 'check' | 'zelle';
  status: 'pending' | 'received';
  received_at: string | null;
  notes: string | null;
  created_at: string;
}

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new_lead: { label: 'New Lead', color: 'bg-emerald-100 text-emerald-800' },
  site_visit_scheduled: { label: 'Site Visit Scheduled', color: 'bg-blue-100 text-blue-800' },
  site_visit_complete: { label: 'Site Visit Complete', color: 'bg-blue-100 text-blue-800' },
  quote_sent: { label: 'Quote Sent', color: 'bg-amber-100 text-amber-800' },
  quote_viewed: { label: 'Quote Viewed', color: 'bg-amber-100 text-amber-800' },
  quote_approved: { label: 'Quote Approved', color: 'bg-emerald-100 text-emerald-800' },
  install_scheduled: { label: 'Install Scheduled', color: 'bg-blue-100 text-blue-800' },
  install_complete: { label: 'Install Complete', color: 'bg-emerald-100 text-emerald-800' },
  review_requested: { label: 'Review Requested', color: 'bg-amber-100 text-amber-800' },
  review_received: { label: 'Review Received', color: 'bg-emerald-100 text-emerald-800' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-800' },
};

export const PIPELINE_STAGES: LeadStatus[] = [
  'new_lead',
  'site_visit_scheduled',
  'site_visit_complete',
  'quote_sent',
  'quote_viewed',
  'quote_approved',
  'install_scheduled',
  'install_complete',
  'review_requested',
  'review_received',
  'closed',
];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  google_review_url: string | null;
  pricing_min: number;
  pricing_max: number;
  payment_methods: string[];
  warranty_text: string | null;
  default_labor_rate_per_sqft: number | null;
  default_profit_split: number | null;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Territory {
  id: string;
  org_id: string;
  name: string;
  zip_codes: string[];
  is_active: boolean;
  created_at: string;
}

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

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'card' | 'ach' | 'check' | 'zelle' | 'financing';

export interface Lead {
  id: string;
  org_id: string;
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
  first_response_at: string | null;
  response_time_seconds: number | null;
  loss_reason: string | null;
  loss_notes: string | null;
  referral_source: string | null;
  updated_at: string;
  organization?: Organization;
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
  org_id: string;
  lead_id: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  status: QuoteStatus;
  expires_at: string | null;
  valid_until: string | null;
  notes: string | null;
  warranty_text: string | null;
  materials_cost: number;
  labor_cost: number;
  overhead_cost: number;
  profit_split_percent: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  organization?: Organization;
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
  org_id: string;
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
  org_id: string;
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
  org_id: string;
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
  org_id: string;
  lead_id: string;
  quote_id: string;
  amount: number;
  method: 'check' | 'zelle';
  status: 'pending' | 'received';
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
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

export type Message = {
  id: string;
  lead_id: string;
  org_id: string | null;
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'email';
  from_number: string | null;
  to_number: string | null;
  body: string;
  twilio_sid: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  created_at: string;
};

export type Appointment = {
  id: string;
  lead_id: string;
  org_id: string | null;
  team_member_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  google_event_id: string | null;
  reminder_48h_sent: boolean;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
};

export type Photo = {
  id: string;
  lead_id: string;
  org_id: string | null;
  type: 'before' | 'after' | 'progress' | 'aerial';
  url: string;
  caption: string | null;
  taken_by: string | null;
  created_at: string;
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

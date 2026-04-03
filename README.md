# TurfFlow (Reliable Turf CRM)

A full-stack CRM platform for artificial turf installation companies. Captures leads, manages the sales pipeline, generates quotes, collects reviews, and tracks financials — all from a single dashboard.

Built as a **multi-tenant SaaS** under the brand **TurfFlow**, currently powering [Reliable Turf](https://reliableturf.com).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| **Routing** | React Router v7 |
| **Backend** | Supabase (Auth, Postgres, Edge Functions, Realtime) |
| **SMS** | Twilio |
| **Email** | Resend |
| **Ads** | Facebook Conversions API (CAPI) |
| **Icons** | Lucide React |
| **Dates** | date-fns |
| **Mobile** | Capacitor 8 (iOS native wrapper) |
| **Hosting** | Vercel (web), Supabase Cloud (backend) |

---

## Architecture

```
┌─────────────────┐     POST /receive-lead     ┌──────────────────┐
│  Lovable Website │ ──────────────────────────▶│  Supabase Edge   │
│ reliableturf.com │                            │  Function        │
└─────────────────┘                            └────────┬─────────┘
                                                        │
┌─────────────────┐     Facebook Lead Ads               │
│  Meta / Instagram│ ───────────────────────────────────▶│
└─────────────────┘                                     │
                                                        ▼
                                               ┌──────────────────┐
                                               │  Supabase DB     │
                                               │  (Postgres)      │
                                               └────────┬─────────┘
                                                        │
                            ┌───────────────────────────┼───────────────────┐
                            │                           │                   │
                            ▼                           ▼                   ▼
                   ┌──────────────┐          ┌───────────────┐    ┌──────────────┐
                   │ Twilio SMS   │          │ Resend Email  │    │ FB CAPI      │
                   └──────────────┘          └───────────────┘    └──────────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │  React Dashboard │
                                               │  (Vercel)        │
                                               │  + iOS App       │
                                               └──────────────────┘
```

---

## Features

### Lead Management
- Inbound lead capture via website webhook and Facebook/Instagram Lead Ads
- Territory-based routing (zip code → org assignment)
- Kanban pipeline board with drag-and-drop
- 11-stage pipeline: `new_lead` → `contacted` → `site_visit_scheduled` → `site_visit_complete` → `quote_sent` → `quote_viewed` → `quote_approved` → `install_scheduled` → `install_complete` → `review_requested` → `closed`
- Realtime updates via Supabase subscriptions
- Lead timeline with full activity history

### Quoting
- Line-item quote builder with descriptions and pricing
- Public quote page (`/q/:quoteId`) — no auth required
- Quote view tracking (IP, user agent, timestamp)
- SMS + branded email delivery to customers
- Approve/reject flow for customers

### Communication
- SMS messaging via Twilio (team notifications + customer messages)
- Branded HTML email via Resend
- Click-to-call from lead detail
- Push notifications on iOS (deep links to leads/quotes)

### Reviews
- Automated Google review request flow
- QR code generation for review collection
- Review metrics dashboard

### Photos
- Before/after photo capture (camera on mobile, upload on web)
- Photo gallery per lead

### Calendar
- Appointment scheduling (site visits, installs)
- Calendar view with date navigation

### Financials
- Revenue tracking per lead/quote
- Cost tracking and margin analysis
- Profit analytics dashboard

### Multi-Tenant
- Organization-scoped data with Row Level Security (RLS)
- Custom branding per org (logo, colors, contact info)
- Territory management (zip code assignment)
- Team member management with role-based access
- White-label customer-facing pages

### iOS Native
- Face ID / Touch ID biometric auth
- Push notifications with deep linking
- Native status bar, splash screen, keyboard handling
- Safe area inset support

---

## Project Structure

```
reliable-turf/
├── src/
│   ├── main.tsx                    # Root: AuthProvider → OrgProvider → App
│   ├── App.tsx                     # React Router with lazy-loaded pages
│   │
│   ├── pages/
│   │   ├── Login.tsx               # Email/password sign in
│   │   ├── Signup.tsx              # New user registration
│   │   ├── Onboarding.tsx          # Org setup wizard (zip codes)
│   │   ├── Dashboard.tsx           # Kanban board, stats, win/loss
│   │   ├── Leads.tsx               # Lead list with filters/sort
│   │   ├── LeadDetail.tsx          # Single lead: timeline, messages, photos
│   │   ├── Quotes.tsx              # All quotes
│   │   ├── QuoteBuilder.tsx        # Create/edit quotes with line items
│   │   ├── Calendar.tsx            # Appointment calendar
│   │   ├── Financials.tsx          # Revenue, costs, margins
│   │   ├── Organizations.tsx       # Org profile, team, branding
│   │   ├── Settings.tsx            # User settings, territories
│   │   ├── Training.tsx            # Internal resources
│   │   └── public/
│   │       ├── QuoteView.tsx       # Customer quote page (no auth)
│   │       ├── ReviewLanding.tsx   # Google review redirect
│   │       └── JoinAsRep.tsx       # Sales rep application
│   │
│   ├── components/
│   │   ├── ui/                     # Button, Input, Card, Modal, Badge, etc.
│   │   ├── auth/                   # ProtectedRoute, OnboardingGuard
│   │   ├── layout/                 # Shell, Sidebar, Header, MobileNav
│   │   ├── dashboard/              # KanbanBoard, PipelineColumn, StatsCards
│   │   ├── leads/                  # LeadForm, Timeline, Messages, Photos
│   │   ├── quotes/                 # QuotePreview, LineItemEditor, PaymentQR
│   │   ├── reviews/                # ReviewDashboard, ReviewQRCard
│   │   ├── organizations/          # BrandAssets
│   │   └── settings/               # TerritoryManager
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx             # Auth context (user, orgId, role)
│   │   ├── useOrg.tsx              # Organization context
│   │   ├── useLeads.ts             # Leads + realtime subscriptions
│   │   ├── useQuotes.ts            # Quotes queries
│   │   ├── usePushNotifications.ts # iOS push registration + deep links
│   │   └── useBiometrics.ts        # Face ID / Touch ID
│   │
│   └── lib/
│       ├── supabase.ts             # Supabase client init
│       ├── types.ts                # All TypeScript interfaces & enums
│       ├── utils.ts                # Formatting (currency, phone, date)
│       ├── capacitor.ts            # Platform detection
│       ├── native-init.ts          # Native plugin initialization
│       └── queries/                # 11 query modules (leads, quotes, etc.)
│
├── supabase/
│   └── functions/
│       ├── _shared/                # Shared utilities
│       │   ├── supabase.ts         # Service role client
│       │   ├── twilio.ts           # sendSms()
│       │   ├── resend.ts           # sendEmail()
│       │   ├── branding.ts         # getOrgBranding(), brandedEmailHtml()
│       │   ├── facebook.ts         # CAPI: sendConversionEvent()
│       │   └── cors.ts             # CORS headers
│       │
│       ├── receive-lead/           # Webhook: website + Facebook Lead Ads
│       ├── send-notification/      # SMS + email alerts to team
│       ├── send-quote/             # Quote delivery to customer
│       ├── track-quote-view/       # Public quote view tracking
│       ├── request-review/         # Google review request
│       ├── fb-conversion/          # Facebook CAPI events
│       └── complete-onboarding/    # New org setup
│
├── ios/                            # Capacitor iOS project (Xcode)
├── public/                         # Static assets
├── capacitor.config.ts             # iOS native config
├── vite.config.ts                  # Build config
├── tsconfig.json                   # TypeScript config
└── package.json                    # Dependencies & scripts
```

---

## Routes

| Path | Page | Auth |
|------|------|------|
| `/login` | Sign in | Public |
| `/signup` | Create account | Public |
| `/join` | Rep application | Public |
| `/q/:quoteId` | Customer quote view | Public |
| `/review/:leadId` | Google review landing | Public |
| `/onboarding` | Org setup wizard | Protected |
| `/` | Dashboard (Kanban) | Protected |
| `/leads` | Leads list | Protected |
| `/leads/:id` | Lead detail | Protected |
| `/quotes` | Quotes list | Protected |
| `/quotes/new` | New quote | Protected |
| `/quotes/new/:leadId` | New quote for lead | Protected |
| `/quotes/:id/edit` | Edit quote | Protected |
| `/calendar` | Appointments | Protected |
| `/financials` | Financial analytics | Protected |
| `/organizations` | Org settings | Protected |
| `/settings` | User settings | Protected |
| `/training` | Resources | Protected |

---

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `receive-lead` | POST webhook | Captures leads from website form + Facebook Lead Ads |
| `send-notification` | Internal call | Dispatches SMS + email notifications to team members |
| `send-quote` | Internal call | Delivers quote to customer via SMS + email |
| `track-quote-view` | POST from public page | Records when customer views their quote |
| `request-review` | Internal call | Sends Google review request to customer |
| `fb-conversion` | Internal call | Sends conversion events to Facebook CAPI |
| `complete-onboarding` | POST from onboarding | Creates org, team member, and territory records |

---

## Data Flow

```
1. LEAD CAPTURE
   Website/Facebook → receive-lead → DB insert → send-notification → Team SMS + Email

2. QUOTING
   Admin creates quote → send-quote → Customer SMS + Email
   Customer opens link → track-quote-view → Team notified
   Customer approves → Lead status updated

3. POST-INSTALL
   Admin triggers → request-review → Customer SMS + Email → Google review link

4. FACEBOOK TRACKING
   Lead captured → fb-conversion (Lead event)
   Quote approved → fb-conversion (Purchase event) → Audience sync
```

---

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npm run cap:sync     # Build web + sync to iOS (run before Xcode)
npm run cap:open     # Open Xcode project
npm run cap:run      # Build + run on device/simulator
```

---

## Environment Variables

```bash
VITE_SUPABASE_URL=https://exigoosajrdbqjqtricl.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Edge function secrets (set via Supabase dashboard):
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `RESEND_API_KEY`
- `FB_PAGE_ACCESS_TOKEN`, `FB_PIXEL_ID`, `FB_VERIFY_TOKEN`

---

## Deployment

- **Web**: Push to `main` on GitHub → Vercel auto-deploys
- **Edge Functions**: `supabase functions deploy <function-name> --no-verify-jwt`
- **iOS**: `npm run cap:sync` → Open Xcode → Archive → App Store Connect

---

## Repository

- **GitHub**: [727-Digital/reliable-turf](https://github.com/727-Digital/reliable-turf) (private)
- **Org**: 727 Digital

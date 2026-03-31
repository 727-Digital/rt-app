# ReliableTurf — Reliable Turf Lead Management & Quoting CRM

> Global rules in ~/.claude/CLAUDE.md apply automatically. This file adds project-specific details only.

## Project Overview
Web-based CRM for Reliable Turf (artificial turf installation). Captures leads from reliableturf.com (Lovable), manages pipeline from lead → site visit → quote → install → review collection.

## Tech Stack
- React 19 + Vite 7 + TypeScript 5.9 + Tailwind 4
- Supabase (Auth, Postgres, Edge Functions, Realtime)
- Twilio (SMS notifications)
- Resend (transactional email)
- Lucide React (icons)
- React Router v7
- Deployed on Vercel

## Architecture
- Lovable site (reliableturf.com) → webhook POST → Supabase Edge Function → DB
- Admin dashboard (this app) — auth-protected
- Public quote page at /q/:quoteId — no auth, tracks views
- Realtime subscriptions on leads + quotes tables

## Supabase
- Project ID: exigoosajrdbqjqtricl
- Region: us-east-1
- All tables have RLS enabled
- Edge Functions: receive-lead, send-notification, send-quote, track-quote-view, request-review

## Conventions
- Light theme (not dark) — emerald accent, slate neutrals
- Mobile-first (Andy uses this on-site on his phone)
- Custom Tailwind components, NO shadcn
- cn() utility for className merging
- Pages lazy-loaded via React.lazy + Suspense
- No comments/docstrings unless critical
- Pipeline stages are a Postgres enum — changes require migration

## Commands
```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run cap:sync   # Build + sync to iOS (ALWAYS run before Xcode)
npm run cap:open   # Open Xcode project
npm run cap:run    # Build + run on device/simulator
```

## iOS / Capacitor
- Bundle ID: com.reliableturf.app
- Capacitor 8 with SPM (no CocoaPods)
- Native plugins: StatusBar, SplashScreen, Keyboard, PushNotifications, App
- Custom local BiometricAuth plugin (BiometricAuthPlugin.swift) — no npm dependency
- PrivacyInfo.xcprivacy is in the build target — keep it updated if adding SDKs
- After ANY web code change: `npm run cap:sync` before iOS testing
- Never modify ios/App/Podfile or .xcodeproj directly unless necessary
- Push notification tokens stored in `device_tokens` table
- Biometric preference stored in localStorage (`biometric_enabled`)

## Project-Specific Rules
- Quote format: flat price with description listing installation steps + warranties
- Pricing: $10-$12.25/sqft range for estimates, final quote is a single flat number
- Payment: check or Zelle only (no card processing)
- Customer's polygon drawing from Lovable is rough estimate only — Andy confirms onsite
- Notifications go to team_members with notify_sms/notify_email flags

## Mistakes & Corrections
(Updated as corrections happen)

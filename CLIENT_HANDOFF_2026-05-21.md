# Rosy Recruits — Client Handoff

**Date:** 2026-05-21
**Demo URL:** https://rosy-demo.vercel.app
**Status:** Production-ready demo, all 5 admin accounts active, fresh DB (test data wiped).

---

## How to test

1. Open `https://rosy-demo.vercel.app` in a fresh tab (close existing Rosy tabs first, or hard-reload).
2. **As a worker / vendor:** Sign up with any email, complete onboarding, explore the app.
3. **As admin:** Sign in with `tonya@pronocoders.com` (your account is already an admin).
4. **Demo banner:** A small amber "Demo / staging environment" callout sits in the bottom-left of every screen. Dismissible per browser session. Tells testers any data they enter is safe to throw away and outgoing emails route to a staging inbox (`ben@pronocoders.com`).
5. **Logout:** Header dropdown → Log out, sidebar button, OR navigate to `/#logout` from anywhere.

---

## What got fixed / built this session

Grouped by user-visible area. ~130 distinct fixes across the codebase, 50+ commits to production.

### 🔑 Auth & Logout
- `/#logout` works from any page (clean bookmark + in-app deeplink). Hard-escape after 3s if anything stalls — user can never get trapped on the spinner.
- Sign-out clears all Supabase tokens from local + session storage, signs out server-side, redirects to marketing.
- Signup with email confirmation enabled now auto-flips to login mode after sending the confirmation, with a clear toast telling the user what to do next.
- Forgot-password sends a **branded Rosy Recruits email** via Postmark (not Supabase's default unbranded message).
- Admin "Send password reset" button on any user card uses the same branded pipeline.

### 📝 Worker & Vendor Onboarding
- Every form field now persists to Supabase. Previously most of it was silently discarded.
- Picture / logo uploads → Supabase Storage (public URLs, not 5MB base64 blobs in the DB).
- Signature pad → uploads PNG to private storage bucket, 7-day signed URL.
- Terms-acceptance signature + timestamp persists to `rr_profiles.terms_accepted` + `terms_accepted_at`.
- W-9 SSN/EIN is **hashed client-side** (SHA-256) before storage. Only the last 4 digits are stored in clear text. Raw TIN never leaves the browser.
- Role pick (worker vs vendor) now sticks the first time — previously a trigger silently downgraded vendors to workers.
- Required fields validated before submit: first/last name, phone, address, bio (≥20 chars), terms signature. Vendor also requires company name. Worker also requires title/specialty.
- Continue button shows "Saving…" + UI advances to dashboard immediately, with DB writes in the background. No more multi-second "saving" hang.
- Logo bigger + centered on every signup/onboarding screen.
- Terms checkbox is now a prominent teal-bordered click target on signup AND on the terms modal signature page.

### 👤 Profile & Settings
- Settings tabs persist in URL (`/#app/settings:account`) — refresh keeps you on the right tab.
- Profile editing now writes through to the DB (was previously override-only, refresh lost it).
- Email shown read-only with a "Email me a reset link" button — uses the same Postmark flow.
- Notifications: persist to `rr_profiles.email_notifications` jsonb.
- Privacy toggles (Hide old ratings, Block search engines): persist per-user to localStorage.
- Payouts: Real Stripe Connect status — shows "Not connected" with a Connect button OR "Connected · Payouts to bank ••••XXXX" with the actual last 4 digits.
- Account → "Email me a reset link" uses the branded reset endpoint.
- Danger zone: Delete account requires typing "delete", soft-deletes the profile, signs out, redirects to marketing.
- Photo upload cap: 5MB (was unlimited).

### ✈️ NEW: Travel addresses (worker-only)
Workers can save multiple addresses with optional start/end dates so when they're working out of town, the platform automatically uses their effective city.

- Settings → Profile → scroll to **Travel addresses** section.
- Default "Home" address auto-created from onboarding.
- "Add address" modal uses Google Places autocomplete — city/state/country/lat/lng auto-populate.
- Status badges per row: **Default**, **Active today** (teal highlight), **Upcoming**, **Ended**.
- On any day inside an active range:
  - Worker's gig browser filters to that city automatically.
  - Travel banner appears at the top of the gig browser: *"Travelling — gigs filtered to NYC · Aug 5 → Aug 20"* with a Manage button.
  - Admin opens the worker's card → sees *"Travelling today: Summer in LA · Los Angeles (until 2026-08-25)"* row.

### 🗂️ Admin — User management
- Admin user-detail modal shows **every field from the DB**: photo, phone, title, company, location, street, ZIP, hourly/vendor rate, website, skills, services, terms-accepted date, W-9 on file, business hours, signature image, travel-today indicator.
- No more fabricated "Freelancer · Chicagoland-based floral studio" placeholders — honest empty states when fields are unset.
- Edit Profile modal now writes through to `rr_profiles` + `rr_vendor_profiles` / `rr_worker_profiles` with optimistic UI.
- Verify account → updates DB + sends Postmark `verified` welcome email.
- Activate / Deactivate user → DB write + live UI update.
- Send password reset → branded Postmark email.
- Invite user → real Postmark `invite-user` email sent (was a toast lie before).
- Bulk approve / dispute / mark-active actions all wired correctly.

### 📅 Events & Gigs
- All stat tiles read live from `window.RosyData` — no more hardcoded "9 / 6 / 32 / 7" demo numbers.
- Misleading hardcoded delta percentages (+6%, -22%, +14%) removed.
- Event creation required fields: name, description, date, start, end, venue.
- Event publish validates: date not in past, end time > start time, end date >= start date for multi-day.
- Event edit validates: name + date required, real error toasts on DB failure.
- Gig creation required fields: event, type, date, start + end times, hourly rate > 0, spots > 0.
- Gig date can't be in the past (date input `min={today}` + submit guard).
- Gig end time must be > start time within the same day (overnight gigs allowed).
- "New Event" / "Post a gig" / "Create gig" buttons all have double-click guards + "Publishing…" / "Creating…" labels during submit.
- "Recent auto-builds" in Build my team — reads real events filtered by current vendor.
- "Build my team" wizard recommended workers — picks the top 4 real workers by rating + gig count (was hardcoded IDs).
- Applications tab: real applications from `rr_gig_applications`, not seed data. Approve/Reject sends the worker the `worker-confirmed` / `worker-rejected` Postmark email.

### 💬 Inbox
- No more ghost auto-reply ("Got it — talk soon." that appeared 900ms after every message).
- Compose modal is searchable across all real users (name/email/company), not capped at first 8.
- Pre-filter the compose modal when arriving via a "Message" button on another page.
- File attach: real upload to private `rr-attachments` bucket with 30-day signed URL. Attachment chip appears next to the input until the message is sent. Included in `rr_messages.attachment_url/name/type` + rendered in the bubble.
- Mute thread → persists to localStorage so bell badge respects it.
- Archive thread → writes `is_visible=false` to `rr_conversations`.
- Report thread → sends an admin email via Postmark to `trust@rosyrecruits.com`.

### 💰 Payments & Disputes
- Send Receipt button on a paid invoice now sends a real branded Postmark email to the worker.
- File a dispute now inserts a real row into `rr_disputes` with reason + description + raised_by + worker/vendor IDs.
- Mediate modal Split 75/25 + Release to Worker buttons hit the real DB; modal stays open on error so admin can retry.
- Disputes thread modal: empty state when no real messages, removes the hardcoded fake conversation.

### 📧 Email pipeline
- All templates send via Postmark with full variable substitution (`{{first_name}}`, `{{event_name}}`, etc).
- New `/api/auth/password-reset` endpoint — branded Rosy reset emails.
- New `/api/contact` endpoint — marketing contact form sends to topic-specific inboxes (sales / help / press / careers).
- PageEmails "Send test email" button does a real Postmark send with the current draft + sample vars.
- Admin invite, worker confirmed/rejected, dispute filed, receipt — all wired to the right slug.
- **Demo redirect:** Every outbound email currently routes to `ben@pronocoders.com` with the original recipient shown in the subject. Flip this when going live (see Question #2 below).

### 🌐 Marketing pages
- "By the numbers" section reads live counts from real DB (workers, vendors, completed gigs, paid out). Section hides entirely when all are zero — no fake numbers.
- Hero stat strip uses real counts; hides when nothing to brag about.
- Pricing page worker take rate (92%) reads from `rr_platform_settings.platform_fee_percent` — admin can change it.
- Pricing "Talk to sales" button on Enterprise tier now routes to contact form.
- Press page: empty array + "No press yet — pitch a story" CTA. Real entries can be added when coverage lands.
- Contact form persists to a real Postmark send. Sending state + error toasts.
- Removed all hardcoded Chicago/Chicagoland references (footer "Made in Chicago" kept per your call).
- All nav anchors keyboard-focusable (`href` + preventDefault'd onClick).

### 🔔 Notifications
- Bell panel scoped to current user (was leaking all users' notifications).
- Click a notification → marks read in DB + jumps to the right deep link.
- Notification dropdown responsive on mobile.
- Site-wide demo / staging banner mentioned above.

### ❓ NEW: FAQ admin
- New `/#app/faqs` admin page (sidebar nav: Content → FAQs).
- Full CRUD against `rr_faqs`: add, edit, show/hide, delete.
- Marketing /help page reads from this table — visitor-facing FAQ is now editable.

### ⚙️ Platform Settings (admin)
- Reads + writes `rr_platform_settings` (21 keys: rate_assist, rate_lead, rate_strike, platform_fee_percent, preauth_hold_percent, etc).
- Save only enabled when something changed; persists per-key.

### 🎨 Site Content + Gallery + Email Templates
- Site content: edits persist to `rr_site_content`.
- Email templates: edits persist to `rr_email_templates` + work via the send-email function.
- Gallery: uploads persist to localStorage (will migrate to Supabase Storage later).

### 📊 Analytics
- Revenue + Active users tiles now show "All time" with last-30-days as a sublabel.
- Date strip auto-computes (was hardcoded "May 1st – June 1st 2026").

### 🗺️ Google Maps Places
- All address inputs now use Google Places Autocomplete when the user types.
- Selecting a suggestion auto-fills city / state / country / lat / lng.
- Key is restricted to HTTP referrers + Places + Geocoding APIs.

### ♿ Accessibility + Mobile
- Modals trap Escape key.
- All icon-only buttons have aria-labels.
- Form inputs have correct autoComplete hints (name, email, tel, postal-code, address-level1/2, given-name, family-name).
- ZIP + SSN/EIN inputs use `inputMode="numeric"` for mobile keyboards.
- Toggle pill buttons have `aria-pressed`.
- FAQ accordion has `aria-expanded`.
- Phone validator allows 7–15 digits (international friendly).
- Settings sidebar grid handles narrow viewports (was breaking <360px).
- Notification panel shrinks to viewport on phones.
- Image alt text on all `<img>` tags.

### 🛡️ Reliability
- Root-level **error boundary** — any unhandled render error shows a friendly recovery screen + auto-reports to `/api/dev-issue` (was white-screening).
- Format helpers handle NaN / invalid dates gracefully.
- Double-submit guards on every Save / Submit / Apply / Withdraw / Approve / Reject button.
- Optimistic local state now rolls back on DB error so the UI doesn't lie.
- Toast success now only fires inside `try` blocks — error toasts fire on catch with the real message.

---

## Form validation rules (now enforced)

| Form | Required fields | Constraints |
|---|---|---|
| **Worker signup** | First name, Last name, Phone, Address, Title/Specialty, Bio (≥20 chars), Terms signature | Phone 7–15 digits, photo ≤5MB |
| **Vendor signup** | First name, Last name, Phone, Studio address, Company/Studio name, Studio description (≥20 chars), Terms signature | Phone 7–15 digits, logo ≤5MB |
| **Event creation** | Name, Description, Date, Start time, End time, Venue | Date ≥ today, End > Start, EndDate ≥ Date |
| **Gig creation** | Event, Type, Date, Start, End, Hourly rate, Spots | Rate > 0, Spots > 0, Date ≥ today |
| **Password reset** | Valid email format | — |
| **Contact form** | Name, Email, Message | Message ≤5000 chars |
| **Travel address** | Address | Start ≥ today, End ≥ Start |

Text caps:
- Bio: 1000 chars
- Studio description: 2000 chars
- Dispute description: 2000 chars
- Gig description: 2000 chars
- Contact message: 5000 chars

---

## Live data sources

Every screen reads from real Supabase tables:

| Surface | Table |
|---|---|
| Users (workers/vendors/admins) | `rr_profiles` + `rr_vendor_profiles` + `rr_worker_profiles` |
| Events + Venues + Gigs | `rr_events`, `rr_venues`, `rr_gigs` |
| Applications + Payments | `rr_gig_applications` |
| Messages | `rr_conversations`, `rr_messages` |
| Notifications | `rr_notifications` |
| Disputes | `rr_disputes` |
| FAQs | `rr_faqs` |
| Platform settings (rates, fees) | `rr_platform_settings` |
| Audit + Change log | `rr_audit_log`, `rr_change_log` |
| Site content | `rr_site_content` |
| Email templates | `rr_email_templates` |
| Photos / logos / event images | Supabase Storage (`rr-avatars`, `rr-logos`, `rr-event-images`, public) |
| Signatures / W-9 / Attachments | Supabase Storage (`rr-signatures`, `rr-attachments`, private with signed URLs) |

---

## Questions for the client (Tonya)

Need confirmation before we flip from demo → production.

### 1. Form validation rules
The rules in the table above are now enforced. **Are any of these wrong?**
- Should phone be **US-only** (10 digits) instead of international (7–15)?
- Should bio be **shorter or longer** than 20 chars minimum?
- Should events/gigs be allowed in the past (e.g. for back-dating completed work)?
- Anything missing — fields the client expects us to require?

### 2. Demo mode → production switch
Three things currently in demo mode that need a "real" decision:
- **Outbound emails** route to `ben@pronocoders.com` — when do we want to flip these to the real recipients? (i.e. when is launch?)
- **Demo / staging banner** in the bottom-left — keep it on the staging domain forever? Remove on the production domain?
- **Stripe in test mode** — has Tonya created a real Stripe account yet? When do we switch to live keys?

### 3. Email pipeline
- **Sending domain:** Currently `noreply@rosyrecruits.com`. Is this domain owned + ready to be verified in Postmark? Or do we use a different one?
- **Inbound emails:** Contact form routes to `sales@`, `help@`, `press@`, `careers@rosyrecruits.com`. Are these mailboxes set up?
- **Trust & safety reports:** Currently route to `trust@rosyrecruits.com` — does that mailbox exist?
- **Product feedback (notify-me etc):** Currently `product@rosyrecruits.com` — does that mailbox exist?

### 4. Pricing tiers
The 4 tiers (Starter / Studio / Pro / Enterprise) and platform fee % are placeholder marketing copy. Do these need revising? When the client signs the first paid customer, we'll know real numbers.

### 5. Stripe Connect
- Has Tonya set up a Stripe Connect platform account?
- Worker payouts currently won't actually pay anyone until that's done. Real test path requires a Stripe test connect link.

### 6. Press page
Currently empty with a "pitch a story" CTA. Tonya — do you have any real coverage to add (real outlet, real headline, real URL)?

### 7. Travel addresses — UX
The new feature lets a worker save multiple addresses with date ranges. **Is the intended behaviour:**
- Worker's gig-browser filters automatically to the active travel city ✅ (this is built)
- When the date range ends, automatically revert to home address ✅ (built)
- Admins can see "Travelling today: NYC until Aug 25" on the worker card ✅ (built)
- **Future thought:** should vendors get notified when a worker they've worked with is travelling to their area? Worth building?

### 8. W-9 / tax handling
- We currently hash the SSN/EIN with SHA-256 client-side and store only the last 4 digits + the hash. The full TIN never reaches the DB.
- **Is this acceptable for compliance?** For real 1099 generation we'll need the full TIN somewhere — likely encrypted at rest via a separate flow (e.g. Stripe Identity verifications, or a vendor like Pinwheel).
- Should the worker upload a signed W-9 PDF on signup instead of typing the data in?

### 9. Photo storage retention
- Photos + logos in public Supabase Storage buckets. Worker uploads a photo → public URL → anyone with the URL can view (no auth required).
- Acceptable? Or should they be private with signed URLs (like signatures + attachments)?

### 10. Account deletion
- Currently "Delete account" soft-deletes (sets `status='inactive'`, signs out).
- Real GDPR-compliant flow would hard-delete all rows + auth user within 30 days.
- Is the soft-delete sufficient for the demo? When do we want hard delete wired?

### 11. Admin scope
- Currently ALL admins see everything — there's no per-admin permission. The admin sidebar has a Notifications-Rules / Broadcast / Audit / Change Log section.
- For the first hires, is one-permission-fits-all OK? Or do we need a roles matrix?

### 12. Worker availability
- Workers can set travel addresses with date ranges (just shipped).
- We do NOT currently let them mark themselves "unavailable" for arbitrary dates (vacation, no-school days, etc).
- Is that a Phase 2 feature, or needed for launch?

### 13. Vendor business hours
- Vendors can save day-by-day business hours on their profile.
- Currently displayed on the admin user-detail modal.
- **Is this surfaced anywhere customer-facing?** It's collected but maybe never shown to the worker / public.

### 14. Stripe payouts cadence
- Marketing page says "Paid within 48 hours". Is that the actual schedule once Stripe is live? Could be configurable to weekly / Friday / etc.

### 15. Cookie banner
- We have a demo-mode banner but no GDPR cookie consent banner.
- Required for EU users; lower priority for a US-focused launch but worth knowing the launch geo.

---

## Known remaining items (not blocking demo)

- **Per-day vendor business hour times** (Mon–Sun start/end inputs use uncontrolled defaultValue). The "Show business hours" toggle saves; individual times don't.
- **Worker availability calendar** (separate from travel addresses).
- **Cookie consent banner** (GDPR/CCPA).
- **Audit log + change log retention cron** (these tables grow unbounded — not breaking anything today).
- **Real radius filter on worker gig posts** — currently a substring city match. Needs geocoded venues to do proper radius.
- **Photo storage migration** for legacy data URL rows in `rr_profiles.avatar_url` — new uploads go to Storage, existing rows stay as inline data URLs.

---

**Demo URL one more time:** `https://rosy-demo.vercel.app`

When the client tests, please make a list of anything that surprises them and route back to me — I'd rather fix surprises now than during launch week.

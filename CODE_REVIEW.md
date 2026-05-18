# Rosy Recruits — Code Review

**Date:** 2026-05-18
**Reviewer:** Claude (independent)
**Commit:** 3f21f17

## TL;DR

The app is **demo-ready and broadly healthy for what it is** — a single-tenant client demo deployed as a static SPA with in-browser Babel. The architecture (window.RosyData + RosyMutate + realtime echo suppression) is genuinely clever and the boot path is resilient (3s timeout → seed fallback). However, **there are real security holes that must be closed before any "public" launch**: the entire admin trust boundary is implemented in client React with no enforced RLS policies visible in code, meaning a curious user with the anon key can `UPDATE rr_profiles SET verified=true`, mass-delete events, and read every other user's notifications/messages. The Postmark, dev-issue, and Stripe Connect serverless endpoints are completely open (no auth, no rate limit, no CORS lockdown) — Postmark especially is a spam-relay liability. For the **client demo this Monday** the gates are fine; for **a real customer pilot** at least the RLS + the four Vercel endpoints need an auth check before the next sprint.

## Critical (fix before client demo)

1. **Marketing hero renders user-controlled HTML via `dangerouslySetInnerHTML`** — `project/src/screen_misc.jsx:282`
   - **Problem:** The hero heading reads `window.RosyContent('home','hero_heading', ...)` and pipes the result into `dangerouslySetInnerHTML`. That value is editable from `PageSiteContent` (admin), persisted to localStorage AND `rr_site_content`. If RLS on `rr_site_content` ever allows non-admin writes — or a malicious admin pastes a `<script>` — every visitor to the marketing home page executes it.
   - **Impact:** Stored XSS on the public landing page. Persists across sessions for every visitor once a single bad write lands.
   - **Fix:** Either (a) hard-code the hero with no editable HTML, or (b) sanitize at render with a tiny allowlist (`<em>`, `<strong>`, `<br>` only) — e.g. `DOMPurify.sanitize(val, { ALLOWED_TAGS: ['em','strong','br'] })`. Don't ship "admin can paste arbitrary HTML" into a public page.

2. **`/api/send-email` is an open spam relay** — `api/send-email.js:18-83`
   - **Problem:** No origin check, no auth header, no rate limit, no CAPTCHA. Anyone who finds `https://rosy-demo.vercel.app/api/send-email` can `POST { subject, html, to }` and you'll burn Postmark credit + risk your sending domain reputation. The `to` is currently force-overridden to `ben@pronocoders.com`, which protects external recipients but means an attacker can spam **you** unlimited times with arbitrary HTML.
   - **Impact:** Postmark account suspension, Vercel function-invocation bill, your inbox poisoned. Also the demo redirect masks the real risk — the moment you flip it off you have an unauth'd email API live in production.
   - **Fix:** Three changes: (1) check `req.headers.origin` is your own domain and reject otherwise; (2) require the Supabase access token in `Authorization: Bearer` and verify it against `auth.users` server-side; (3) add per-IP rate limit (e.g. Upstash Ratelimit, 10/min). Lock CORS to `https://rosy-demo.vercel.app` instead of `*`.

3. **No enforced row-level security visible from client code paths** — `project/src/supabase_client.jsx:7`, `project/src/screen_admin.jsx:638,660,1300`
   - **Problem:** The browser holds the publishable anon key and the code freely calls `window.sb.from('rr_profiles').update({ verified: true }).eq('id', u.id)` from the admin UI (`screen_admin.jsx:638`). With permissive RLS, **any signed-in user can call the same query against their own row** (or any other row) directly from devtools. Same applies to: marking notifications read for other users, deleting events/gigs/venues anyone created, listing every conversation's full message history (`rr_messages` is fetched without participant filter in `supabase_client.jsx:279`), and seeing the full `rr_profiles` table including emails of every signup.
   - **Impact:** Self-verification, vandalism, PII leak. Any of these is a P0 if a real user (not a demo) finds it.
   - **Fix:** Before the next paying-user touches this, write and apply RLS policies for every `rr_*` table. Minimum: `rr_profiles` — user can `SELECT` own row + public columns of others, `UPDATE` own row only EXCLUDING `verified` and `role` (admin RPC writes those); `rr_events`/`rr_gigs`/`rr_venues` — vendor can write only rows where `vendor_id = auth.uid()`; `rr_messages`/`rr_conversations` — only if `auth.uid() = ANY(participants)`; `rr_notifications` — only own `user_id`. Admin operations go through a `security definer` RPC, not direct table writes.

4. **No Stripe webhook handler exists** — `api/stripe/`
   - **Problem:** Only `connect-link.js` (create account) and `connect-status.js` (poll) exist. There's no `webhook.js` to receive `account.updated`, `payment_intent.succeeded`, `charge.refunded`, etc. The UI polls Stripe on render (`screen_dashboards.jsx:167`) which is wasteful and racy — you'll show stale "onboarding incomplete" for users who just finished, and you'll never know when a real payment lands.
   - **Impact:** Stripe Connect onboarding state shown wrong for ~30s after completion. No reliable record of payments/disputes in your DB. Reconciliation will be painful when real money moves.
   - **Fix:** Add `api/stripe/webhook.js` that verifies `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET`, handles at minimum `account.updated` (write `charges_enabled`, `payouts_enabled`, `details_submitted` to `rr_profiles`) and `payment_intent.succeeded` / `charge.refunded` (write to `rr_gig_applications.payment_status`). Use the Vercel raw-body recipe — Vercel parses JSON by default which will break signature verification.

5. **First-class demo data leaks via the role-switcher** — `project/src/app.jsx:166-169, 319-322`
   - **Problem:** When **not** signed in, the role switcher silently picks `u1`/`u2`/`u3` from seed data, mounts their dashboard, AND `RosyMutate` calls (create event, mark notif read) write to those real seed rows in Supabase. So a random visitor clicking "Vendor" sees demo user `u1`'s real notifications/payments and can mutate them. Once signed in, `setRoleSafe` blocks the switch — but the switcher control is still visible in the header for signed-in users (looks broken because nothing happens).
   - **Impact:** Unauth'd visitors mutate real DB rows. Signed-in users see a broken-looking control.
   - **Fix:** Hide the role switcher entirely for signed-in users (don't just no-op it). When signed-out, render purely from in-memory seed and short-circuit any `RosyMutate` write with `if (!session) return optimisticOnly`.

## High (fix before public launch)

1. **`/api/dev-issue` is wide-open** — `api/dev-issue.js`
   - **Problem:** Same as send-email: no auth, no rate limit, CORS `*`. Anyone can spam your Airtable Dev Issues table. Worse, screenshots are accepted as base64 data URLs which counts against Airtable quota fast.
   - **Fix:** Require a session token + verify user is admin (only admins see DevNoteButton anyway per `app.jsx:422`). Add IP rate limit (5/min). Strip data URLs > 1MB.

2. **Stripe Connect account creation is non-idempotent under races** — `api/stripe/connect-link.js:84-101`
   - **Problem:** `supabaseGetProfile()` → `stripeFetch('/accounts')` → `supabaseSaveAccount()` is read-modify-write with no lock. Two parallel clicks (or a refresh during onboarding) creates TWO Stripe accounts and only the second's ID is saved, orphaning the first. Stripe will charge $2/mo on orphaned Express accounts once active.
   - **Fix:** Either use Stripe's idempotency key (`Idempotency-Key: rr-connect-${userId}` header), or atomic upsert in Supabase (`INSERT ON CONFLICT (id) DO NOTHING RETURNING stripe_account_id`) BEFORE calling Stripe.

3. **Realtime echo suppression has a 4s race window** — `project/src/supabase_client.jsx:758`
   - **Problem:** `__selfOriginIds.add(id); setTimeout(delete, 4000)`. If Supabase's realtime echo is slow (sometimes >4s on free tier), the echo arrives after the suppression expires and double-applies the write. You'll see new events flicker / row counts briefly double.
   - **Fix:** Either compare row version/updated_at and skip if local is fresher, or extend to 30s + cap set size, or hash the row content and skip if identical.

4. **`subscribeRealtime` is called once at boot and never torn down** — `project/src/app.jsx:625-627`, `supabase_client.jsx:874`
   - **Problem:** No cleanup on unmount (this is fine for the SPA root) but `__realtimeChannel` is a module-level singleton that survives sign-out → sign-in cycles. The channel was opened with the original anon-only context. After sign-in, postgres_changes still arrive but RLS context might not match (depends on JWT propagation), and you get silent drops with no reconnect logic for `CHANNEL_ERROR` / `TIMED_OUT` cases (just a `console.warn`).
   - **Fix:** Re-subscribe on auth-state change. Add reconnect-with-backoff on `CHANNEL_ERROR`.

5. **Public marketing page subscribes to `auth.onAuthStateChange` and never tracks if Supabase failed to load** — `project/src/marketing_pages.jsx:81-82`
   - **Problem:** `window.sb.auth.onAuthStateChange(...)` will throw if Supabase JS failed to load (CDN failure). No try/catch — entire marketing page goes blank.
   - **Fix:** Wrap in `if (window.sb && window.sb.auth) {...}` with try/catch.

6. **`rr_admin_invites` / `rr_site_content` / `rr_ratings` referenced but may not exist** — `admin_extras.jsx:127`, `form_helpers.jsx:330,385`, `supabase_client.jsx:711`, `screen_admin.jsx:428,1320`
   - **Problem:** Code repeatedly catches "table may not exist" warnings. This is fine as a soft-degrade, but means three product features (admin invite flow, site-content editing, ratings) silently fall back to localStorage and admins won't realize writes aren't shared across browsers.
   - **Fix:** Either create the tables (with RLS), or surface a single banner in admin: "DB tables missing for: invites, site content, ratings — changes are local-only." Don't swallow silently.

7. **`PageBroadcast` is fake — it doesn't actually send anything** — `project/src/admin_extras.jsx:459-467`
   - **Problem:** Click "Send broadcast" → it pushes a fake entry into local state and shows a toast claiming "Broadcast sent to 1,842 people." Zero emails actually leave. This will absolutely embarrass during a live walkthrough if anyone clicks it.
   - **Fix:** Either wire it to `window.RosySendEmail` with a confirm-modal preview ("This will email 412 vendors — continue?") or label the button clearly: "Preview (demo only — no emails sent)." The current behavior is the worst of both worlds.

8. **Hard-locked demo dates throughout seed data** — `project/src/data.jsx:59-100`, `extras.jsx:474`
   - **Problem:** Events dated `2026-05-15`, `2026-05-18`. By next month half the dashboard says "events completed weeks ago," undermining the live-marketplace feeling.
   - **Fix:** Seed dates relative to `today + offset` (e.g. `new Date(Date.now() + 7*86400000).toISOString().slice(0,10)`). Even a 30-line seed-date-rebaser script is fine.

9. **80 `console.log` / `warn` calls remain in production bundle** — across `project/src/*.jsx`
   - **Problem:** The `[rosy-route]` logs in `app.jsx:42-117` are particularly chatty — they fire on every auth state change. Devtools-savvy users see your routing internals + every profile-lookup payload.
   - **Fix:** Wrap in `if (window.__rosyDebug)` or strip via a tiny prelude script.

## Medium (next batch)

1. **`screen_admin.jsx` is 2,257 lines holding 11 page components** — single biggest file in the project, hosts payments, disputes, directory, venues, settings, audit, analytics, site content, emails, gallery, platform settings. Navigation cost is real.
   - **Fix:** Split by concern: `screen_admin_directory.jsx`, `screen_admin_content.jsx`, `screen_admin_settings.jsx`. Don't need to do it all at once — start by extracting `PageAnalytics` (~378 lines) and `PageSiteContent` (~122 lines) since they're self-contained.

2. **N+1-style hydration on boot** — `supabase_client.jsx:269-282`
   - **Problem:** 12 parallel `select *` queries on boot. Fine right now, but `rr_messages` and `rr_notifications` are unfiltered — when one heavy user has 10k notifications you're pulling all of them to every client.
   - **Fix:** Filter `rr_notifications` by `user_id = auth.uid()` on the client query (RLS will help once added), cap with `.limit(200)`. Same for `rr_messages` — fetch only conversations the user participates in.

3. **Heavy table renders without virtualization** — `PageDirectory` in `screen_admin.jsx:390` paginates client-side (10/page via `usePaged`), but the FULL filtered set is mapped each render. At 1,000+ users you'll start to feel it.
   - **Fix:** Already paginated client-side, so probably fine through 5k rows. If users > 5k, switch to react-window.

4. **`rosy:data-changed` event causes top-down re-render of entire `<App>`** — `app.jsx:126-130`
   - **Problem:** Every mutation, every realtime echo, bumps `dataTick` which re-renders every screen unconditionally. Combined with 600ms StatCard count-up animations (`components.jsx:85-101`), every realtime event restarts every animation.
   - **Fix:** Push `useSyncExternalStore` or context with selectors so only the screens reading changed slices re-render. Or just disable count-up animation on subsequent renders (`animate={initialRender}`).

5. **Stale closure in `PagePayments`** — `screen_admin.jsx:110-114`
   - **Problem:** `useEffect(() => { ... txs.find(...) }, [openId, role])` — `txs` is recomputed every render but not in the deps array. When openId is stable and txs updates via realtime, the modal won't reflect new data.
   - **Fix:** Include `txs` (or `SP_D.TRANSACTIONS.length`) in deps, or recompute inside.

6. **`OnboardingPage.onComplete` does 5 sequential awaits** — `app.jsx:240-297`
   - **Problem:** Insert notification → upsert profile → in-memory mutate → send email. If any step throws, later steps still run (each in its own try/catch) and the user can be left with `onboarding_complete=true` but no welcome email, or vice versa. No transactional guarantee.
   - **Fix:** Reorder so profile.upsert is FIRST (the critical write); notification + email are best-effort. If profile upsert fails, surface a toast and don't `setMode('app')`.

7. **`window.sb.from('rr_conversations').update(...).then(() => {})`** — `supabase_client.jsx:682`
   - **Problem:** Fire-and-forget without error handling. If `last_message_at` update fails, conversation sort breaks silently.
   - **Fix:** `.catch(e => console.warn(e))` at minimum.

8. **`/api/stripe/connect-status` polled on every dashboard render** — `screen_dashboards.jsx:167`
   - **Problem:** Hits Stripe API on every dashboard mount. Slow (~600ms cold), cached in component state only. With realtime returning to dashboard frequently, you'll burn through Stripe rate limit at scale.
   - **Fix:** Cache the result in `rr_profiles.stripe_charges_enabled` columns, update via webhook (see Critical #4), poll only as a fallback.

9. **`Modal` and `Slideover` lack focus trap / aria-labelledby** — `components.jsx:131-176`
   - **Problem:** Tab key escapes the modal into the page beneath. `role="dialog" aria-modal="true"` is set but no `aria-labelledby` pointing at the heading; screen readers won't announce title.
   - **Fix:** Add focus trap (focus first element on open, return focus to opener on close) and `aria-labelledby` linking to the `<h3>`.

10. **Verification gate modal blocks `onKeyDown` only at the backdrop** — `app.jsx:425-426`
    - **Problem:** `onKeyDown={(e) => e.preventDefault()}` on the backdrop div prevents all keys including Tab + Esc, but elements inside (the logo img!) are still focusable. Effect is mostly cosmetic-only protection.
    - **Fix:** Use a proper focus trap, or just remove the keydown blocker (the modal has no escape route anyway).

## Low / polish

- `index.html:18` loads `@babel/standalone@7.29.0` (~2.7MB) on every page load including marketing. First paint on cold cache is ~3-5s on 4G. Vendoring a precompiled bundle would 10× the load time but is a real build-step decision.
- `sw.js:6-9` precaches only `styles.css` and `logo.avif`. Service worker is essentially symbolic (here for PWA install criteria). That's fine — comment is honest.
- `data.jsx:160` — `window.RosyData =` assignment is replaced in-place by `supabase_client.jsx:309` `Object.assign(...)`. Comment at line 308 explains why. Good pattern, just noting.
- `vercel.json` has only `X-Frame-Options` + `Referrer-Policy`. Missing: `Content-Security-Policy` (would help with XSS #1 above), `Strict-Transport-Security`, `Permissions-Policy`. Add these once the inline script in `index.html:21-49` is gone or hashed.
- `form_helpers.jsx:11-23` — every email template is a one-line megastring. Hard to diff/review. Split into separate JSX template files when you have a build step.
- `screen_misc.jsx:750-751` — SSN and EIN inputs are plain `<input>` with no masking, no `autocomplete="off"`, and stored where? Tracing forward: this is in the W-9 form section, looks like a UI mock with no save handler. If real — encrypted at rest is mandatory. If mock — add a banner.
- `app.jsx:567-573` — devNotes saved to `localStorage`. Caps at 500 entries with `slice(0, 500)`. Good defensive cap.
- `marketing_pages.jsx:87` — `localStorage.clear(); sessionStorage.clear()` on logout. Aggressive — wipes other apps' state on shared origins. Fine for a single-purpose subdomain, would be hostile on `*.rosyrecruits.com`.
- 17 `useEffect(..., [])` calls — most look correct (mount-only subscriptions). Not flagging individually.
- `extras.jsx:474` references "Wave Hill Garden Brunch" (NY venue) but the address bank in `form_helpers.jsx:411` is all Chicago. Pick a city.
- `RosyData.NOTIFICATIONS.unshift(...)` mutates the seed array directly in `app.jsx:262` and `screen_admin.jsx:24`. Works because RosyData is a module-level singleton, but a future hook that does `useMemo(() => RosyData.NOTIFICATIONS.filter(...), [tick])` would break because the array reference doesn't change. Document or freeze.

## What's good

- **The boot path is genuinely resilient.** `app.jsx:611-628` race-times Supabase hydration at 3s and falls back to seed. Site renders even with the DB offline. Great for a demo.
- **`RosyMutate` pattern is the right abstraction.** Single place that does optimistic update + DB write + rollback. The echo suppression on realtime (`supabase_client.jsx:762-775`) is clever even if the 4s window is fragile.
- **Email demo-redirect is well thought-out.** `api/send-email.js:14,66-69` keeps original recipient in the subject + banner, so QA can see who'd have gotten it without spamming real users. Exactly the right call for client-demo phase.
- **Routing has thoughtful guards.** `ROUTE_ROLES` table in `app.jsx:465-484` + the silent-bounce vs. Forbidden distinction in `ScreenRouter` (lines 500-506) shows someone actually thought about role UX, not just "show 403."
- **Onboarding gate is correctly enforced at THREE points** — auth callback (`app.jsx:41-83`), post-session check (`app.jsx:145-163`), and mode/profile mismatch hard-block at render (`app.jsx:331-363`). Belt-and-braces, good.
- **CSS variables for theming + dark/sidebar tweaks** via `tweaks.jsx` — clean.
- **Toast + Modal + Slideover + ConfirmDialog primitives** are well-isolated in `components.jsx:7-191`. Easy to reuse.
- **Profile shape is stable across UI and DB via explicit transformer functions** (`buildUsers`, `eventDbToUi`, `gigUiToDb`). Could be ORMy, but right size for the project.
- **Stripe Connect Express integration is correct for the standard flow** — account + onboarding link, status read separately. Just needs the webhook + idempotency fixes called out above.

## File-by-file index

| File | Lines | Summary | Biggest concern |
|---|---|---|---|
| `index.html` | 70 | UMD-loaded React + Babel + Supabase, 14 `<script type="text/babel">` tags with dev cache-buster | 2.7MB Babel transpile on every page load |
| `vercel.json` | 13 | Only 2 security headers | Missing CSP |
| `sw.js` | 44 | Symbolic SW for PWA-install qualification; caches only styles + logo | Fine — honest comment |
| `api/send-email.js` | 105 | Postmark proxy with demo-redirect to ben@pronocoders.com | Unauth'd open relay |
| `api/dev-issue.js` | 93 | Airtable proxy for dev notes | Unauth'd |
| `api/stripe/connect-link.js` | 116 | Creates Express account + onboarding link | Race → duplicate accounts |
| `api/stripe/connect-status.js` | 38 | Reads acct status from Stripe | Polled on every dashboard mount |
| `project/src/icons.jsx` | 86 | lucide-react-style icon set as a single `window.Icons` map | None |
| `project/src/data.jsx` | 160 | Seed data: users, events, gigs, transactions, images, FAQs | Hard-coded May 2026 dates |
| `project/src/supabase_client.jsx` | 901 | Hydrator + RosyMutate + realtime — the heart of the app | 4s echo-suppression race |
| `project/src/components.jsx` | 716 | Toast, Avatar, Badge, StatCard, Modal, Slideover, Pagination, etc. | Modal focus trap missing |
| `project/src/extras.jsx` | 631 | Sidebar, AppHeader, Walkthrough, NotificationPanel | Walkthrough state lives in 2 places |
| `project/src/form_helpers.jsx` | 594 | `RosyStores` singleton (email templates, legal docs, gallery, savedProfiles, siteContent), `RosySendEmail`, `AddressInput`, `GoogleButton`, `WriteForMe` | Mega-init IIFE; legal docs as JS strings |
| `project/src/marketing_pages.jsx` | 644 | Public landing + pricing + about + how-it-works | Unprotected `window.sb.auth.onAuthStateChange` |
| `project/src/screen_dashboards.jsx` | 603 | Admin/vendor/worker dashboards | Polls Stripe on every render |
| `project/src/screen_events.jsx` | 663 | Events list + detail (vendor + worker variants) | Two view modes, large state surface |
| `project/src/screen_gigs.jsx` | 932 | Gig CRUD + worker gig-posts + worker my-gigs | Inline mega-onClick handlers on line 650 |
| `project/src/screen_misc.jsx` | 868 | Inbox, MarketingPage, AuthPage, OnboardingPage | XSS in hero, W-9 form fields with no save |
| `project/src/screen_admin.jsx` | 2,257 | Payments, Disputes, Directory, Venues, Settings, Audit, Analytics, SiteContent, Emails, Gallery, Platform | Too big — split |
| `project/src/admin_extras.jsx` | 572 | AdminAssistants, PermissionsModal, NotificationRules, Broadcast, SafeImage | Broadcast is fake (no email sent) |
| `project/src/tweaks.jsx` | 121 | `useTweaks` — local-storage backed UI prefs (dark sidebar, anim, view mode) | None |
| `project/src/app.jsx` | 628 | App shell, hash router, auth + onboarding gating, ScreenRouter | Heavy `useEffect`s, console-log spam |

## Architecture summary

- **Hash routing**: `#marketing`, `#auth`, `#onboarding`, `#app/<route>[/<subId>]`. Parsed in `app.jsx:175-187` on `hashchange`. Three top-level modes set the page; `mode === 'app'` mounts the sidebar+header+ScreenRouter shell.
- **Data store**: `window.RosyData` is a single in-memory object created from seed in `data.jsx:160`. On boot, `bootRosyFromSupabase()` (in `supabase_client.jsx:261`) fires 12 parallel `SELECT *` queries on `rr_*` tables, transforms DB rows to UI shape via `buildUsers/buildEvents/...`, and `Object.assign`s the result back into `window.RosyData` so module-level captures (`const D = window.RosyData`) still see live data. Falls back to seed after 3s timeout.
- **Mutations**: `window.RosyMutate.{events,gigs,venues,applications,messages,conversations,ratings,notifications}.{create,update,delete}` does optimistic local mutation → fires `rosy:data-changed` → writes to Supabase → swaps temp ID with real ID on success or rolls back on error.
- **Realtime**: One Supabase channel subscribed to `postgres_changes` on 6 tables (`supabase_client.jsx:877-883`). Self-writes are remembered in `__selfOriginIds` set (4s TTL) to suppress echo double-application.
- **Re-render fan-out**: A single `useState`-bumped `dataTick` in `<App>` (`app.jsx:125-130`) re-renders the entire tree on any `rosy:data-changed`. Screens read from `window.RosyData` directly inside render.
- **Auth + role**: Supabase Auth session → `rr_profiles` lookup for `role`+`onboarding_complete`+`verified`. Signed-in user's role replaces the demo role-switcher. Three onboarding-gate checks (auth callback, post-session, render-time) all converge on the same shape.
- **Stripe Connect**: Two endpoints, no webhook. UI polls `/api/stripe/connect-status?userId=` for chargesEnabled/payoutsEnabled.
- **Email**: All sends route through `/api/send-email` → Postmark, force-redirected to `ben@pronocoders.com` in demo mode. Templates live in `form_helpers.jsx`.
- **Dev feedback loop**: Admin floating button → `localStorage` AND `/api/dev-issue` → Airtable.

## Suggested next-step refactors

| # | Refactor | Effort | Payoff |
|---|---|---|---|
| 1 | Write & apply RLS policies for all `rr_*` tables; gate `verified`/`role` writes through SECURITY DEFINER RPC | 3-4h | Closes the entire client-bypass attack surface |
| 2 | Add auth check + rate limit + origin pinning to `api/send-email`, `api/dev-issue` (and tighten CORS on Stripe endpoints) | 1-2h | Closes spam relay + Airtable abuse |
| 3 | Add `api/stripe/webhook.js` with sig verification + handlers for `account.updated`, `payment_intent.succeeded`, `charge.refunded` | 2-3h | Real payment reconciliation, kills polling |
| 4 | Split `screen_admin.jsx` (2,257 lines) into 3-4 files by feature | 1h | Daily-use ergonomics |
| 5 | Wire `PageBroadcast` to `RosySendEmail` with confirm-modal preview, OR label clearly as "demo only" | 30min | Stops embarrassment + delivers a real feature |

## Appendix: every window.* global the app sets

| Global | Set in | Purpose | Risk |
|---|---|---|---|
| `window.SUPABASE_CONFIG` | `supabase_client.jsx:5` | URL + anon publishable key | None (anon key intended for browser) |
| `window.sb` | `supabase_client.jsx:15` | Supabase client singleton | Anyone can call `.from('rr_*')` from devtools — RLS is the only guard |
| `window.RosyData` | `data.jsx:160` | The in-memory app store | Mutated in-place by 30+ call sites; replacing array refs would break captures |
| `window.bootRosyFromSupabase` | `supabase_client.jsx:261` | Boot-time hydration | None |
| `window.RosyMutate` | `supabase_client.jsx:445` | Optimistic + DB mutation API | Calls go to anon client — same RLS dependency |
| `window.subscribeRealtime` | `supabase_client.jsx:874` | Channel singleton initializer | One channel, never torn down |
| `window.Icons` | `icons.jsx:86` | Icon map | None |
| `window.RosyStores` | `form_helpers.jsx:321` | Email + notif templates, legal docs, gallery, siteContent, adminInvites, savedProfiles | localStorage-backed; can grow unbounded |
| `window.RosySaveSiteContent` | `form_helpers.jsx:324` | Persist site-content block | Inputs from admin UI flow into `dangerouslySetInnerHTML` — see Critical #1 |
| `window.RosyContent` | `form_helpers.jsx:335` | Read site-content w/ fallback | XSS vector when consumer uses `dangerouslySetInnerHTML` |
| `window.RosySaveSavedProfiles` | `form_helpers.jsx:340` | Persist vendor shortlists | localStorage only |
| `window.RosySendEmail` | `form_helpers.jsx:349` | Templated email send | Anyone can call from devtools (open relay backend) |
| `window.AddressInput` | `form_helpers.jsx:594` | React component export | None |
| `window.GoogleButton` | `form_helpers.jsx:594` | React component export | None |
| `window.WriteForMe` | `form_helpers.jsx:594` | React component export | Calls `window.claude.complete` if present — depends on host page |
| `window.GALLERY_SECTIONS` | `form_helpers.jsx:407,594` | Static config | None |
| `window.PagePayments` … `window.PagePlatformSettings` | `screen_admin.jsx:2257` | Page component exports | None (component-export pattern is sound) |
| `window.PageInbox`, `MarketingPage`, `AuthPage`, `OnboardingPage` | `screen_misc.jsx:868` | Page component exports | None |
| `window.PageAdminAssistants`, `PermissionsModal`, `PageNotificationRules`, `PageBroadcast`, `SafeImage` | `admin_extras.jsx:572` | Component exports | None |
| `window.__rosyDataSource` | `supabase_client.jsx:310,315` | 'supabase' or 'seed' — gates RosyMutate live-mode | Soft signal; fine |
| `window.__selfOriginIds` (closure-internal) | `supabase_client.jsx:753` | Realtime echo suppression set | 4s TTL race window — see High #3 |
| `window.__rosyOpenAddGig`, `__rosyOpenAddEvent`, `__rosyAddGigEventId`, `__rosyComposeTo` | `screen_dashboards.jsx:299,300`, `screen_events.jsx:515`, `screen_admin.jsx:632` | Cross-screen "open this modal on next mount" signals | Brittle — race-prone if user navigates twice fast; works because of `useEffect(..., [])` on the receiver |
| `window.__pwaInstallEvent` | `index.html:32` | Captured `beforeinstallprompt` event | None |
| `window.__rosyDebug` (referenced if you adopt suggestion) | — | (suggested) gate console logs | — |

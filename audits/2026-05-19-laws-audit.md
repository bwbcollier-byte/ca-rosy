# Rosy Recruits — Laws Audit

**Date:** 2026-05-19
**Auditor:** Wong (Product Design)
**Repo:** `~/Documents/Claude OS/Client Work/Rosy Recruits/`
**Source files audited:** `project/src/*.jsx` (15 files), `project/styles.css`, `index.html`, `manifest.json`
**Laws contract:** `COMPONENT_LAWS_ESSENTIALS.md` v2026-05-19 (L1–L248) + `APP_SETUP_LAWS_ESSENTIALS.md` (S1–S12)

## Executive verdict

**Status: ⚠️ Demo-shippable, NOT launch-ready.**

The app passes basic semantic-HTML and modal-a11y checks. It fails on portfolio infrastructure standards — no `.env.example`, no branded 404/500 pages, no migrations, hex literals scattered through components, and ~370 likely inline JSX strings that block translation and the L245 Tweaks Panel pattern.

For the Mariana/Tonya demo today: fine — the issues are not user-blocking. **Before any public launch (Phase 13A.1 of the build pipeline), this list is the merge gate.**

Issue counts:

| Severity | Count | Definition |
| :---- | :---- | :---- |
| **BLOCKER** | 3 | MUST-class law violated, no exception. Merge/launch blocked. |
| **HIGH** | 6 | SHOULD-class law violated, no exception. |
| **MEDIUM** | 4 | Documented exception or partial compliance. |
| **LOW** | 2 | Polish items. |

---

## BLOCKERS

### B1 — L1.1 — Clickable `<div>` patterns throughout modals + sidebar + notifications
**Files:** `app.jsx:591-592`, `components.jsx:139-140, 165-166, 315, 488-489, 505`
**Snippet:** `<div className="modal-backdrop" onClick={onClose}>...<div className="modal" onClick={(e) => e.stopPropagation()}>`
**Why this matters:** Backdrop / stop-propagation divs are common, but the notification row at `components.jsx:505` (`<div onClick={() => openNotif(n)} ...>`) is genuinely a non-semantic clickable list item — keyboard users can't reach it. Same for the sidebar backdrop and slideover patterns.
**Fix:** Backdrop divs are acceptable as click-receivers (they're closing the parent dialog, not the primary affordance), but they need `role="presentation"` or an explicit aria. The clickable notification rows should be `<button>` with row styling.
**Effort:** ~30 min. One-line per occurrence.

### B2 — S10.1 — No branded 404 / 500 pages
**Evidence:** No `404.html`, `500.html`, `not-found.tsx`, or `error.tsx` anywhere in the project.
**Why this matters:** The static-HTML deployment via Vercel serves the framework default (or worse, the literal `/index.html` for any unmatched route). On public launch, broken links land users on Vercel's generic page. Bad first impression + zero brand recovery.
**Fix:** Add `404.html` and `500.html` at the project root with the branded shell (logo + apology + Home button + support link). Vercel will auto-serve them. ~45 min.

### B3 — S2.2 — No `.env.example`
**Evidence:** No `.env.example` at the project root or in `project/`.
**Why this matters:** Every environment variable the app reads is undiscoverable to a new contributor (or future Ben after a context wipe). Supabase URL, Supabase anon key, and any deploy-time config are unknown until someone greps the source.
**Fix:** Generate `.env.example` from a grep of `import.meta.env.` references. Each variable name + 1-line description, no values. ~20 min.

---

## HIGH

### H1 — L1.7 — Button labels use "Submit" and "Continue"
**Files:** `screen_gigs.jsx:845` ("Submit"), `screen_misc.jsx:594, 629` ("Continue")
**Why this matters:** L1.7 hard-bans these labels portfolio-wide because they don't tell the user what will happen. "Submit" → "Submit gig" or "Send application". "Continue" → "Confirm role" or "Verify and continue".
**Fix:** Per-button verb. Read the surrounding logic and pick the specific verb. ~15 min for three occurrences.

### H2 — L27.3 — 98 hex literals in component code
**Files:** Across all `.jsx` files. Concentrated in `app.jsx:591` (`rgba(10,10,10,0.5)`) and elsewhere as `style={{ background: '#XXX' }}` inline patterns.
**Why this matters:** Tokens belong in `styles.css` as CSS variables. Hex literals scattered through components mean a brand-color shift requires touching dozens of files.
**Fix:** Add `:root { --color-backdrop: rgba(10,10,10,0.5); }` and friends in `styles.css`. Replace inline hex with `var(--color-backdrop)`. ~2-3h to do cleanly across all files.

### H3 — L247.1 — ~370 likely inline JSX strings
**Files:** `screen_admin.jsx:102`, `screen_gigs.jsx:51`, `screen_misc.jsx:41`, `screen_events.jsx:43`, `marketing_pages.jsx:26`, others.
**Why this matters:** Inline strings block the Builder Tweaks Panel (L245), block i18n, and force every copy edit through a code deploy. For a client-facing product, this is the largest leverage gap.
**Fix:** Migrate to `i18n/en-AU.json`. Replace `<button>Submit gig</button>` with `<button>{t("gigs.submit")}</button>`. Big lift (~1 day) — defer until post-demo. Counts as ~370 MUST exceptions until done.

### H4 — L8.5 — Top-right user image uses placeholder, not actual avatar
**Files:** Per prior 2026-05-17 MEMORY entry, this is the demo bug already filed as Airtable task `recEyS2X1tDnaXylE` ("Top-right image must be actual user profile image").
**Status:** Already queued. Mentioned here for completeness.

### H5 — L10.1 — Empty states missing illustration/icon + CTA
**Files:** Likely across `screen_*.jsx` — needs visual audit, not just grep.
**Why this matters:** Empty Available Gigs page (no rows), empty Worker dashboard before applications, etc., probably render `<table>` with no rows + nothing else. L10.1 wants illustration + one-line copy + primary CTA.
**Fix:** Run `/impeccable audit` with the live app to see each empty state. Estimated 5-8 empty surfaces to retrofit. ~2h.

### H6 — S6.1 — No PostHog wired
**Evidence:** No `posthog` import found in `package.json` / src.
**Why this matters:** S6.1 requires analytics initialised before first user. Without it, Mariana's testing yields zero event data — no funnel, no usage shape, no behavioral signal to inform the v1.1 backlog.
**Fix:** Add `posthog-js`, init in `app.jsx`, capture page views + signup_completed + gig_application_submitted. ~1h.

---

## MEDIUM

### M1 — L5.1-5.3 — Modal close affordance, Esc/backdrop, focus trap
**Files:** `components.jsx:139-166` — has `role="dialog"` and `aria-modal="true"` ✓; backdrop click closes ✓. But no visible `×` button check, no Esc handler visible in grep, and focus trap appears missing.
**Verification needed:** Open a modal in dev, press Esc, tab around — confirm focus trap.
**Fix if missing:** Wire Esc to `onClose`, add focus-trap library or manual implementation. ~1h.

### M2 — L16 — Mobile responsive — no viewport check in `index.html`
**Evidence:** Grep for `viewport` in `index.html` returned no matches in this audit pass.
**Verification needed:** Confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` is present. If missing, mobile users get desktop layout zoomed out.
**Fix if missing:** One line in `index.html` `<head>`. ~2 min.

### M3 — S5 — Supabase schema not versioned
**Evidence:** No `supabase/migrations/` directory.
**Why this matters:** Schema lives only in the Supabase console. Future migrations have no rollback path, no PR review, no audit trail.
**Fix:** Run `supabase db pull` to snapshot current schema as the baseline migration. Going forward, every schema change is a migration file. ~30 min initial; ongoing discipline.

### M4 — L161.1 — Status colors not codified
**Files:** Throughout — colors used for status (active/inactive, pending/applied/declined) appear to be inline.
**Why this matters:** L161.1 requires universal semantics — green/amber/red/blue/grey mapped consistently. Worth a visual audit during the demo to see if it's already followed.

---

## LOW

### L1 — L21.4 — `/` to focus global search
Nice-to-have keyboard shortcut. Skip until post-launch.

### L2 — L188 — Update-available banner (PWA new version)
The app is PWA (`manifest.json` exists, `sw.js` exists) but no update-available pattern. Low priority until users are on long-running tabs in production.

---

## Setup-laws audit (S-class summary)

| S# | Law | Status | Note |
| :---- | :---- | :---- | :---- |
| S1.1 | Stack: Next.js + Tailwind + Supabase + Stripe + PostHog + Sentry | ⚠️ partial | Static HTML + React via CDN, not Next.js. Documented exception OK for client demo. |
| S1.2 | `.tool-versions` Node 20 + pnpm 9 | ❌ | Missing |
| S2.1 | `PRODUCT.md` + `DESIGN.md` | ✅ | `PRODUCT.md` exists. `DESIGN.md` referenced in MEMORY but not located in repo root. |
| S2.2 | `.env.example` | ❌ | **BLOCKER B3** |
| S2.4 | PR template | ❌ | No `.github/` directory. |
| S3.1 | CSP / HSTS / X-Frame-Options | ⚠️ partial | Check `vercel.json` headers section. |
| S4.2 | Password floor ≥12 chars | ? | Verification needed — open signup, attempt 8-char password. |
| S5.1 | Standard columns on every table | ? | Verification needed via Supabase MCP. |
| S5.3 | RLS on every user-data table | ? | Verification needed via Supabase MCP. |
| S5.6 | Versioned migrations | ❌ | **MEDIUM M3** |
| S6.1 | PostHog initialised | ❌ | **HIGH H6** |
| S6.2 | Sentry initialised | ❌ | No `@sentry/*` import found. |
| S7.1 | Bundle budget | n/a | CDN-hosted React = no bundle to budget. |
| S8.1 | Rate limit auth endpoints | n/a | No custom auth endpoints. |
| S8.3 | Turnstile on unauth forms | ❌ | No Turnstile integration. |
| S9.1 | Playwright critical paths | ❌ | `TESTING_CHECKLIST.md` exists but no Playwright. |
| S9.2 | Axe a11y in CI | ❌ | No CI workflow. |
| S10.1 | Branded 404/500 | ❌ | **BLOCKER B2** |
| S10.2 | `/privacy`, `/terms`, `/cookies` | ? | Verification needed. |
| S10.3 | Cookie banner if EU | ⚠️ | Mariana is AU — consider if launch reaches EU. |
| S11.1 | SandboxBanner non-prod | ❌ | No banner in current build. |
| S11.2 | ImpersonationBanner | n/a | No impersonation feature shipped. |
| S12.1 | PWA manifest with 192/512 icons | ✅ | `manifest.json` exists; verify icon sizes. |

---

## Recommended next actions

1. **Pre-demo today (Mariana + Tonya 2026-05-19):** No action — all blockers are post-demo concerns. Demo proceeds.
2. **Post-demo this week:** Fix B1 (clickable divs → buttons for notifications), B2 (branded 404/500), B3 (.env.example). ~3h total. Files PRs labeled `laws-audit-b{1,2,3}`.
3. **Pre-launch (before any public release):** Resolve all HIGH items. Migrate inline strings to i18n is the biggest single lift (~1 day).
4. **Re-run `/laws-check` after every batch.** Track delta in `audits/2026-05-19-laws-audit.md` → `audits/2026-05-20-laws-audit.md`.

## Documented exceptions to file

Per L20.1 + decisions.md 2026-05 token scoping — Rosy is client work with its own brand (NOT Rascals admin tokens). Hex literals in components are NOT a "use Rascals tokens" violation; they ARE still L27.3 violations (should be Rosy-CSS-var, not raw hex). Distinct issue.

If S1.1 (Next.js stack) is intentionally skipped because Rosy was scoped as a static client demo, log the exception in `DESIGN.md` with date + reason + Ben sign-off.

---

## Re-run

```bash
cd "~/Documents/Claude OS/Client Work/Rosy Recruits"
# When /laws-check skill is bash-runnable, it'll write the next dated report here.
```

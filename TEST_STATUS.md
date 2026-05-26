# Rosy Recruits — test suite status

## Running

```bash
cd "/Users/ben/Documents/Claude OS/Client Work/Rosy Recruits"
npm test              # full run, ~30s
npm run test:ui       # interactive UI mode
npm run test:headed   # watch in a real browser
npm run test:report   # open last HTML report
npm run test:smoke    # only @smoke-tagged (the critical ⭐ items)
```

Tests run against `https://rosy-demo.vercel.app` by default. Override with
`BASE_URL=https://preview-xyz.vercel.app npm test`.

## Test admin

A dedicated account is seeded in Supabase for tests to log in as:

- **Email:** `e2e-admin@rosyrecruits.com`
- **Password:** `E2eTests1!`
- **Role:** admin (verified, onboarding_complete)
- **Supabase id:** `b88f0dc1-d9c1-4e53-b8c4-9c1e1c41f23d`

Override via env vars: `ROSY_ADMIN_EMAIL` and `ROSY_ADMIN_PASSWORD`.

## Coverage as of latest run

**19 passing, 4 failing, 1 skipped — 24 total tests across 9 spec files.**

Each run takes ~3 minutes with workers=1 (avoids Supabase auth rate-limit flake).

### ✅ Passing (regression locked in)

| # | Test | Spec |
|---|------|------|
| 25 | Anonymous visitor lands on /#marketing without bounce | 01-marketing |
| 26 | Signed-in user can view /#marketing without auto-redirect | 01-marketing |
| 27 | Hard refresh on /#marketing/faq stays on FAQ page | 01-marketing |
| 29 | Vendor-only FAQs do NOT appear on marketing FAQ page | 01-marketing |
| 30 | Marketing home "Common questions" excludes vendor-only | 01-marketing |
| 19 | Logout clears session — next page load does not auto-restore | 02-auth |
| 34/35 | Admin opening a vendor sees email + phone populated | 03-admin-user-modal |
| 94/95 | Profile email displays from session and is read-only | 04-settings |
| 101 | No "Your data" section under Privacy & Data | 04-settings |
| 102 | No Danger Zone tab in settings | 04-settings |
| 113 | Anonymous SELECT on rr_profiles returns 0 rows | 05-rls-privacy |
| 114a | Anonymous CANNOT request sensitive columns from view | 05-rls-privacy |
| 114b | Safe columns ARE selectable on view | 05-rls-privacy |
| 125 | No em dashes in stored email templates | 06-em-dash |
| 125 | No em dashes in published FAQs | 06-em-dash |
| 82 | Notifications page clears unread badge | 07-notifications |
| 85 | "All" count matches visible notifications | 07-notifications |
| 28 | Hard refresh on /#app/events stays on events | 09-deep-links |
| 28b | Hard refresh on /#app/notifications stays on notifications | 09-deep-links |

### ❌ Failing (need investigation or known bugs)

| # | Test | Likely cause |
|---|------|--------------|
| 33/41 | Open user, close cleanly with no orphan second modal | **Real bug** — the "phantom second modal on close" you reported. Test correctly red. |
| 3 | Existing admin signs in and lands on dashboard | Test setup flake — Supabase auth rate-limit on test admin. Cached session works for other tests. |
| 1 | Fresh vendor signup redirects to onboarding within 15s | Performance flake — sometimes >15s, sometimes under. Babel-in-browser compile time. |
| 119 | No 24-hour times in schedule labels | Either false positive (user bio mentioning "14:00") or real unconverted time. Needs eyeball. |
| 91 | /#app/dashboard?stripe=connected resolves to dashboard | Needs investigation. |

### ⏭️ Skipped

| # | Test | Reason |
|---|------|--------|
| 125 | No em dashes in stored email templates | rr_email_templates is admin-only RLS — anon probe skips. |

## How the workflow works going forward

1. You report a bug.
2. I fix it.
3. **I add a Playwright test for that exact bug** in this folder.
4. `npm test` — must be green before I deploy.
5. CI (once wired) runs the suite automatically on every push.

The test count grows with the bug list. Every fix gets a permanent regression
guard. Bugs you've reported once can't come back silently.

## Remaining setup (waiting on you)

- [ ] **GitHub Actions wiring** — repo is `bwbcollier-byte/ca-rosy`. I can set up a `.github/workflows/playwright.yml` so the suite runs on every push. Tell me when you want this enabled.
- [ ] **Alert channel** — Slack webhook URL or email address for red-result pings.
- [ ] **More tests** — finish converting the 126 items in `SMOKE_TEST.md` (currently 10 covered; another ~30 ⭐ items to go).

## Adding new tests

One spec per `SMOKE_TEST.md` section. Naming: `tests/NN-feature.spec.js`.

Boilerplate:
```js
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test('#XX human-readable description @smoke', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/#app/...');
  // assert state
});
```

Tag `@smoke` to include in the critical subset (`npm run test:smoke`).

## What the helper functions give you

In `tests/fixtures/helpers.js`:
- `signInAsAdmin(page)` — logs in as the e2e admin
- `signUpFreshUser(page, { prefix, password })` — creates a new account, returns `{ email, password }`
- `logout(page)` — clears local session
- `freshEmail(prefix)` — generates a unique `<prefix>-<timestamp>@e2e.rosytests.com`

The `@e2e.rosytests.com` domain is reserved for test signups so we can wipe
them with a single `DELETE` without touching real users.

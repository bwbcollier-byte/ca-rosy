# Rosy Recruits — dev rules

**Read this first, every time, before touching Rosy code.**

These are non-negotiable standing rules. Break one and the suite goes red
and the user loses trust.

---

## 1. Bug-class watchlist

Two patterns keep recurring. Every change must be checked against both:

### A. "Data in popups changing unexpectedly"

Symptoms: admin opens a user, sees fields populate, then they change /
disappear / revert without the user clicking anything.

**Root causes seen so far:**
- A `useEffect` runs on mount AND on re-render, re-fetching and
  overwriting local state mid-edit
- A realtime listener (`refreshUserById` etc.) updates `RosyData.USERS`
  while the modal is open, and the modal re-reads from there
- An `enriched` merge re-applies on every render, overriding a draft
  the admin just typed
- A `setX(undefined)` somewhere wipes a field instead of leaving it

**Mandatory check before declaring any change "done":**
1. Open the affected popup with full data
2. Wait 10 seconds without clicking anything
3. Confirm no field changes
4. Type into one field, wait 10 seconds, confirm what you typed stays

If any data changes without explicit user action — STOP. That's a bug.

### B. "Forms not pre-populating with information"

Symptoms: admin opens a record they know has data, the form shows blanks.

**Root causes seen so far:**
- The data comes from `RosyData.USERS` (built from the PUBLIC view) which
  excludes sensitive cols like email, phone, stripe_*. The form expects
  full data.
- The `enriched` fetch fires AFTER initial render — fields populate late
  or not at all if the fetch fails silently
- A `useState(user.X || '')` runs once, but `user.X` arrives via async
  fetch later. The initial empty `''` sticks.
- The `userToDraft(user)` mapper is called once on mount, not on later
  prop changes.

**Mandatory check before declaring any change "done":**
1. Find an existing record with complete data (e.g. a vendor with name,
   email, phone, address, business hours all filled)
2. Open the form / popup
3. Confirm every field has its stored value, NOT blank, NOT a placeholder
4. Close and reopen — same result

If any field shows blank where data exists — STOP. That's a bug.

---

## 2. Check-don't-update protocol

Every time you suspect a regression:

1. **Read the relevant file.** Never assume code is what it was yesterday.
2. **Run the existing test for that area.** `npx playwright test <area>.spec.js`
3. **Trace the data flow on paper / out loud.** "X comes from Y, mapped
   by Z, rendered at W."
4. **Report what you found. DO NOT fix yet.**
5. Wait for explicit "fix it" before touching code.

This breaks the "fix one bug, introduce three" cycle. The user has
explicitly asked for this. **Never skip the check phase.**

---

## 3. Cross-surface impact list

Before editing any of these files, list every other place that
reads from / writes to the same data:

| File | Touches | Must also be checked |
|---|---|---|
| `supabase_client.jsx` (buildUsers) | RosyData.USERS shape | Every admin user modal, settings, chat avatars, gig applicant cards |
| `supabase_client.jsx` (RLS / view) | rr_profiles_public view columns | Every cross-user UI that needs ANY field beyond id/name/role/photo |
| `app.jsx` (routeForSession) | mode + route on auth events | Signup, login, onboarding gate, marketing routing, password reset |
| `screen_admin.jsx` (UserDetailModal) | user prop merging | Mark active, Edit, photo, name display, phone, email |
| `form_helpers.jsx` (AddressInput) | onChange callback | Onboarding profile, admin user edit, venue add, settings |
| `extras.jsx` (PageNotificationCenter) | archived map + unread state | Bell dropdown, sidebar count |

When editing one of these, **list the dependent surfaces in the change
description** and check at least three of them after the edit.

---

## 4. Versioning rules

**Every "user-confirmed working" state gets a git tag.** Never lose a
known-good baseline.

Tag naming: `verified-YYYY-MM-DD-<short-label>`

Examples:
- `verified-2026-05-26-19passing` — current Playwright baseline
- `verified-2026-05-25-modal-bug-fixed` — when the phantom modal is fixed
- `verified-2026-05-27-events-flow` — after testing event creation flow

**Tagging procedure:**
```bash
cd "/Users/ben/Documents/Claude OS/Client Work/Rosy Recruits"
git add -A
git commit -m "Verified working: <what works now>"
git tag verified-YYYY-MM-DD-<label>
git push origin main --tags
```

**Rolling back:**
```bash
git checkout verified-2026-05-26-19passing
# That's a detached HEAD. To make it permanent:
git checkout -b rollback-from-bad-deploy
git push origin rollback-from-bad-deploy
```

---

## 5. "One change is changing across the app" — how to prevent

The signal: you edit one component, three other components break.

Causes:
- Component reads from a global (`window.RosyData`) that you changed
- Component reads from a shared util (`buildUsers`) that you changed
- Component depends on a useState shape that you changed
- CSS variable you changed cascades wider than expected

**Mandatory protocol before any edit:**

1. `grep -rn "<symbol you're about to change>" project/src/` — list ALL callers
2. If >3 callers, the change is high-risk. Either:
   - (a) Make the change additive (new param with default) instead of breaking
   - (b) Update all callers in the same edit
3. After the edit, run `npm test` to catch regressions

**Never:**
- Rename a function used in >2 places without grep-checking
- Change the shape of a global object (`RosyData.X`) without updating every consumer
- Modify an RLS policy without re-running RLS tests
- Edit a top-level `useEffect` dependency list without tracing what depends on its firing

---

## 6. Tests stay green or we don't ship

**Before declaring any fix "deployed":**

```bash
cd "/Users/ben/Documents/Claude OS/Client Work/Rosy Recruits"
npm test
```

- 0 NEW failures vs the baseline → OK to deploy
- ≥1 new failure → STOP. Either fix the regression or revert the change

**Adding a test for every fixed bug is mandatory:**
- Fix introduces a regression-prone behavior → add a Playwright test
  that proves the new behavior works
- Future deploys that break it → suite goes red → you see it before
  the user does

---

## 7. Things that have caused damage and shouldn't be repeated

| Mistake | Mitigation |
|---|---|
| Mass JSX edits across many files in one deploy | One file per deploy unless tests cover all surfaces |
| Touching `RosyData.USERS` shape | Treat it as a public API — additive changes only |
| Adding async fetches inside modals without canceling | Always use a `cancelled` flag in cleanup |
| RLS changes without re-running RLS tests | `npx playwright test 05-rls-privacy.spec.js` after EVERY policy edit |
| Realtime listeners updating data the user is editing | Pause realtime sync when a modal is open in edit mode |

---

## 8. Quick reference: which test catches which bug class

| Bug class | Spec |
|---|---|
| Marketing FAQ audience leak | 01-marketing |
| Signup flow / onboarding bounce | 02-auth |
| Phantom modal on close | 03-admin-user-modal |
| Sensitive columns leaking to non-admin | 05-rls-privacy |
| Em dashes appearing in shipped copy | 06-em-dash |
| Hash deep-link bouncing to dashboard | 09-deep-links |
| Settings field blank when data exists | 04-settings |
| Notifications archive not syncing | 07-notifications |
| 24h time format leaking through | 08-time-format |
| Popup data changing or pre-population missing | TBD (next file: 10-data-integrity.spec.js) |

---

## 9. When the user reports a bug, the flow is

1. **Read the report carefully.** Screenshot? URL? Steps?
2. **Open `ROSY_DEV.md` and `SMOKE_TEST.md`.** Is this an item we test?
3. **Run the relevant spec.** Does it catch the bug?
4. **If no test catches it: add one FIRST** (the test should fail).
5. **Then, and only then, fix the code.** The test goes green.
6. **Run the full suite.** Confirm no other test regressed.
7. **Commit + tag.** `git tag verified-<date>-<bug>`
8. **Report back** with test output + screenshot of fix.

Skip ANY step at the cost of breaking trust.

---

## 10. Permanent fences

- **Never auto-run a "fix it from tests" tool.** Tests describe, humans
  (or me, in Edit calls you can read) prescribe.
- **Never push to main without `npm test` green.**
- **Never delete a test to make it pass.** If a test is wrong, fix the
  test in a separate, labeled commit.
- **Never edit `project/src/` and `tests/` in the same commit** — keep
  app changes separate from test changes so the diff is auditable.
- **Never touch the database schema without an `apply_migration` and
  a corresponding privacy test refresh.**

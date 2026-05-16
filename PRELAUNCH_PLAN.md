# Rosy Recruits — Pre-Launch Plan

## Section 1 — Inventory

### 1.1 Routes / Screens

| Hash route | Component | File:line |
|---|---|---|
| `#marketing` | `MarketingHome` | screen_misc.jsx:178 |
| `#marketing/vendors` | `MkVendorsPage` | marketing_pages.jsx:109 |
| `#marketing/workers` | `MkWorkersPage` | marketing_pages.jsx:163 |
| `#marketing/gallery` | `MkGalleryPage` | marketing_pages.jsx:219 |
| `#marketing/pricing` | `MkPricingPage` | marketing_pages.jsx:249 |
| `#marketing/faq` | `MkFAQPage` | marketing_pages.jsx:309 |
| `#marketing/about` | `MkAboutPage` | marketing_pages.jsx:346 |
| `#marketing/careers` | `MkCareersPage` | marketing_pages.jsx:382 |
| `#marketing/press` | `MkPressPage` | marketing_pages.jsx:418 |
| `#marketing/contact` | `MkContactPage` | marketing_pages.jsx:455 |
| `#marketing/terms` `#marketing/privacy` `#marketing/security` `#marketing/payments-info` `#marketing/disputes-info` | `MkLegalPage` | marketing_pages.jsx:524 |
| `#auth` | `AuthPage` (login/signup/forgot) | screen_misc.jsx:326 |
| `#onboarding` | `OnboardingPage` | screen_misc.jsx:432 |
| `#app/dashboard` (3 variants by role) | `DashboardAdmin/Vendor/Worker` | screen_dashboards.jsx:6 / 28 / 50 |
| `#app/users` `#app/workers` `#app/vendors` `#app/users:<id>` `#app/users:<id>:edit` | `PageDirectory` | screen_admin.jsx:204 |
| `#app/events` (vendor table/cards, worker grid) | `PageEventsVendor` / `PageEventsWorker` | screen_events.jsx:7 / 280 |
| `#app/events:<id>` | `PageEventDetail` | screen_events.jsx:323 |
| `#app/gigs` | `PageGigsVendor` | screen_gigs.jsx:8 |
| `#app/gig-posts` | `PageGigPostsWorker` | screen_gigs.jsx:236 |
| `#app/my-gigs` | `PageMyGigsWorker` | screen_gigs.jsx:384 |
| `#app/venues` | `PageVenues` | screen_admin.jsx:455 |
| `#app/payments` `#app/payments:<id>` | `PagePayments` | screen_admin.jsx:8 |
| `#app/disputes` | `PageDisputes` | screen_admin.jsx:137 |
| `#app/inbox` | `PageInbox` | screen_misc.jsx:8 |
| `#app/notifications` | `PageNotificationCenter` | extras.jsx:109 |
| `#app/settings` | `PageSettings` (7 tabs) | screen_admin.jsx:605 |
| `#app/audit` | `PageAudit` | screen_admin.jsx:754 |
| `#app/analytics` | `PageAnalytics` | screen_admin.jsx:802 |
| `#app/site-content` | `PageSiteContent` | screen_admin.jsx:856 |
| `#app/emails` | `PageEmails` | screen_admin.jsx:915 |
| `#app/gallery` | `PageGallery` | screen_admin.jsx:983 |
| `#app/platform` | `PagePlatformSettings` | screen_admin.jsx:1061 |
| `#app/build-team` | `PageBuildTeam` | extras.jsx:364 |
| `#app/admin-team` | `PageAdminAssistants` | admin_extras.jsx:73 |
| `#app/broadcast` | `PageBroadcast` | admin_extras.jsx:336 |
| `#app/notif-rules` | `PageNotificationRules` | admin_extras.jsx:257 |
| `#app/logout` | inline `Empty` | app.jsx:197 |

### 1.2 Shared components — usage map

| Component | Defined | Used in | Missing from (where pattern would apply) |
|---|---|---|---|
| `Pagination` | components.jsx:419 | screen_dashboards (RecentTx), screen_events (vendor), screen_admin (Payments, Directory) | screen_gigs.jsx (PageGigsVendor, PageGigPostsWorker, PageMyGigsWorker), screen_admin.jsx (PageEmails, PageAudit) |
| `usePaged` | components.jsx:436 | RecentTx, PageEventsVendor, PageDirectory, PagePayments | same as above |
| `BulkActionBar` | components.jsx:449 | PageEventsVendor, PageDirectory | PageGigsVendor (has multi-select but no bar), PageVenues, PageDisputes, PageEmails, PageGallery |
| `Breadcrumbs` | components.jsx:474 | AppHeader (in app shell) | n/a — global |
| `EventImage` | components.jsx:504 | PageEventsVendor, EventCard, PageEventDetail, PageGallery | n/a |
| `SafeImage` | admin_extras.jsx:9 | PageVenues only | n/a |
| `CheckBox` | extras.jsx:355 | PageEventsVendor, PageGigsVendor, PageDirectory, PermissionsModal, TCModal | n/a |
| `ConfirmDialog` | components.jsx:178 | NewRecentUsersCard, PageEventsVendor (single + bulk), PageDirectory (single + bulk), PageVenues | screen_gigs (delete gig has no confirm — toast only), PageEmails (no delete), PageGallery (delete is instant, no confirm) |
| `Empty` | components.jsx:192 | many | screen_gigs.jsx PageGigPostsWorker (no empty state when filtered to nothing) |
| `Modal`, `Slideover` | components.jsx:128/154 | many | n/a |
| `SortMenu` | components.jsx:532 | PageEventsVendor, PageGigsVendor, PageDirectory | PagePayments (no sort), PageVenues (no sort), PageDisputes |
| `TweaksPanel` | tweaks.jsx:48 | **NEVER MOUNTED** | — see P0 #1 |

### 1.3 Tables / lists

| Screen | Pattern | Pagination | Bulk | Sort | Search | Empty |
|---|---|---|---|---|---|---|
| Dashboard RecentTransactions | table | yes | no | no | no | yes |
| Dashboard NewRecentUsersCard | list | no | no | no | no | yes |
| PageEventsVendor (table) | table | yes | yes | yes | yes | yes |
| PageEventsVendor (cards) | grid | **no** (paginates only in table mode) | n/a | yes | yes | yes |
| PageEventsWorker | grid | no | n/a | no | yes | yes |
| PageGigsVendor | grouped table | **no** | **partial** (selection captured, no bar) | yes | yes | no (no empty state for "no events") |
| PageGigPostsWorker | grouped table | no | no | no | yes | **no** |
| PageMyGigsWorker | table | no | no | no | no | yes |
| PageDirectory | table | yes | yes | yes | yes | yes |
| PagePayments | table | yes | no | no | yes | yes |
| PageDisputes | card grid | no | no | no | no | **no** (renders nothing if empty) |
| PageVenues | card grid | no | no | no | yes | yes |
| PageInbox | list | no | n/a | no | search input but no logic | yes (when no conv) |
| PageEmails | table | no | no | no | no | no |
| PageAudit | list | no | no | no | yes | yes |
| PageAdminAssistants | table | no | no | no | no | no |
| PageNotificationRules | table | no | no | no | no | no |
| PageNotificationCenter | list | no | no | no | no | yes |
| PageBuildTeam recent | table | no | no | no | no | no |
| PageGallery | grid | no | no | no | filter pills | yes |

---

## Section 2 — Findings (Bug List)

### P0 — Block launch

**P0-1. TweaksPanel never mounted (entire feature dead).**
- File: tweaks.jsx:48 + app.jsx:128–144
- `TweaksPanel` is exported but App never renders it; no FAB/gear button exists. HANDOFF.md and PRODUCT.md describe a "bottom-right gear icon" — it does not exist. `useTweaks` returns a `set` function that's discarded (`const [tweaks] = useTweaks()` line 31).
- Fix: Mount a floating gear button + `<TweaksPanel>` in App, wire `set` from useTweaks.

**P0-2. Notification dropdown bell does not open the dropdown.**
- File: app.jsx:135 — `onBell={() => setRoute('notifications')}`
- Effect: `notifOpen` state and `<NotificationPanel>` (components.jsx:370) are completely dead. The bell jumps straight to the full-page notifications screen, skipping the inline dropdown that exists.
- Fix: change to `onBell={() => setNotifOpen(true)}`. Or remove dead `NotificationPanel` + `notifOpen` state.

**P0-3. PageGigsVendor — Add Gig form is uncontrolled and discards user input.**
- File: screen_gigs.jsx:197–233 (`AddGigForm`) and modal save at line 141.
- Every input uses `defaultValue`; `onClick` on "Create Gig" only fires a toast — nothing collected, nothing posted.
- Fix: Convert to controlled state in `PageGigsVendor`, pass to `AddGigForm`, persist into `events`/`GIGS` local state OR at minimum capture for the toast body.

**P0-4. PageGigsVendor — Edit Gig form is uncontrolled.**
- File: screen_gigs.jsx:163–177
- All `<input defaultValue=...>`. Save button only toasts, never updates. Save clicked twice with edits silently loses both.
- Fix: Move to controlled `editGig` patches (mirror the Edit Event slideover at screen_events.jsx:158).

**P0-5. PageGigsVendor — Delete gig has no confirmation and no actual deletion.**
- File: screen_gigs.jsx:115
- Trash button toasts "Gig removed" but the row stays. Misleading on launch day.
- Fix: Add `ConfirmDialog`; remove from a local gigs state (mirror events delete).

**P0-6. PageEventDetail — Edit event modal toasts but does not persist.**
- File: screen_events.jsx:474–481
- Save button only toasts; `EVENTS` is read directly so the change vanishes on re-render.
- Fix: Lift events to a state/store accessible across screens, or at minimum patch the in-component view.

**P0-7. Marketing nav "Get started" / "Hire a team" / "Find work" send to signup but onboarding's signup→onComplete flow can break the role.**
- File: screen_misc.jsx:432 (OnboardingPage). Step 1 lets the user pick *both* roles or just vendor; step 2 always renders ProfileForm with `role={role.vendor ? 'vendor' : 'worker'}`. A user who picks BOTH only ever fills the vendor form, and worker selection is silently dropped.
- Fix: Either disallow "both" or stack two profile steps when both selected.

**P0-8. PageDisputes silently renders empty when there are no disputed/late items.**
- File: screen_admin.jsx:142–164
- `disputed.map(...)` with no fallback. Today there are records so it renders, but flipping any test data → blank screen.
- Fix: Wrap in `{disputed.length === 0 ? <Empty .../> : ...}`.

**P0-9. PageGigPostsWorker has no empty state when filters yield nothing.**
- File: screen_gigs.jsx:283–334
- The `{events.map(...)}` returns null for every event → just an empty table body, no message.
- Fix: Compute total visible rows; if 0 render `<Empty .../>` row.

**P0-10. Sidebar "Logout" route lands on a permanent "Logging you out…" empty screen instead of signing out.**
- File: app.jsx:197 + components.jsx:290
- The sidebar Log Out button calls `setRoute('logout')` which renders the empty state forever; user has to manually click another nav item.
- Fix: Wire to `handleSignOut` (which already exists at app.jsx:126). Either remove the `'logout'` route handling or have Sidebar accept and call `onSignOut`.

**P0-11. Header avatar dropdown "View profile / Account settings / Help & support" all collapse to the same destination.**
- File: components.jsx:328–336
- All three first items go to `settings`; "Help & support" navigates to `notifications` which is unrelated.
- Fix: Either remove the redundant entries or add a profile sub-route. Map "Help & support" to `marketing/contact` or external mailto.

**P0-12. PageInbox search input is wired to nothing.**
- File: screen_misc.jsx:35 — `<input ... />` has no `value`/`onChange`.
- Conversations list never filters. "Search" promise broken.
- Fix: Add state + `.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))`.

### P1 — Should fix before launch

**P1-1. PageGigsVendor — bulk select state captured but no BulkActionBar rendered.**
- File: screen_gigs.jsx:15, 57, 98 (selection logic) — no `<BulkActionBar>` anywhere. The header checkbox "select all" works visually but the user has no operations to apply.
- Fix: Add bar with at least Mark Confirmed / Delete (mirror events).

**P1-2. PageVenues — no pagination, no bulk, no sort.**
- File: screen_admin.jsx:455. With ~6 venues today fine; on launch any operator with 30+ scrolls forever.
- Fix: Add `usePaged` (perPage 9 for 3-col grid) + a sort menu (Name / City / Capacity).

**P1-3. PageEventsVendor cards-mode ignores pagination.**
- File: screen_events.jsx:86–88 — uses `filtered` not `paged.slice`. Switching to cards renders all rows, no pagination.
- Fix: Use `paged.slice` in both modes, render `<Pagination>` below cards too.

**P1-4. PageEventsVendor row-click handler tests `closest('button')` but checkbox is a `<span role="checkbox">` not a button — clicking it triggers row navigation.**
- File: screen_events.jsx:117. The td wrapper at line 120 catches it via stopPropagation — OK in practice. **But** in PageGigsVendor:95 the same trick is used and the `[role="checkbox"]` selector is correct. The events one only checks `'button'`. If the user clicks the row's `Badge` or chip (rendered via `<span>`) the row still navigates — fine. If they click the assigned-stack avatars no issue. Low impact, but inconsistent — confirm intentional.

**P1-5. PagePayments — `setOpenTx` effect has stale closure on `txs`.**
- File: screen_admin.jsx:28–32. `useEffect([openId])` doesn't include `txs` in deps. Switching role between admin↔vendor↔worker while a `payments:tX` route is active opens the wrong record.
- Fix: include `txs` in deps or `[openId, role]`.

**P1-6. PageDirectory — `UserDetailModal` reads `user.first` but the modal still mounts after delete.**
- File: screen_admin.jsx:412 — "Opening conversation with ${user.first}" — if `user` is null between deletion and close, crashes. Mitigated by `if (!user) return null` at line 402 but the toast string is built inside an inline closure that captures `user`. Likely safe — verify.
- Also screen_admin.jsx:445 — `user.first` will be undefined for users that don't have a `first` field (e.g. invited users). Verify all USERS have `first` (they do in seed) — but invite/edit flow doesn't recompute first/last from name.
- Fix: derive `first = user.first || user.name?.split(' ')[0] || 'them'`.

**P1-7. PageEventDetail — `editForm.desc` and `editForm.date` show in the small modal, but the slideover Edit Event in PageEventsVendor uses the full `NewEventForm` and writes back via `setEvents`. Two different edit experiences for the same entity.**
- File: screen_events.jsx:474 vs 158
- Confusing. Fix: collapse to one (use the slideover everywhere, remove the small modal at 474).

**P1-8. PageEventDetail "Add gig" button just navigates to `gigs` instead of opening the AddGigForm prefilled with this event.**
- File: screen_events.jsx:359
- Fix: Open the modal here, prefilled with `eventId`.

**P1-9. PageEventDetail Applications tab — "All applications reviewed" empty state shows even when there were never any applications to begin with (because seed always has 4 workers shown).**
- File: screen_events.jsx:438. The `.every` on a 4-element slice returns false initially because `decided` starts empty → so it doesn't show. After rejecting/approving all 4 it shows. Acceptable, but also: **applications are not derived from real applicant data**, just `slice(0, 4)`. A vendor would expect this list to be specific to gigs in this event.
- Fix: derive applicants from gigs-of-event with status `applied` (currently no such data), or label the section as "Sample applicants".

**P1-10. PageMyGigsWorker — "Pending payment" tab filter is `g.status === 'completed'` which is identical to "Past" tab when status=completed.**
- File: screen_gigs.jsx:393–394 — duplicated logic; tabs aren't meaningfully distinct.
- Fix: Filter "Pending" by transactions that are `Pending`/`Not Due` for this worker.

**P1-11. PageInbox compose — selecting a recipient toasts but doesn't open the new conversation.**
- File: screen_misc.jsx:121
- Fix: append a new conversation to local state and `setActive(newId)`.

**P1-12. PageInbox file-attach button uses `fileInputRef` but the input is below the message input — works in DOM. Verify on iOS Safari.**

**P1-13. WriteForMe relies on `window.claude?.complete` which is undefined in the local browser → always falls into the `canned` branch.**
- File: form_helpers.jsx:131–151
- Behavior: works (canned content fills) but **the success toast says "Draft generated"** — the user thinks AI ran. Misleading branding.
- Fix: change toast to "Draft inserted" when running canned, or hide the WriteForMe button when no `window.claude` is available. Confirm policy.

**P1-14. Notification panel `openNotif` link mapping is wrong for notifications that have admin/vendor/worker prefixes.**
- File: components.jsx:374–378. e.g. `n1.link = '#vendor/events/e1'` → `target = 'e1'` → maps to `'events:e1'` ✓. But `n4.link = '#worker/profile'` → target=`'profile'` → maps to `'settings'`. n3 link=`'#worker/my-gigs'` → maps to `'my-gigs'` which is worker-only — clicking as Admin shows "No my-gigs screen yet" empty state.
- Fix: Notifications should be role-aware or all targets should resolve to admin-accessible equivalents.

**P1-15. PageBroadcast — clicking "Send broadcast" with `schedule='schedule'` and a valid time still toasts "sent" not "scheduled" because the toast condition `schedule === 'now'` is correct, but the appended `entry.sent` uses `new Date()` not the scheduled time.**
- File: admin_extras.jsx:357–362
- Fix: write `entry.sent = scheduleTime || new Date()...`.

**P1-16. PageEmails — "Send test" modal accepts any string containing `@` as valid → e.g. `@`. Weak validation.**
- File: screen_admin.jsx:974 — `disabled={!testEmail.includes('@')}`.
- Fix: Use a real email regex.

**P1-17. PageEmails delete flow missing — there's no way to delete a template, no Add new template button.**
- File: screen_admin.jsx:915. If templates don't get used, they bloat. Verify scope.

**P1-18. PageSiteContent "Add section" works but there's no edit, no reorder, no field-level controls — it's a fake.**
- File: screen_admin.jsx:864–910
- Acceptable as v1 if you call it out, but the "Save changes" toast claims "Live on rosyrecruits.com within 60 seconds" — that's a strong promise to make on a screen that does nothing.
- Fix: Either soften the toast ("Mock save — backend coming soon") or hide the Save button.

**P1-19. PageGallery delete does NOT show a confirmation — one click and gone.**
- File: screen_admin.jsx:996, 1044
- Fix: Add `ConfirmDialog`.

**P1-20. PageGallery section filter buttons show count `0` for empty sections — fine — but the "max=1" constraint on `hero/about/vendor/worker` from `GALLERY_SECTIONS` is never enforced. Re-assigning a 2nd photo to "hero" silently overrides nothing — both sit there.**
- File: form_helpers.jsx:34 + screen_admin.jsx:1048.
- Fix: When user changes section, if max=1 and another exists, prompt or auto-evict.

**P1-21. PageBuildTeam → BuildMyTeamWizard step 1's `duration` and `radius` fields accept negative numbers / non-numerics.**
- File: extras.jsx:262, 266 — `+e.target.value` returns NaN for empty input. Subsequent budget math breaks.
- Fix: Add `min={1}` and clamp.

**P1-22. BuildMyTeamWizard "Re-roll" can pick the same set if pool is small (deterministic sort).**
- File: extras.jsx:212–227
- Fix: Add a small random shuffle within tied ratings.

**P1-23. PageNotificationRules — "Save workflows" toast lies; nothing persists across navigation away and back.**
- File: admin_extras.jsx:281
- Note: most mutations are session-local by design; this is consistent with the demo, but the toast wording is too definitive.

**P1-24. AuthPage forgot-password mode never returns to login except via the bottom link. The `setMode('forgot')` link on login is `<a>` with no `href` — keyboard-tab focus skips it.**
- File: screen_misc.jsx:378
- Fix: Make it a `<button type="button" className="btn-link">`.

**P1-25. AuthPage Google sign-in toast says "Welcome back" even on signup mode → wait it ternaries on mode. OK. But on `mode='forgot'` the GoogleButton block is hidden — confirm. ✓**

**P1-26. AuthPage password toggle `<button type="button">` is fine, but the eye icon click doesn't update aria — lacks `aria-pressed` and `aria-label`.**

**P1-27. OnboardingPage step 2 → "Save changes" calls `setStripeOpen(true)` even though the button says "Save changes". Should say "Continue" or "Connect Stripe".**
- File: screen_misc.jsx:486

**P1-28. OnboardingPage Stripe modal "Continue to Stripe" goes nowhere real (toast). On launch this should at least open the actual Stripe Connect flow URL — for the prototype, fine, but worth a label like "Connect (demo)".**

**P1-29. NewRecentUsersCard "delete" only hides locally — `setRoute('users:'+u.id)` from the list still opens the (deleted-here) user fine. Confirm intent: it's per-card local hiding, not deletion. Toast says "User removed", which implies more than that.**
- File: screen_dashboards.jsx:172–177

**P1-30. PageDirectory `closeDetail` always re-routes back to a directory route even if the user opened the modal by clicking a row (no openId set).**
- File: screen_admin.jsx:249–254. Harmless because `setRoute(currentRoute)` is a no-op, but the conditional `if (openId)` is correctly guarded — OK. Verify.

**P1-31. PageDirectory `merged` is recomputed every render with `.map(u => overrides[u.id] ? ... : u)` — fine, but the `useEffect([openId, openAction])` references `merged.find(...)` which captures stale `merged`. After a delete, opening a deep link to that user shows nothing. Acceptable.**

**P1-32. Walkthrough modal-backdrop has no onClick to close. Only the X button and Skip work — clicking outside doesn't dismiss.**
- File: extras.jsx:493
- Fix: Add `onClick={onClose}` on the backdrop with `stopPropagation` on inner panel (mirror Modal).

**P1-33. Walkthrough is auto-opened after `onComplete` from onboarding. If the user has already seen it, it shows again every fresh signup demo — fine. But the Walkthrough has no "don't show again" / persistence (intentional).**

**P1-34. PageNotificationCenter "Mark all read" button is disabled correctly. But unread count after marking shows `(0)` and tab count shows `Unread (0)` — clicking unread tab shows empty state (good).**

**P1-35. ImageUpload has no size guard — accepts an 80 MB photo and embeds as base64. Will lock the page.**
- File: extras.jsx:86–92
- Fix: check `f.size > 8 * 1024 * 1024`, toast error.

**P1-36. ImageUpload default rendering — when round=true it shows a Flower icon centered. When not round and tall, the icon is huge (`size * 0.4` = 48px on 120 box) — fine.**

**P1-37. SignaturePad — `clear()` only clears the canvas pixels but keeps the DPR-scaled context. Fine. Touch on mobile sometimes "scrolls page" on iOS Safari because `touchAction:'none'` is set inline only on the canvas — verify in real Safari.**

**P1-38. AddressInput dropdown overlays everything but in a Modal at z-index <100 it can be clipped by the modal-body overflow. Test: opening the AddressInput inside `VenueFormModal` size=lg.**

### P2 — Nice-to-have

**P2-1. EventCard for worker view (HANDOFF flag) — same `EventCard` renders for both, but the worker version doesn't show "Apply" CTA on the card; user must open the detail.**
- File: screen_events.jsx:219.

**P2-2. PageEventsVendor sort by 'fill' has divide-by-zero risk if `gigCount === 0`.**
- File: screen_events.jsx:36 — `b.filledCount / b.gigCount` returns NaN for events with 0 gigs.

**P2-3. PageGigsVendor sort `priority` does undefined math when an out-of-range priority slips in.**
- File: screen_gigs.jsx:71

**P2-4. RecentTransactionsCard `usePaged(allTxs, 5)` has no resetKey — switching role between vendor↔worker changes scoping but page stays. Edge case.**

**P2-5. Marketing pages use static Unsplash hero images (HANDOFF flag).**

**P2-6. Marketing nav doesn't show mobile burger — sub-page links wrap awkwardly under ~720px.**
- File: marketing_pages.jsx:25.

**P2-7. App-shell sidebar has no mobile toggle — under ~900px the sidebar still renders 220px wide and crushes the main content.**
- File: components.jsx:266 + styles.css.

**P2-8. PageAnalytics range tabs change state but the chart doesn't change shape — "All time" shows the same 12 bars.**
- File: screen_admin.jsx:803–812.

**P2-9. PageAudit "Export CSV" only toasts, no download.**
- File: screen_admin.jsx:782.

**P2-10. PagePlatformSettings "Save changes" only toasts; inputs are uncontrolled `defaultValue`.**
- File: screen_admin.jsx:1067–1086.

**P2-11. PageBroadcast — channel selection buttons accept "no channels" (then `valid` is false ✓) but preview helper renders "via no channels selected" — works, but UX could highlight this.**

**P2-12. SettingsProfile, SettingsAccount inputs all `defaultValue` — uncontrolled. Save toasts but doesn't persist.**
- File: screen_admin.jsx:666–700.

**P2-13. UserDetailModal bio template uses double `user.role === 'worker'` test — second branch unreachable for vendors.**
- File: screen_admin.jsx:445.

**P2-14. Tooltip "title" props are inconsistent — some buttons use `aria-label`, some `title`. Pick one for screen-reader consistency.**

**P2-15. Several `<a>` tags with `onClick` and no `href` — keyboard inaccessible without `tabIndex`. (e.g. screen_misc.jsx:401, marketing footer.)**

### P3 — Polish

**P3-1. fmtDate('mdy-dots') hard-codes 4-digit year regardless of locale — fine for English-only.**

**P3-2. `getGreeting` uses local time on every render — re-renders during midnight rollover not handled. Negligible.**

**P3-3. Inline styles dominate — hard to maintain. Out of scope.**

**P3-4. `app.jsx` ScreenRouter does string parsing of route — fine for now.**

**P3-5. PageDisputes "Mediate" modal has 3 footer buttons including Close — visual order is Close / Release / Split which is unusual; primary action should be rightmost.**

**P3-6. Walkthrough close X button has `border: 0` but no focus state.**

**P3-7. Many Modals use inline Empty as their child instead of a proper layout — fine.**

**P3-8. Console will warn about `usePaged` calling `useState`/`useEffect`/`useMemo` — that's React-rules compliant since usePaged is a hook; OK.**

---

## Section 3 — Pre-launch checklist

### Phase A — Block launch (P0). Tackle in order.
1. Mount `TweaksPanel` + gear FAB in `App` (tweaks.jsx:48 + app.jsx:128) — restore promised feature.
2. Wire bell to `setNotifOpen(true)` (app.jsx:135) — restore notification dropdown.
3. Make `PageGigsVendor` AddGigForm controlled and persist (screen_gigs.jsx:127–145, 197–233).
4. Make `PageGigsVendor` Edit Gig modal controlled and persist (screen_gigs.jsx:163–177).
5. Add ConfirmDialog + actual delete to PageGigsVendor row delete (screen_gigs.jsx:115).
6. Make `PageEventDetail` Edit Event persist OR remove the second edit modal (screen_events.jsx:474–481).
7. Fix `OnboardingPage` "both roles" path (screen_misc.jsx:432–490).
8. Add Empty state to `PageDisputes` (screen_admin.jsx:142–164).
9. Add Empty state to `PageGigPostsWorker` (screen_gigs.jsx:283–334).
10. Wire sidebar Logout → `handleSignOut` (app.jsx:197 + components.jsx:290).
11. Fix avatar dropdown items (components.jsx:328–336).
12. Wire `PageInbox` search input to filtering (screen_misc.jsx:35).

### Phase B — Should fix before launch (P1)
13. Add BulkActionBar to PageGigsVendor (screen_gigs.jsx:8).
14. Add pagination to PageVenues (screen_admin.jsx:455).
15. Use `paged.slice` in PageEventsVendor cards mode + render Pagination (screen_events.jsx:86).
16. PagePayments `useEffect` deps include `txs` (screen_admin.jsx:28–32).
17. UserDetailModal — derive `first` defensively (screen_admin.jsx:412/445).
18. Collapse the duplicate Edit Event experiences (screen_events.jsx:474 vs 158).
19. Wire PageEventDetail "Add gig" to open the modal prefilled (screen_events.jsx:359).
20. Reword "All applications reviewed" + label as samples (screen_events.jsx:425–438).
21. Differentiate "Past" vs "Pending payment" tabs in PageMyGigsWorker (screen_gigs.jsx:386–394).
22. PageInbox compose — actually open new conversation (screen_misc.jsx:121).
23. WriteForMe — change toast wording when canned fallback runs (form_helpers.jsx:131–151).
24. Make notification deep links role-aware (components.jsx:374–378).
25. PageBroadcast — use scheduled time when scheduling (admin_extras.jsx:357–362).
26. Tighter email validation in PageEmails test-send (screen_admin.jsx:974).
27. Confirm dialog before PageGallery delete (screen_admin.jsx:996, 1044).
28. Enforce GALLERY_SECTIONS max=1 (screen_admin.jsx:1048 + form_helpers.jsx:34).
29. Clamp BuildMyTeamWizard numeric inputs (extras.jsx:262, 266).
30. Walkthrough — clicking backdrop closes (extras.jsx:493).
31. ImageUpload size guard + toast on oversize (extras.jsx:86–92).
32. AuthPage forgot-link → button (screen_misc.jsx:378), aria on password toggle (376).
33. OnboardingPage button label fix — "Save changes" → "Continue" (screen_misc.jsx:486).
34. Soften PageSiteContent "live in 60 sec" toast OR hide save (screen_admin.jsx:879).
35. Soften PageNotificationRules "saved" toast wording (admin_extras.jsx:281).
36. Settings/PlatformSettings forms — controlled or label as demo (screen_admin.jsx:666, 1067).
37. Reword NewRecentUsersCard "User removed" toast → "Hidden from list" (screen_dashboards.jsx:172).

### Phase C — Nice-to-have (P2/P3)
38. EventCard for worker — add Apply CTA (screen_events.jsx:219).
39. Guard against /0 in events sort by fill (screen_events.jsx:36).
40. Marketing nav mobile responsiveness (marketing_pages.jsx:25 + styles.css).
41. App-shell mobile responsive sidebar (components.jsx:266 + styles.css).
42. Real CSV export in PageAudit (screen_admin.jsx:782).
43. Make PageAnalytics range actually drive data (screen_admin.jsx:803).
44. UserDetailModal bio — fix unreachable branch (screen_admin.jsx:445).
45. Standardize on `aria-label` over `title` across icon buttons.
46. Replace `<a onClick>` with `<button class="btn-link">` everywhere.
47. Reorder Mediate dispute footer buttons (screen_admin.jsx:168).
48. Walkthrough X close button focus state (extras.jsx:499).

---

## Section 4 — QA test plan (manual smoke)

Run via `python3 -m http.server 8000` from the repo root, open `http://localhost:8000`.

### Marketing (default landing)
- [ ] `#marketing` loads with hero, gig-type tab bar visible, no console errors
- [ ] All 5 nav links (Vendors / Workers / Gallery / Pricing / FAQ) load and scroll to top
- [ ] Footer links: About / Careers / Press / Contact / Terms / Privacy / Security / Payments / Disputes — each loads
- [ ] "Get started" + "Hire a team" + "Find work" all reach `#auth` signup
- [ ] Pricing — Monthly/Yearly toggle changes prices
- [ ] FAQ — accordion expand/collapse on click
- [ ] Gallery — image click opens modal, X closes, ESC closes
- [ ] Contact — submit disabled until name/email/body filled, submit shows toast and clears form
- [ ] Contact — Write-it-for-me opens, fills body
- [ ] Press "Read" buttons (do nothing — confirm scope)

### Auth
- [ ] Login → submit (with prefilled creds) → toast → app
- [ ] Signup → password requirements update live → "I agree" → submit only enabled when valid
- [ ] Forgot password → "Send reset link" → toast
- [ ] Eye icon toggles password visibility
- [ ] Google button → toast → app
- [ ] Bottom toggles login↔signup↔forgot

### Onboarding
- [ ] Step 1 — pick Vendor, Worker, or Both → Continue
- [ ] Step 2 — terms checkbox opens TC modal — sign + check → "I agree"
- [ ] Step 2 — back to step 1 preserves selection
- [ ] Save changes → Stripe modal → Continue or Skip → app + walkthrough
- [ ] **Adversarial:** Pick BOTH roles → step 2 only shows vendor profile (P0-7)

### Walkthrough
- [ ] 6 slides per role, dots advance
- [ ] "Show me" deep-links and closes tour
- [ ] Skip closes
- [ ] X closes
- [ ] Click outside backdrop — DOES NOTHING (P1-32)

### App shell
- [ ] Role switch top-right → resets to dashboard
- [ ] Bell icon — opens dropdown? (P0-2 — currently navigates instead)
- [ ] Avatar menu — View profile / Account settings → Settings; Take the tour → walkthrough; Help & support → notifications (P0-11); Log out → marketing
- [ ] Breadcrumbs render on detail pages, root and section are clickable
- [ ] Bottom-right gear — should open Tweaks (P0-1, missing)

### Sidebar
- [ ] Each role shows its sections, badges visible
- [ ] Click each item — page loads, no white screen
- [ ] Settings nav-item works
- [ ] Log Out — should sign out (P0-10, currently shows empty page)

### Dashboard (each role)
- [ ] Stat cards count up animation
- [ ] Upcoming events row click → event detail; keyboard Enter does same
- [ ] Recent transactions table click → invoice modal opens; pagination works
- [ ] New & Recent users — toggle Active/Inactive (toast); delete (confirm + toast); Edit pencil opens user detail in edit mode

### Events (vendor)
- [ ] Stat cards
- [ ] Search filters
- [ ] Sort menu cycles correctly
- [ ] Filter modal — toggle status checkboxes, Apply, Reset
- [ ] Table/Cards toggle — switch shows different layout
- [ ] **Adversarial:** Cards mode pagination — confirm none renders (P1-3)
- [ ] Row click → event detail
- [ ] Action icons — view / edit slideover / delete confirm
- [ ] Bulk select header → check, BulkActionBar appears at bottom — Mark Open/Draft/Completed/Delete
- [ ] New Event slideover — required field disabling correct, Write-for-me, Publish toast
- [ ] Edit Event slideover — controlled, persists in session

### Events (worker)
- [ ] Filter chips toggle
- [ ] Search filters
- [ ] Empty state when filters empty
- [ ] Card click → detail with Apply tab

### Event detail
- [ ] Back to events
- [ ] Tabs: Overview / Gigs / Applications / Payments
- [ ] Vendor view: Edit event button (P0-6) and Add gig button (P1-8)
- [ ] Worker view: Apply on each open gig → modal → Confirm
- [ ] Applications tab — Approve / Reject / Message each row
- [ ] Payments tab — table rows render

### Gigs (vendor)
- [ ] Group rows expand/collapse
- [ ] Sort: by date / priority / fill (P2-3)
- [ ] Search filters
- [ ] Add Gig modal (P0-3) — fields capture, Create toasts
- [ ] Edit Gig (row click or pencil) — fields editable, save persists (P0-4)
- [ ] Trash button — confirm + delete (P0-5)
- [ ] Bulk select — header check works visually but bar absent (P1-1)

### Gig posts (worker)
- [ ] Group rows
- [ ] Empty state when no matches (P0-9)
- [ ] Type filter modal toggles, Apply
- [ ] Location modal — city/radius slider, Apply
- [ ] Apply → modal → Confirm → Pending badge + Withdraw

### My gigs (worker)
- [ ] Tabs Upcoming / Past / Pending — distinct results (P1-10)
- [ ] Mark complete modal → Submit
- [ ] Rate vendor modal — stars hover, submit disabled until stars chosen
- [ ] Directions opens Google Maps in new tab

### Users / Workers / Vendors directories
- [ ] Search filters
- [ ] Sort menu
- [ ] Filter modal — Active/Inactive
- [ ] Pagination — Next/Previous; clamps when last page emptied
- [ ] Bulk select — Activate/Deactivate/Delete; ConfirmDialog for delete
- [ ] Row click → detail modal
- [ ] Edit profile — fields editable, Save
- [ ] Delete row — confirm
- [ ] Invite (admin only) → modal → Send
- [ ] Deep link `#app/users:u3:edit` — opens detail in edit mode

### Venues
- [ ] Search
- [ ] Add Venue → form validation (name/city/capacity/address required)
- [ ] Card View opens detail; Edit opens form prefilled; delete confirms
- [ ] Cover image upload (P1-35 size guard)

### Payments
- [ ] Status tabs filter; search filters; pagination works
- [ ] Row click → invoice modal; Send receipt toast
- [ ] Approve (admin/vendor on Pending) → toast
- [ ] Dispute → form → File dispute toast
- [ ] Deep link `#app/payments:t5` opens that invoice (P1-5 verify role-switch)

### Disputes (admin)
- [ ] Renders disputed/late cards
- [ ] **Adversarial:** Empty seed — should show empty state (P0-8)
- [ ] View thread modal — close
- [ ] Mediate modal — Release / Split / Close

### Inbox
- [ ] Pick conversation → load
- [ ] Send message → echoes in 900ms
- [ ] Search filters list (P0-12)
- [ ] Compose — pick recipient — opens conv (P1-11)
- [ ] Voice/Video buttons → coming-soon modals
- [ ] Three-dot menu — mute/archive/report toasts
- [ ] Attach file — toast with name+size

### Notifications (full page)
- [ ] All / Unread tabs
- [ ] Click notification → marks read, navigates (P1-14 verify per role)
- [ ] Mark all read disables when none unread

### Settings (7 tabs)
- [ ] Profile — photo upload, Save toast (P2-12 controlled)
- [ ] Account — toggle 2FA visual
- [ ] Notifications — 4 toggles
- [ ] Payouts — Manage in Stripe button (no-op? confirm)
- [ ] Privacy — role-specific copy, Export/Hide toggles
- [ ] Team — empty + Invite button
- [ ] Danger — Delete account button (confirm scope)

### Audit log
- [ ] Search filters
- [ ] Export CSV toast (P2-9)

### Analytics
- [ ] Range tabs (P2-8)
- [ ] Bars render, top vendors/workers tables

### Site content / Emails / Gallery / Platform settings
- [ ] Site content — input fields edit; Add section modal; remove section toast (P1-18)
- [ ] Emails — open template; edit subject/body/live; Send test (validation P1-16); Save persists in window store
- [ ] Gallery — upload (file size); section dropdown reassigns; delete instant (P1-19)
- [ ] Platform — uncontrolled inputs (P2-10)

### Build my team
- [ ] Hero CTA opens wizard
- [ ] 4 steps; back/next; numeric inputs (P1-21)
- [ ] Auto-pick produces team; Re-roll regenerates (P1-22); X removes; Send invites toast

### Admin team
- [ ] Stat cards
- [ ] Row click opens permissions modal
- [ ] Preset chips swap permissions; group toggle; per-perm checkboxes
- [ ] Owner row read-only
- [ ] Invite admin modal

### Notification rules
- [ ] All toggles flip
- [ ] Reset defaults / Save workflows toast (P1-23)

### Broadcast
- [ ] Audience pills
- [ ] Channel pills toggle
- [ ] Subject + body required; Schedule mode requires datetime
- [ ] Preview updates live; Recent broadcasts list updates
- [ ] **Adversarial:** Schedule mode shows correct sent-time (P1-15)

### Adversarial / cross-cutting
- [ ] Open two browser tabs to the same hash — both render independently (no shared state expected)
- [ ] Click "Back" mid-edit (Edit Event slideover open) — slideover stays open, hash unchanged ✓
- [ ] Reload mid-edit — all session state lost (intentional)
- [ ] Double-submit signup form — submit becomes disabled while `submitting` true ✓
- [ ] Switch roles in app while on `#app/payments:t5` — verify P1-5
- [ ] Switch roles while on `#app/my-gigs` (worker-only) as admin — empty fallback "No my-gigs screen yet" ✓
- [ ] Resize to 600px wide — sidebar overlap (P2-7) and marketing nav wrap (P2-6)
- [ ] Tab through forms with keyboard only — links-as-`<a>` skipped (P2-15)
- [ ] Open Tweaks — does not exist (P0-1)
- [ ] Click bell — wrong destination (P0-2)
- [ ] Apply for the same gig twice — second click does nothing because state already set ✓
- [ ] Delete an event then try the deep link — falls back to "Event not found" empty ✓

---

## Section 5 — Open questions for the user

- **Tweaks panel scope:** the gear FAB and TweaksPanel were promised (HANDOFF/PRODUCT) but never wired. Do you want me to wire them, or are you cutting that feature for v1?
- **Notification dropdown vs full page:** currently the bell jumps to the full page. Do you want both surfaces (dropdown for quick-view, full page for archive) or just the page? If just the page, I'll delete the dropdown code.
- **`OnboardingPage` "both roles":** how should this flow handle a user who picks Vendor + Worker? Two-step profile, or merged form, or force one choice?
- **Sidebar Log Out:** should clicking Log Out in the sidebar return the user to marketing immediately (like the avatar menu) or open a confirm-first dialog?
- **PageEmails / Gallery / Site content / Platform settings persistence:** these have toasts that imply server-side save. For launch, do you want me to (a) persist to localStorage so refresh keeps changes, (b) leave session-only with softer toast wording, or (c) wire to Supabase? You said Supabase is out of scope for this audit — just confirm the toast wording change is acceptable.
- **WriteForMe AI:** without `window.claude`, the canned-content fallback always runs. Should the button be hidden when no AI provider is available, or do you want it to keep working with the canned templates and just relabel?
- **Dispute mediation:** the Mediate modal has 3 mutually-exclusive primary actions (Release / Split / Close). Confirm this is intentional vs. a single decision flow with reason picker.
- **PageNotificationRules / Broadcast `RosyStores`:** anything in `window.RosyStores` resets on refresh. Acceptable for launch demo?
- **Mobile / responsive:** PRODUCT.md says "responsive web only, not native". The app shell + marketing nav both break under ~900px. Is mobile in scope for launch, or just desktop demo?
- **Sample applications data:** PageEventDetail Applications tab shows 4 random workers per event regardless of which gigs they applied to. Want me to derive from real applicant state, or label as "sample"?
- **Site Content "live within 60 seconds" toast:** the marketing surface isn't actually rebuilt from this. Should I wire the headlines to drive `MarketingHome` for real, or change the toast wording?

# Rosy Recruits — Pre-Demo Testing Checklist

**Live URL:** https://rosy-demo.vercel.app · https://rosy.rascals-co.com
**Admin login:** `bwbcollier@gmail.com` (Google)
**Demo accounts in DB:** `ylaccone@gmail.com` (worker), `ben@yunikonlabs.com` (worker)
**Email forwarding:** ALL outbound mail force-routed to `ben@pronocoders.com` in demo mode
**Stripe:** test mode — card `4242 4242 4242 4242`, any future date, any CVC, SSN `000-00-0000`, routing `110000000`, account `000123456789`

---

## How to use

- `[ ]` → not tested
- `[x]` → passed
- `[!]` → failed (add note)
- Notes go inline below each item

---

## 0. Boot & environment

- [ ] **Marketing loads** — visit `/` in incognito → see hero, no console errors
  - Notes:
- [ ] **PWA install banner** appears on first dashboard load → dismiss persists across refresh
  - Notes:
- [ ] **Cache-bust working** — hard refresh (Cmd-Shift-R) shows latest commit hash in DevTools sources
  - Notes:

---

## 1. Sign-up + onboarding (worker)

- [ ] Click **Get started** → auth screen renders
- [ ] **Continue with Google** with a brand-new account → lands on **Onboarding** screen (not dashboard)
- [ ] Pick **Worker** role
- [ ] T&C modal opens with full terms + W-9 form (Name, business, SSN/EIN, classification)
- [ ] Sign + check agreement → "I agree" enables
- [ ] Complete onboarding → lands on dashboard with **Application Pending** popup blocking everything
- [ ] Popup has Rosy logo, no buttons (per spec)
- [ ] **Welcome email arrives** at `ben@pronocoders.com` titled `[DEMO → <your email>] Welcome to Rosy Recruits, <first>`
- Notes:

---

## 2. Sign-up + onboarding (vendor)

- [ ] Sign up with another fresh Google account → pick **Vendor**
- [ ] T&C shows vendor variant: full rates table + 11 numbered T&C sections
- [ ] Completes onboarding → Application Pending popup
- [ ] **Vendor welcome email arrives** at `ben@pronocoders.com`
- Notes:

---

## 3. Admin verification flow

- [ ] Sign in as `bwbcollier@gmail.com` in another browser/tab
- [ ] Lands on Admin dashboard, portal pill = teal **Admin portal**
- [ ] **Users** page → see pending accounts → click ★ **UserCheck** icon on one
- [ ] Toast: "<name> verified"
- [ ] **Verified email arrives** at `ben@pronocoders.com` ("You're in — start using Rosy Recruits")
- [ ] In the pending user's tab → refresh → popup gone, dashboard accessible
- Notes:

---

## 4. Header + navigation

- [ ] **Report dev issue** button visible top-right (admin only)
- [ ] Click it → modal opens with Page / Severity / Description fields
- [ ] **Screenshot upload** field works (file picker)
- [ ] **Paste from clipboard** (Cmd-V image) attaches screenshot
- [ ] Submit → toast "Issue reported"
- [ ] **Airtable** RI Developer base → Dev Issues table → new row visible with screenshot
- Notes:

---

## 5. Sidebar badges

- [ ] Badge numbers reflect new items since last visit (per user, per route)
- [ ] Click Events → badge clears to 0
- [ ] Refresh → still 0
- [ ] Wait for new event (admin creates one) → badge bumps to 1 on workers' sidebar
- Notes:

---

## 6. Admin → Users / Workers / Vendors directory

- [ ] Status tabs at top: **All / Active / Inactive** switch the list
- [ ] **Message** icon row action opens new conversation composer pre-filled to that user
- [ ] **Bookmark** row action toggles save-to-shortlist → "My team (N)" filter chip shows only saved
- [ ] **Verify** icon visible only for non-admin unverified rows
- [ ] **Active/Inactive** toggle in row + in user-detail drawer persists across refresh
- [ ] Click user row → detail drawer opens
- [ ] Drawer has **Active/Inactive** toggle button prominent at top
- [ ] Drawer has **Send password reset** button → click → toast confirms; check inbox
- [ ] Pagination Next/Prev → scrolls back to top of list
- Notes:

---

## 7. Admin → Events / Gigs

- [ ] Events page: filters work (City / Status / Date / Type)
- [ ] **New Event** modal → fill in → save → appears in list
- [ ] Click event card → detail page → 4 tabs visible (Overview/Gigs/Applications/Payments)
- [ ] Edit event → drawer opens → save → reflects in list
- [ ] Gigs page: click row → detail popup (NOT editor); Edit button INSIDE popup
- [ ] Pagination scroll-to-top works
- Notes:

---

## 8. Admin → Venues

- [ ] Venues listed in cards/table; **ViewToggle** swaps
- [ ] **Active/Inactive** column toggle works
- [ ] Inactive venues hidden from event/gig venue dropdowns
- [ ] Pagination scroll-to-top works
- Notes:

---

## 9. Admin → Payments / Disputes

- [ ] Payments list shows all transactions; filter tabs work (All / Paid / Pending / Disputed)
- [ ] **Approve** button on Pending row → toast "Payment released" + **email arrives** to `ben@pronocoders.com` (worker-paid)
- [ ] Status badge changes to Paid
- [ ] **Dispute** action opens dialog → file dispute → moves to Disputes page
- [ ] Disputes page renders 4 stat cards + dispute rows
- [ ] **Mediate** action opens thread
- [ ] Pagination scroll-to-top works
- Notes:

---

## 10. Admin → Notifications / Inbox

- [ ] Notifications page: filter row on ONE line (Search / Type select / Tabs / Mark all)
- [ ] Type select dropdown text is left-aligned, no border quirks
- [ ] Toggle preferences (Email/Push) render teal when on (no white background)
- [ ] **Mark all read** → bell dot clears
- [ ] Inbox: empty state centered horizontally
- [ ] Compose conversation → send message → appears in stream
- Notes:

---

## 11. Admin → Site Content editor

- [ ] Page selector at top: Home / Vendors / Workers / Gallery / FAQ / About / Contact / Terms / Privacy
- [ ] Pick **Home** → see editable blocks (hero heading, sub, CTA label, section titles, etc.)
- [ ] Edit hero heading → Save
- [ ] Open marketing site in new tab → refresh → confirm change is live
- [ ] Pick **Terms** → see full ToS body (~1500 words) editable as markdown
- [ ] Same for Privacy / Worker Agreement / Vendor Agreement
- Notes:

---

## 12. Admin → Email Templates

- [ ] 12 templates listed (welcome, verify, application-received, worker-confirmed, day-of, worker-paid, dispute-filed, weekly-summary, worker-rejected, invite-user, signup-notification, etc.)
- [ ] Click row → edit modal opens
- [ ] **Plain text / HTML** toggle works
- [ ] **Iframe live preview** updates as you type
- [ ] All emails show Rosy logo at top (from htmlWrap shared wrapper)
- [ ] Save → confirms via toast
- Notes:

---

## 13. Admin → Gallery

- [ ] Images grid renders 6+ images
- [ ] Per-image **Replace** button → file picker → upload swaps the image
- [ ] Per-image **Delete** button → confirm dialog → removes
- [ ] **Upload new image** primary button works
- Notes:

---

## 14. Admin → Analytics

- [ ] **KPI strip** renders 6+ stats (revenue / active users / signups / completed / avg rate / dispute rate)
- [ ] **Signups over 12 months** line chart renders
- [ ] **Gigs by type** horizontal bars (Lead / Design / Assist / Strike)
- [ ] **Revenue by month** bar chart
- [ ] **Top 10 vendors** table populated
- [ ] **Top 10 workers** table populated
- [ ] **All invoices** table with **Export CSV** button → downloads file
- [ ] **Activity by role** bars
- [ ] **Conversion funnel** (Signups → Verified → First gig → First payment)
- Notes:

---

## 15. Admin → Admin Team

- [ ] **Invite** modal has email + permissions section
- [ ] 8 permission toggles: Users / Events&Gigs / Payments / Disputes / Site Content / Email Templates / Settings / Analytics
- [ ] Save invite → appears in `rr_admin_invites` table (or localStorage fallback)
- [ ] Click team member CARD → read-only detail drawer
- [ ] Click team member **gear icon** → permissions modal
- Notes:

---

## 16. Admin → Settings

- [ ] Visible tabs: Profile / Account / Notifications / Payouts (Privacy/Team/Danger Zone HIDDEN)
- [ ] **2FA** removed from Account tab
- [ ] Profile fields: photo upload, first/last, email (read-only), phone with US validator, title, bio, city, state
- [ ] Phone validator: typing letters or wrong format shows error
- [ ] Save → persists across refresh
- Notes:

---

## 17. Vendor portal

- [ ] Switch to Vendor role → portal pill = coral
- [ ] **Connect Stripe** banner appears on dashboard
- [ ] Click banner → redirects to Stripe Express onboarding
- [ ] Complete with test info (SSN `000-00-0000`, DOB any, routing `110000000`, account `000123456789`)
- [ ] Land back on dashboard → banner gone
- [ ] Refresh → still gone (status persisted to `rr_profiles.stripe_account_id`)
- [ ] Dashboard greeting "Good Morning, <FirstName>" capitalized correctly
- [ ] Quick-action buttons (Post a gig / New event / Build my team) navigate AND open form
- [ ] Events page: filter chips work; **New Event** button creates draft
- [ ] Gigs page: row click → READ-ONLY popup with details (no editable inputs); Edit button inside
- [ ] Build my team page renders worker recommendations
- [ ] Inbox shows conversations scoped to this vendor only
- [ ] Settings page: same tabs as admin (no Privacy/Team/Danger/2FA)
- Notes:

---

## 18. Worker portal

- [ ] Switch to Worker → portal pill = gold
- [ ] **Connect Stripe** banner appears
- [ ] Dashboard quick-actions: Update availability / Find gigs work
- [ ] **Events** page: filter chips Lead/Design/Assist/Strike narrow the list
- [ ] Click event card → detail page → **only Overview + Gigs tabs** (no Applications/Payments/Message)
- [ ] Apply button on event card → popup → pick a gig → Confirm
- [ ] **Application email arrives** at `ben@pronocoders.com` (addressed to vendor)
- [ ] Re-apply → "Already applied" warning toast (no duplicate)
- [ ] **Available gigs** page: cards clickable → detail popup with full info + Apply
- [ ] My Gigs: shows applied gigs as "Applied" badge; assigned as "Confirmed"
- [ ] Empty state has **Find gigs** CTA button
- [ ] Payments: no phantom $0 rows; only real completed gigs
- Notes:

---

## 19. Cross-role guards

- [ ] Signed in as vendor → manually paste worker URL (e.g. `#app/my-gigs`) → silent redirect to vendor dashboard
- [ ] Signed in as worker → paste admin URL (`#app/users`) → silent redirect
- [ ] Signed in as admin → can access any route
- Notes:

---

## 20. OAuth + Auth edge cases

- [ ] Sign out → marketing page → nav shows "Log in / Get started"
- [ ] Sign in → marketing nav shows "Log out / Open app"
- [ ] Visit `/` while signed in → auto-redirects to dashboard
- [ ] Refresh on `#app/...` → stays on that route (session restored)
- [ ] Visit `#auth` while signed in → still allowed (so logout works)
- Notes:

---

## 21. Mobile (open https://rosy-demo.vercel.app on iPhone/Android)

- [ ] Marketing page responsive, no horizontal scroll
- [ ] Sidebar collapses behind burger icon
- [ ] Dashboard cards stack
- [ ] iOS Safari: "Add to Home Screen" toast appears on first visit
- [ ] Android Chrome: PWA install prompt fires
- Notes:

---

## 22. Stripe Connect end-to-end

- [ ] Vendor connected: `chargesEnabled: true` (check via `/api/stripe/connect-status?userId=<id>`)
- [ ] Worker connected: `payoutsEnabled: true`
- [ ] (Future) Admin approves payment → real Stripe charge happens → worker payout queued
- Notes:

---

## 23. Errors & polish

- [ ] DevTools console: no red errors during normal navigation
- [ ] No 404s in Network tab on any route
- [ ] All toast notifications dismiss after ~4 seconds
- [ ] Loading splash appears briefly while profile loads (not stuck)
- Notes:

---

## Final blockers to fix before client demo

> Add anything from above marked `[!]` here with priority

| Priority | Item | File / Page | Note |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

---

## Ready-to-ship sign-off

- [ ] All P0 blockers resolved
- [ ] Client demo URL bookmarked
- [ ] Demo accounts (vendor + worker + admin) tested in incognito
- [ ] Postmark inbox cleared so client sees fresh emails during demo
- [ ] Stripe Dashboard in test mode confirmed (NO live charges)
- [ ] Recording of full walkthrough saved to Loom / Drive for handoff

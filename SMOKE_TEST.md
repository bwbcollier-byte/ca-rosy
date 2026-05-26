# Rosy Recruits — Smoke test plan

Goal: every flow listed here becomes a Playwright spec. Once a flow is
automated, regressions can't sneak back in.

**Conventions**
- Cross out anything not worth automating: `~~text~~`
- Add anything missing
- Star (⭐) flows that have ever broken and must be locked in
- One test per numbered item

---

## 1. Auth + onboarding

### Signup
1. ⭐ Fresh vendor email → submit signup → land on `/#onboarding` within 5s (no spinner-stuck)
2. ⭐ Fresh worker email → same as above
3. Existing onboarded user signs in → land on `/#app/dashboard` within 5s
4. Signup with weak password → submit blocked, requirements list shows uncovered items
5. Signup without T&Cs checkbox → submit blocked
6. Signup with already-existing email → toast: "already has an account"

### Onboarding completion (vendor)
7. ⭐ Pick Vendor → fill profile (name, phone, title, company, bio) → land on hours toggle off → tap "Continue" → no field-wipe, no form reset
8. Toggle hours on → first row blank (no auto-Monday) → pick Tuesday + 09:00–17:00
9. Add another period same day (Tuesday 13:00–16:00) → no overlap warning
10. Add overlapping period (Tuesday 10:00–14:00) → inline "Overlaps another period" warning
11. Add reversed time (open > close) → inline "Close time must be after open time"
12. Open T&Cs → sign → submit → land on dashboard within 3s
13. ⭐ After Continue, the form DOES NOT clear before redirect

### Onboarding completion (worker)
14. Pick Worker → fill profile → address → add travel address (Date range Oct 1–Oct 7)
15. T&Cs modal: Name field pre-populated from First+Last → sign → W-9 required → submit

### Password reset
16. ⭐ Click "Forgot password" → enter email → toast confirmation
17. ⭐ Click reset link in email (or simulated query param) → lands on `Set a new password.` form (NOT marketing page)
18. Enter new password meeting requirements → submit → auto-signed-in → dashboard

### Logout
19. ⭐ Sign out → next page load DOES NOT auto-restore session (rosy.auth cleared)

---

## 2. Verification gate (admin approval)

20. ⭐ Worker signs up → after Continue, sees ONLY "Application received!" modal — no sidebar, no dashboard behind
21. ⭐ Modal has no close X / Escape doesn't dismiss it / clicking outside doesn't dismiss
22. Log out button works
23. ⭐ Admin marks worker active → worker's tab dismisses wall WITHOUT refresh (realtime)
24. Admin marks worker inactive again → wall returns

---

## 3. Marketing site

25. ⭐ Anonymous visitor lands on `/#marketing` → no bounce, no auth wall
26. Signed-in user visits `/#marketing` → stays on marketing (no auto-redirect to dashboard)
27. ⭐ Hard refresh on `/#marketing/faq` → still on FAQ page, NOT bounced
28. ⭐ Hard refresh on `/#app/events:<id>` → stays on event detail
29. ⭐ Marketing FAQ page: vendor-only FAQs DO NOT appear
30. ⭐ Marketing home "Common questions" section: vendor-only FAQs DO NOT appear
31. Worker-only FAQs do not appear on marketing pages
32. Get started button → routes to signup

---

## 4. Admin user-detail modal

33. ⭐ Click a user row → modal opens
34. ⭐ EMAIL field populated (not blank)
35. ⭐ PHONE field populated
36. Location, street, ZIP populated
37. ⭐ Business hours render in human format (9 AM, not 09:00) with multi-period support
38. Title, company, services all populated
39. Edit name → save → header reflects new name
40. ⭐ Edit photo → save → photo persists (does NOT revert to placeholder)
41. ⭐ Close (X) → modal vanishes, NO second modal opens behind
42. Mark active on a pending non-admin → DB writes both `status=active` AND `verified=true`
43. Mark inactive → reverts both flags
44. Send password reset button → toast: "Reset email sent to {email}"

---

## 5. Events

### Vendor flow
45. Create new event → fill form → save as draft → row appears in My Events
46. ⭐ Draft event row has Publish button → click → status flips to Open
47. Edit event → full slideover, all fields editable (name, desc, date, end date, start/end times, venue, image, address, gig types)
48. Validation: end date must be ≥ start date

### Event detail page
49. ⭐ Add gig button opens inline modal (does NOT route away from event)
50. Add gig modal: gig type chip select, date pre-filled from event, time pre-filled
51. "Write it for me" button generates description from event + venue context
52. After save, gig appears in Gigs tab
53. ⭐ Gigs tab empty state has "Add a gig" button when no gigs
54. Edit gig from event detail → save → row updates
55. Click event row from /events page → lands on event detail

### Worker view
56. /events shows only published events with open gigs
57. Worker can apply to a gig → modal with role picker

---

## 6. Gigs

### Vendor /gigs
58. Stat cards: My Gigs, Open Gigs (Live), My Events, Open Events (Live)
59. ⭐ Click "My Gigs" card → routes to /gigs (self-link OK)
60. Click "Open Events" card → routes to /events
61. Vendor sees gigs grouped by event (including drafts)
62. ⭐ Gig with pending applications shows "X pending · review" link
63. Click "X pending · review" → opens event detail with Applications tab active

### Worker /gig-posts
64. ⭐ City filter starts empty (NOT auto-set to home city) → all gigs visible
65. Sort menu works (Soonest first, Latest first, Name A–Z, etc.)
66. Search by venue/role/city filters list
67. Apply to a gig → status flips to "Applied" immediately (optimistic)
68. ⭐ Applied gig appears in /my-gigs Upcoming tab
69. ⭐ "Featured gig posts" card on worker dashboard: no crash when event missing

### Applicant approval
70. ⭐ Admin/vendor opens event Applications tab → applicant card shows worker name + rating + gig type
71. Approve button → status flips to "confirmed" → row stays visible with green "Approved" badge
72. Approved row has "Undo" button → reverts to applied
73. Reject button → row dimmed with "Rejected" badge

---

## 7. Inbox

74. ⭐ Click Message on a user profile → inbox opens INSTANTLY with that user's thread visible (no 1s blank wait)
75. ⭐ Send a message → message appears instantly in thread (optimistic), DB write succeeds in background
76. ⭐ Open conversation → unread count on sidebar Inbox tab drops to 0
77. ⭐ Same user clicked twice in quick succession → ONE conversation, not two
78. New conversation modal: search shows users → click → opens existing thread (no dupe)
79. ⭐ Recipient gets ONE email notification per burst (not per message) — throttled until they open
80. After recipient views the thread, next inbound message re-triggers email

---

## 8. Notifications

81. New event in scope → bell shows red dot
82. Open Notifications page → Settings auto-mark-read fires → badge drops to 0
83. ⭐ Archive notification → disappears from page AND bell AND sidebar count
84. Archive persists across refresh
85. "All" tab count matches visible count (not lifetime)
86. "Unread" tab shows only unread, count matches
87. Mute "Gig applications" in Settings → those rows hide from Notifications page

---

## 9. Stripe / Payments

88. Vendor dashboard shows "Connect Stripe to fund gigs" banner
89. Payments view shows same banner
90. After Connect → return URL `/#app/dashboard?stripe=connected` → modal fires: "You're connected. Let's make your first event."
91. ⭐ Hash router strips ?query — base route is still `dashboard`, no "No dashboard?stripe=connected screen yet" empty
92. Modal Create Event button → routes to /events with New Event slideover open
93. Empty state on Payments table when no transactions (not bogus $0 rows)

---

## 10. Settings

94. Profile email field shows current user's email (from auth.session)
95. Email field is read-only (managed by auth)
96. Location field is Google Places Autocomplete
97. State input removed
98. Worker: Hourly rate + Services on same row, Services as chip multi-select
99. Notification preferences: 8 toggles (gig_application, gig_confirmed, gig_rejected, new_message, payment_sent, payment_disputed, rating_received, weekly_digest)
100. Payouts tab labeled "Payments" for vendors, "Payouts" for workers
101. Privacy & Data: no "Your Data" export section
102. No Danger Zone tab
103. Saving profile persists across refresh

---

## 11. FAQ admin

104. Add an FAQ with audience checkboxes (Vendor/Worker/Marketing) → row appears with tags
105. Each row has audience chips visible
106. Click Edit → audience chips editable
107. Saving with NO audiences shows warning "Pick at least one"
108. ⭐ FAQ Order tab: pick Vendor → list shows only vendor-tagged
109. Drag row → drop indicator (coral line) appears above/below target
110. After drop, order persists across refresh (audience_orders saved)
111. Marketing /faq page reflects the marketing-audience drag order
112. In-app /help reflects the role-audience drag order

---

## 12. Privacy / RLS

113. ⭐ Anonymous client: `SELECT * FROM rr_profiles` returns 0 rows (RLS blocks)
114. ⭐ Anonymous client: `SELECT * FROM rr_profiles_public` returns rows but only safe columns (no email, phone, stripe_*, etc.)
115. ⭐ Signed-in vendor: cannot read another vendor's `stripe_account_id` from rr_profiles
116. Signed-in vendor: can read own row including stripe status
117. Admin: can read all rows including all sensitive columns
118. UI displays for non-self users only show safe data (name, role, photo, rating)

---

## 13. Time / locale formatting

119. ⭐ 13:00–16:00 displays as "1 PM – 4 PM" everywhere (events, gigs, business hours)
120. ⭐ Joined date renders in viewer's local timezone (not UTC off-by-one)
121. fmtDate dot format works (05.25.2026)

---

## 14. Cache busting & deploy

122. ⭐ After a new deploy, refreshing any page picks up new JSX (cache buster query stamps work)
123. No service worker registered (legacy SW unregistered on load)
124. Network tab shows JSX URLs with `?v=` query string

---

## 15. Em dashes / copy

125. ⭐ No em dashes in: email subjects, email bodies, error toast messages, transactional messages
126. Welcome email signature is "The Rosy Recruits team" (no em dash prefix)

---

# Suggested cuts / additions from you

(Cross out items above. Add new ones below.)

**Add:**
- 

**Skip / lower priority:**
- 

---

# Next step

Once you've trimmed this list, I:
1. Set up Playwright in `tests/`
2. Write one spec per approved numbered item
3. Wire to GitHub Actions so the suite runs on every push
4. Add seed/teardown SQL helpers so tests don't pollute prod
5. Lock in a "tests must be green before deploy" rule

Estimated build time: 2.5–3 hours for first 30 critical (⭐) tests, then incremental as we add more.

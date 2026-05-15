# Rosy Recruits — Session Handoff

## Where the files live (remote cloud container)

```
/home/claude/repo/
├── index.html                        ← entry point (serve this)
├── HANDOFF.md                        ← this file
├── README.md                         ← original design brief
├── chats/
│   └── chat1.md                      ← full design conversation transcript
└── project/
    ├── Rosy Recruits.html            ← original prototype entry point (same as index.html)
    ├── styles.css                    ← complete design system (1011 lines)
    ├── assets/
    │   └── logo.avif
    ├── uploads/                      ← design reference screenshots
    │   ├── admin portal1-8.webp
    │   ├── vendor portal1-7.webp
    │   ├── worker portal1-8.webp
    │   └── marketing pages1-9.webp
    └── src/
        ├── icons.jsx                 ← SVG icon components → window.Icons
        ├── data.jsx                  ← seed data → window.RosyData
        ├── components.jsx            ← shared UI components (Modal, Sidebar, AppHeader, etc.)
        ├── screen_dashboards.jsx     ← Admin/Vendor/Worker dashboards
        ├── screen_events.jsx         ← Events pages (vendor manage + worker browse)
        ├── screen_gigs.jsx           ← Gigs pages (vendor manage + worker apply/complete)
        ├── screen_admin.jsx          ← All admin-only pages (payments, disputes, directory, etc.)
        ├── screen_misc.jsx           ← Inbox, MarketingPage router, AuthPage, OnboardingPage
        ├── marketing_pages.jsx       ← All public marketing sub-pages
        ├── extras.jsx                ← SignaturePad, ImageUpload, BuildMyTeamWizard, Walkthrough
        ├── form_helpers.jsx          ← AddressInput, GoogleButton, WriteForMe AI helper
        ├── admin_extras.jsx          ← Assistants, PermissionsModal, NotificationRules, Broadcast
        ├── tweaks.jsx                ← Runtime theming panel (colors, fonts, density, sidebar)
        └── app.jsx                   ← Root App, hash router, role switcher, ScreenRouter
```

## To run locally on your Mac

You already have the `project/` folder from your Claude Design export. You just need `index.html` next to it.

**Option A — you have the project/ folder already:**
1. Drop `index.html` (from this repo) into the same folder as `project/`
2. Run: `python3 -m http.server 8000`
3. Open: http://localhost:8000

**Option B — push this repo to GitHub and clone it:**
1. Create a new repo on github.com
2. Come back to this Claude Code session and say: "push to github.com/YOURNAME/YOURREPO"
3. Clone it on your Mac: `git clone https://github.com/YOURNAME/YOURREPO`
4. `cd YOURREPO && python3 -m http.server 8000`

> **Important:** Must be served via HTTP — opening index.html directly as a file:// URL will fail because browsers block cross-origin script loads for local files.

---

## What this app is

**Rosy Recruits** is a floral event staffing SaaS platform. Three portals:
- **Admin** — platform operator: manages users, venues, payments, disputes, settings, analytics
- **Vendor** — florist/event organizer: creates events, posts gigs, manages applications, pays workers
- **Worker** — event staff: browses gigs, applies, completes work, gets rated

## Tech stack

- **React 18** via CDN (no build step, no npm)
- **Babel Standalone** compiles JSX in the browser at runtime
- **Plain CSS** — Clay design system tokens in `styles.css`
- **No backend** — all data is in-memory seed data in `data.jsx`; mutations are simulated

## Design system

- **Clay aesthetic**: cream canvas (`#fffaf0`), Recoleta display font (loaded from Google Fonts in styles.css), warm organic feel
- **Rosy accents**: Coral `#E8473F` and Teal `#1ABCB0`
- **Density**: comfy (default) or compact
- **Dark sidebar** toggle
- **Tweaks panel**: bottom-right gear icon → cycles brand color, display font, density, sidebar style, stat strip, count-up animations

## How components are shared across files

Files load sequentially. Each exports to `window`:
- `Object.assign(window, { ComponentName, ... })` — used by most files
- `function ComponentName()` declared at top level — used by `screen_misc.jsx`; Babel eval makes them global

## Key navigation

| Hash | Screen |
|------|--------|
| `#app/dashboard` | Role dashboard (default) |
| `#app/events` | Events list |
| `#app/gigs` | Gigs list |
| `#app/inbox` | Two-panel inbox/chat |
| `#app/payments` | Payments (admin) |
| `#app/directory` | User directory (admin) |
| `#app/analytics` | Analytics (admin) |
| `#app/settings` | Settings (admin, 7 tabs) |
| `#marketing` | Marketing home |
| `#marketing/pricing` | Pricing page |
| `#auth` | Login / signup |
| `#onboarding` | Role pick → profile → T&C → Stripe |

Bottom-left of the app has shortcut buttons to jump between Marketing / Auth / Onboarding / App.

## Role switcher

Header dropdown (top-right of app shell) lets you flip between Admin / Vendor / Worker without logging out. Useful for demoing all three portals.

## What was done in the last session

The design was already fully built across the 14 source files. The only deliverable created was `/home/claude/repo/index.html` — a root-level entry point that loads all source files from `project/src/` in the correct dependency order, making the app servable from the repo root.

## Suggested next steps for a new session

1. **Push to GitHub** so the user can clone it locally
2. **Bug fixes / polish** — open browser console after serving and address any JS errors
3. **Add missing screens** — check `chats/chat1.md` for any screens mentioned but not yet built
4. **Real backend** — replace `window.RosyData` with API calls if converting to a production app
5. **Build step** — migrate to Vite + proper React if bundle size or performance matters

# Rosy Recruits

## Product Purpose

Rosy Recruits is a floral event staffing SaaS platform that connects florists (vendors) with skilled event workers. Three portals serve three distinct user types — Admin (platform operator), Vendor (florist/event organizer), and Worker (event staff) — each with role-tailored dashboards, workflows, and tools.

The product replaces brittle group-text staffing with a real marketplace: vendors post events and gigs, workers apply, work gets done, payments flow, ratings build reputation.

## Users

- **Vendors** — florists and event coordinators running weddings, corporate functions, and large floral installs. Often time-pressed, juggling multiple events per week. They need to staff fast and trust quality.
- **Workers** — event staff, floral assistants, riggers, drivers. Often gig-economy income stackers. They want clear earnings, fair vendors, and a low-friction apply-and-show-up flow.
- **Admins** — platform operators. Manage disputes, payments, content, settings, analytics. Need full visibility without drowning in noise.

## Register

**Product.** This is application UI, not a marketing surface. Users are in a task: posting a gig, applying to a gig, resolving a dispute, reconciling payments. The bar is earned familiarity — Linear / Stripe / Notion-grade fluency.

The marketing surfaces (`#marketing/*`) are the one exception and run in brand register.

## Brand & Tone

**Voice**: warm, capable, never twee. The floral context invites whimsy; we resist it. Cream + coral + teal warmth, but the chrome feels like a serious tool.

**Anti-references**:
- Not Eventbrite (too generic, too SaaS-cold)
- Not Mailchimp (too cartoony, too whimsical-corporate)
- Not Salesforce (too enterprise-cold)
- Not Notion (too utilitarian, no warmth)

**Closest spiritual neighbours**: Square for Restaurants (warmth + density), Resy (premium service tool), Linear (precision + restraint).

## Strategic Principles

1. **The role switcher is a demo gimmick, not a feature.** The real users have one role; the platform should feel like it was built for them, not for the meta-narrative.
2. **Density beats whitespace where data matters.** Vendor managing 20 events + 60 gigs needs to see them all. Dashboard cards earn their space.
3. **Floral isn't an aesthetic, it's a context.** Don't theme on flowers (rose-pink everything, petal motifs). Theme on the work: events, schedules, people, money.
4. **One bold accent, not three.** Coral is the brand. Teal is a tactical secondary for state (success-adjacent). Cream is the surface. Resist piling on accent #4.
5. **Live, mutable, demo-friendly.** Every CRUD action should "work" without a backend. Mutations live in memory, reset on reload. This is intentional.

## Out of Scope

- Real auth (mock OAuth flow only)
- Real payments (Stripe Connect is mocked)
- Mobile native apps (responsive web only)
- A11y AAA (AA is the bar)
- i18n (English only, US-format currency/dates)

## Constraints

- **No build step.** React 18 via UMD CDN + Babel Standalone in-browser. Every JSX file is a `<script type="text/babel">`.
- **No npm dependencies in the runtime.** Everything is window-global or CDN.
- **Single CSS file.** `styles.css` holds all tokens + components.
- **15 source files** in `project/src/`, loaded in dependency order. Components are exposed onto `window` via `Object.assign` or top-level `function` declarations.
- **In-memory state only.** No localStorage persistence (intentional for demo reset).

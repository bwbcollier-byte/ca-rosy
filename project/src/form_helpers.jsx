/* Additional shared components: address autocomplete, AI write-for-me, Google auth, runtime stores */

const { useState: F_us, useEffect: F_ue, useRef: F_ur } = React;
const F_I = window.Icons;

/* ============ In-memory runtime stores ============ */
(function initRosyStores() {
  if (window.RosyStores) return;
  // Shared HTML wrapper applied at send time. Body is the inner HTML.
  const htmlWrap = (inner) => `<!doctype html><html><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:24px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);"><tr><td style="background:#F47C5D;padding:18px 24px;color:#fff;font-weight:600;font-size:18px;font-family:Georgia,serif;"><img src="https://rosy-demo.vercel.app/project/assets/logo.avif" alt="Rosy Recruits" height="32" style="height:32px;vertical-align:middle;display:inline-block;margin-right:10px;" />Rosy <span style="opacity:0.8;">Recruits</span></td></tr><tr><td style="padding:28px 28px 24px;font-size:15px;line-height:1.6;color:#1A1A1A;">` + inner + `</td></tr><tr><td style="padding:16px 28px;background:#FAF7F2;border-top:1px solid #ECE6DD;font-size:11.5px;color:#7A7470;">You're getting this because you have a Rosy Recruits account. <a href="{{unsubscribe_url}}" style="color:#7A7470;">Unsubscribe</a> · <a href="{{help_url}}" style="color:#7A7470;">Help</a></td></tr></table></td></tr></table></body></html>`;
  const emails = {
    'welcome-vendor': { name: 'Welcome — vendor', subject: 'Welcome to Rosy Recruits, {{first_name}}', body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">Welcome aboard, {{first_name}}.</h2><p>Your vendor account is being reviewed. Most studios are approved within a few business hours — we'll email you the moment it's live.</p><p>While you wait, you can finish setting up your studio profile, add a venue, and draft your first event.</p><p style="margin-top:24px;"><a href="{{app_url}}/#app/dashboard" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Open my dashboard</a></p><p style="color:#7A7470;font-size:13px;margin-top:24px;">— The Rosy Recruits team</p>`), lastEdited: '2026-05-15', live: true },
    'welcome-worker': { name: 'Welcome — worker', subject: 'Welcome to Rosy Recruits, {{first_name}}', body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">Welcome to the crew, {{first_name}}.</h2><p>Your worker account is being reviewed. We verify every applicant manually to keep the network strong — expect a decision within a few business hours.</p><p>In the meantime, fill out your profile and W-9 so you're ready to apply the moment you're approved.</p><p style="margin-top:24px;"><a href="{{app_url}}/#app/settings" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Finish my profile</a></p><p style="color:#7A7470;font-size:13px;margin-top:24px;">— The Rosy Recruits team</p>`), lastEdited: '2026-05-15', live: true },
    'verified': { name: 'Account verified', subject: "You're in — start using Rosy Recruits", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">You're verified, {{first_name}}.</h2><p>Your {{role}} account is live. Jump in and start using the platform.</p><p style="margin-top:24px;"><a href="{{app_url}}/#app/dashboard" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Open Rosy Recruits</a></p>`), lastEdited: '2026-05-15', live: true },
    'application-received': { name: 'Vendor — application received', subject: '{{worker_name}} applied to your gig', body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">New application for {{event_name}}</h2><p><strong>{{worker_name}}</strong> (★ {{worker_rating}}, {{worker_gigs}} gigs) applied to your <strong>{{gig_type}}</strong> gig.</p><table cellpadding="0" cellspacing="0" style="margin:18px 0;font-size:13.5px;color:#5A5550;"><tr><td style="padding:4px 12px 4px 0;">Event</td><td>{{event_name}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Date</td><td>{{event_date}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Rate</td><td>\${{hourly_rate}}/hr</td></tr></table><p><a href="{{app_url}}/#app/applications" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Review application</a></p>`), lastEdited: '2026-05-10', live: true },
    'worker-confirmed': { name: 'Worker — gig confirmed', subject: "You're confirmed: {{event_name}}", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">You're confirmed for {{event_name}}.</h2><table cellpadding="0" cellspacing="0" style="margin:18px 0;font-size:13.5px;color:#5A5550;"><tr><td style="padding:4px 12px 4px 0;">Date</td><td>{{event_date}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Call time</td><td>{{call_time}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Venue</td><td>{{venue_name}}, {{venue_city}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Lead</td><td>{{lead_name}}</td></tr><tr><td style="padding:4px 12px 4px 0;">Rate</td><td>\${{hourly_rate}}/hr</td></tr></table><p><a href="{{app_url}}/#app/my-gigs" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">See gig details</a></p>`), lastEdited: '2026-05-10', live: true },
    'worker-rejected': { name: 'Worker — application not selected', subject: 'Update on your {{event_name}} application', body: htmlWrap(`<p>Hi {{worker_first}},</p><p>Thanks for applying to <strong>{{event_name}}</strong>. The vendor has filled the role this time. Plenty more gigs in your feed.</p><p style="margin-top:18px;"><a href="{{app_url}}/#app/gig-posts" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Find more gigs</a></p>`), lastEdited: '2026-05-04', live: true },
    'day-of-event': { name: 'Day-of-event reminder', subject: "Today: {{event_name}} — call time {{call_time}}", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">It's go day, {{worker_first}}.</h2><p><strong>{{event_name}}</strong> · Call time <strong>{{call_time}}</strong> · {{venue_name}}, {{venue_address}}</p><p>Reply to your vendor in the app if you're delayed. Safe travels.</p><p style="margin-top:18px;"><a href="{{maps_url}}" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Open directions</a></p>`), lastEdited: '2026-05-15', live: true },
    'worker-paid': { name: 'Worker — payment paid', subject: "You've been paid ${{amount}}", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">$ {{amount}} just landed.</h2><p>For <strong>{{event_name}}</strong> on {{event_date}}.</p><p>Funds should reach your Stripe payout account within 2 business days.</p>`), lastEdited: '2026-05-06', live: true },
    'dispute-filed': { name: 'Both — dispute filed', subject: 'A dispute was filed on {{invoice}}', body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">Dispute on {{invoice}}</h2><p>Amount: <strong>$ {{amount}}</strong><br>Reason: {{reason}}<br>Filed by: {{filed_by}}</p><p>You have <strong>48 hours</strong> to respond before our team steps in.</p><p style="margin-top:18px;"><a href="{{app_url}}/#app/disputes" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Respond now</a></p>`), lastEdited: '2026-05-12', live: true },
    'weekly-summary': { name: 'Both — weekly summary', subject: 'Your week on Rosy Recruits', body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">Hi {{first_name}}, here's your week.</h2><p><strong>{{gigs_count}}</strong> gigs · <strong>{{hours}}</strong> hours · <strong>$ {{earned}}</strong> earned.</p><p>Upcoming: {{upcoming_count}} confirmed.</p>`), lastEdited: '2026-04-28', live: false },
    'invite-user': { name: 'Invite — new user', subject: "You've been invited to Rosy Recruits", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">{{inviter_name}} invited you.</h2><p>You've been invited to join Rosy Recruits as a <strong>{{role}}</strong>. Set up your account in under a minute and start using the platform.</p><p style="margin-top:24px;"><a href="{{invite_url}}" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Accept invitation</a></p><p style="color:#7A7470;font-size:13px;margin-top:24px;">— The Rosy Recruits team</p>`), lastEdited: '2026-05-18', live: true },
    'signup-notification': { name: 'Signup — waitlist welcome', subject: "Welcome to Rosy Recruits — you're on the list", body: htmlWrap(`<h2 style="margin:0 0 14px;font-size:22px;">Welcome, {{first_name}}.</h2><p>You're on the Rosy Recruits list. Please confirm your email so we can keep you posted on launch and early access.</p><p style="margin-top:24px;"><a href="{{verification_url}}" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:600;">Confirm email</a></p><p style="color:#7A7470;font-size:13px;margin-top:24px;">— The Rosy Recruits team</p>`), lastEdited: '2026-05-18', live: true },
  };
  const notificationTemplates = {
    'application-received': { name: 'Vendor — new application', title: 'New application', body: '{{worker_name}} applied to your {{gig_type}} gig at {{event_name}}.', live: true, lastEdited: '2026-05-15' },
    'application-approved': { name: 'Worker — application approved', title: "You're booked!", body: '{{vendor_first}} confirmed you for {{event_name}} on {{event_date}}.', live: true, lastEdited: '2026-05-15' },
    'application-rejected': { name: 'Worker — application rejected', title: 'Application update', body: 'Your application to {{event_name}} wasn’t selected this time.', live: true, lastEdited: '2026-05-15' },
    'payment-released':     { name: 'Worker — payment released', title: "You've been paid", body: '${{amount}} for {{event_name}} just sent.', live: true, lastEdited: '2026-05-15' },
    'gig-tomorrow':         { name: 'Worker — gig tomorrow', title: 'Heads up — gig tomorrow', body: '{{event_name}} at {{venue_name}}, call time {{call_time}}.', live: true, lastEdited: '2026-05-15' },
    'dispute-filed':        { name: 'Both — dispute filed', title: 'Dispute filed', body: 'A dispute was filed on invoice {{invoice}}. Respond within 48h.', live: true, lastEdited: '2026-05-15' },
    'welcome':              { name: 'Welcome notification', title: 'Welcome to Rosy Recruits!', body: 'Take the tour to see how everything works.', live: true, lastEdited: '2026-05-15' },
  };
  const legalDisclaimer = 'Draft — replace before launch with attorney review.';
  const legalDocs = {
    'terms-of-service': { name: 'Terms of Service', updatedAt: '2026-05-18', disclaimer: legalDisclaimer, body: `# Terms of Service

**Effective Date:** {{effective_date}}

These Terms of Service ("Terms") govern your access to and use of the Rosy Recruits platform, including our website, mobile applications, and related services (collectively, the "Services") operated by Rosy Recruits, Inc., a Delaware corporation with its principal place of business in Chicago, Illinois ("Rosy Recruits," "we," "us," or "our"). By creating an account or using the Services you agree to be bound by these Terms.

## 1. Eligibility & Account Ownership

You must be at least 18 years old and able to form a legally binding contract to use the Services. By registering, you represent that all information you provide is true, accurate, and complete, and you agree to keep it current. You are responsible for safeguarding your password and for all activity that occurs under your account. Accounts are personal to the individual or legal entity that created them and may not be transferred, sold, or assigned without our prior written consent.

If you create an account on behalf of an organization (for example a floral studio), you represent that you have authority to bind that organization to these Terms, and "you" refers to both you individually and the organization.

## 2. The Marketplace

Rosy Recruits operates a neutral, two-sided marketplace that connects floral-event vendors with independent workers ("Workers"). We are **not** a party to any contract for services formed between a vendor and a Worker. We do not employ Workers, we do not direct or control the manner in which work is performed, and we make no representations about the suitability, qualifications, or conduct of any user beyond the identity- and background-verification steps disclosed in our Help Center.

Vendors are solely responsible for: (a) the work performed at their events; (b) site safety; (c) compliance with all applicable labor, wage, tax, and licensing laws; and (d) any insurance reasonably required for the work. Workers are solely responsible for performing the agreed services in a professional manner and for their own tax obligations.

## 3. User Conduct

You agree not to: (a) use the Services for any unlawful purpose; (b) post false, misleading, defamatory, or infringing content; (c) harass, threaten, or discriminate against any user; (d) circumvent the platform to avoid fees (including, without limitation, soliciting Workers or Vendors to transact off-platform for gigs introduced through Rosy Recruits within twelve (12) months of the introduction); (e) interfere with the technical operation of the Services; (f) scrape, copy, or reverse-engineer any part of the Services; or (g) misrepresent your identity, qualifications, or affiliation.

We reserve the right, but have no obligation, to monitor activity on the Services and to remove or modify any content that violates these Terms.

## 4. Payments, Stripe Connect & Fees

Payment processing on the Services is provided by Stripe, Inc. and is subject to the [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal). By agreeing to these Terms (or by continuing to use the Services), you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from time to time. As a condition of using payment processing through Stripe, you authorize Rosy Recruits to obtain account information about you from Stripe, and to share information with Stripe as necessary to operate the Services.

Vendors fund gigs at the time of posting via Stripe. Funds are held by Stripe in escrow until released to Workers following vendor approval of hours, or after the auto-approval window (24 hours after submitted hours) expires. Platform fees (4–8% of the gig amount, depending on plan) and Stripe processing fees (2.9% + $0.30) are deducted before payout. We may change fees on 30 days' written notice.

Workers acknowledge that funds are not earned until services have been performed and hours have been approved, and that payout timing depends on Stripe's standard banking schedule.

## 5. Refunds, Chargebacks & Tax Reporting

Because the Services involve performed services rather than goods, refund eligibility is limited and is handled through the dispute process below. Workers who earn $600 or more in a calendar year will receive an IRS Form 1099-NEC, which Rosy Recruits will issue by January 31 of the following year using information you provided in your W-9.

## 6. Disputes Between Users

Either party may file a dispute within fourteen (14) days of the gig date by submitting the dispute form in the Services. We will review evidence from both sides and issue a non-binding mediation decision typically within forty-eight (48) hours. Possible outcomes include hours adjustment, partial or full refund, full payment release, account strike, or suspension. Either party may appeal a decision once.

Our mediation is a service convenience, not a substitute for legal process, and our decisions do not preclude either party from pursuing other remedies available at law.

## 7. Intellectual Property

The Services, including all software, designs, logos, text, and other content owned or licensed by Rosy Recruits, are protected by intellectual-property laws and are owned by Rosy Recruits or its licensors. We grant you a limited, non-exclusive, non-transferable, revocable license to use the Services for their intended purpose.

You retain ownership of content you upload (portfolios, photographs, profile copy) and grant Rosy Recruits a worldwide, non-exclusive, royalty-free license to host, store, reproduce, modify, display, and distribute that content solely to operate, market, and improve the Services. You represent that you own or have all necessary rights to the content you upload.

## 8. Indemnification

You agree to defend, indemnify, and hold harmless Rosy Recruits, its officers, directors, employees, and agents from and against any claim, demand, loss, liability, damage, or expense (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Services; (b) your breach of these Terms; (c) any contract or interaction between you and another user; (d) your violation of any applicable law; or (e) content you submit through the Services.

## 9. Disclaimers & Limitation of Liability

THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. ROSY RECRUITS DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.

TO THE FULLEST EXTENT PERMITTED BY LAW, ROSY RECRUITS'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES IS LIMITED TO THE GREATER OF (A) THE AMOUNTS PAID BY YOU TO US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). IN NO EVENT WILL WE BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOST PROFITS, LOST REVENUE, OR PERSONAL INJURY AT AN EVENT).

## 10. Termination

You may stop using the Services at any time. We may suspend or terminate your access at our discretion for any breach of these Terms, suspected fraud, or behavior that puts other users at risk. Upon termination, any funds owed to you will be released, less any disputed amounts, within sixty (60) days. Sections 4–11 survive termination.

## 11. Governing Law & Arbitration

These Terms are governed by the laws of the State of Illinois, without regard to its conflict-of-laws principles. Any dispute arising out of or relating to these Terms or the Services that is not resolved through mediation under Section 6 shall be resolved by **binding individual arbitration** administered by JAMS in Cook County, Illinois, in accordance with the JAMS Streamlined Arbitration Rules and Procedures, and judgment on the award may be entered in any court of competent jurisdiction. **YOU AND ROSY RECRUITS EACH WAIVE THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO PARTICIPATE IN A CLASS ACTION.** You may opt out of arbitration within thirty (30) days of first accepting these Terms by emailing legal@rosyrecruits.com with the subject "Arbitration Opt-Out."

## 12. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will notify you by email or through the Services at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.

## 13. Contact

Questions about these Terms? Email **legal@rosyrecruits.com** or write to Rosy Recruits, Inc., Attn: Legal, 238 N Halsted St, Chicago, IL 60661.
` },
    'privacy-policy': { name: 'Privacy Policy', updatedAt: '2026-05-18', disclaimer: legalDisclaimer, body: `# Privacy Policy

**Effective Date:** {{effective_date}}

Rosy Recruits, Inc. ("Rosy Recruits," "we," "us," or "our") respects your privacy. This Privacy Policy describes how we collect, use, share, and protect your personal information when you use the Rosy Recruits platform, website, and related services (the "Services"). By using the Services you agree to the practices described here.

## 1. Information We Collect

**Information you provide.** Account details (name, email, phone, mailing address, profile photo), business information (studio name, website, EIN), identity-verification documents (government ID, selfie, W-9), payment details (bank account or card information collected by our payments processor), gig content (event descriptions, photos, ratings, messages), and any communications you send to us.

**Information collected automatically.** Device identifiers, IP address, browser type, operating system, referring URLs, pages visited, timestamps, crash reports, and cookies or similar technologies. We use cookies for authentication, fraud prevention, analytics, and to remember preferences.

**Information from third parties.** Identity-verification results from our verification partner (e.g., Persona), payout and risk signals from Stripe, fraud signals from anti-abuse providers, and information from social logins if you elect to use them.

## 2. How We Use Information

We use personal information to: (a) create and operate accounts; (b) match Vendors with Workers and process gigs and payments; (c) verify identity and prevent fraud, money laundering, and abuse; (d) mediate disputes; (e) comply with tax, accounting, and other legal obligations (including issuing 1099-NEC forms); (f) communicate with you about your account, transactions, security alerts, and (with your consent or where permitted) marketing; (g) improve, secure, and personalize the Services; and (h) enforce our Terms and protect our rights, property, and users.

## 3. Legal Bases (EEA / UK Users)

Where applicable law requires a legal basis, we rely on: contractual necessity (to provide the Services), legitimate interests (to operate, secure, and improve the Services), legal obligation (tax, anti-fraud, compliance), and consent (for certain marketing communications and optional cookies).

## 4. How We Share Information

We share personal information with:

- **Service providers** under contract — hosting (Vercel, Supabase), payments (Stripe), email (Postmark), analytics (PostHog), customer support tooling, and identity verification (Persona).
- **Other users** — to operate the marketplace (Workers see Vendor postings; Vendors see Worker profiles, ratings, and contact information after confirming a gig).
- **Authorities or third parties** when required by law, subpoena, court order, or to investigate potential violations of our Terms or to protect the safety, rights, or property of any person.
- **In a corporate transaction** — to a successor in a merger, acquisition, financing, reorganization, or sale of all or part of our business.

We **do not** sell personal information for monetary consideration, and we do not share personal information for cross-context behavioral advertising.

## 5. Cookies & Tracking

We use first-party cookies for authentication and platform security, and limited third-party analytics cookies (PostHog) to understand product usage. You can control cookies through your browser settings; disabling some cookies may break parts of the Services.

## 6. Your Choices & Rights

You can: (a) update your profile in Settings; (b) request a download of your data via Settings → Privacy → Export; (c) request deletion of your data (subject to legal-retention obligations such as IRS rules); (d) opt out of marketing emails via the unsubscribe link in any marketing email or in Settings; and (e) opt out of certain cookies through your browser.

**California residents** have additional rights under the CCPA/CPRA, including the right to know, delete, correct, and limit use of sensitive personal information, and the right to non-discrimination for exercising these rights. **EEA/UK residents** have rights under the GDPR / UK GDPR, including the rights of access, rectification, erasure, restriction, portability, and objection, and the right to lodge a complaint with a supervisory authority.

To exercise any of these rights, email **legal@rosyrecruits.com** with the subject "Privacy Request." We will verify your request and respond within the timeframes required by law.

## 7. Data Retention

We retain personal information for as long as your account is active and as needed to provide the Services. Financial and tax records are retained for at least seven (7) years to comply with IRS rules. Dispute and abuse records are retained for at least three (3) years.

## 8. Security

We use industry-standard administrative, technical, and physical safeguards to protect personal information, including TLS 1.3 in transit, AES-256 at rest, role-based access controls, least-privilege secrets management, and regular security review. No system is perfectly secure, and you use the Services at your own risk.

## 9. Children's Privacy

The Services are not directed to children under 16, and we do not knowingly collect personal information from anyone under 16. If you believe a child has provided us with personal information, contact us immediately and we will delete it.

## 10. International Transfers

Rosy Recruits is based in the United States. By using the Services, you understand that your information will be transferred to and processed in the United States and other countries that may have different data-protection laws.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be announced via email or in the Services at least 14 days before they take effect.

## 12. Contact

Questions about this Privacy Policy? Email **legal@rosyrecruits.com** or write to Rosy Recruits, Inc., Attn: Privacy, 238 N Halsted St, Chicago, IL 60661.
` },
    'worker-agreement': { name: 'Worker Agreement', updatedAt: '2026-05-18', disclaimer: legalDisclaimer, body: `# Worker Agreement

**Effective Date:** {{effective_date}}

This Worker Agreement ("Agreement") is entered into between you ("Worker," "you," or "your") and Rosy Recruits, Inc. ("Rosy Recruits," "we," or "us") and governs your use of the Rosy Recruits platform as a service provider to floral-event vendors ("Vendors"). It supplements, and does not replace, our Terms of Service.

## 1. Independent Contractor Status

You are an independent contractor — not an employee, partner, agent, joint venturer, or franchisee — of either Rosy Recruits or any Vendor that engages you through the Services. Nothing in this Agreement creates an employment relationship. You are responsible for: (a) the manner and means by which you perform services; (b) supplying your own tools and reliable transportation; (c) paying all federal, state, and local taxes on your earnings (including self-employment tax); (d) maintaining any licenses or certifications required by law; and (e) obtaining your own health, disability, and liability insurance.

Neither Rosy Recruits nor any Vendor will withhold any taxes, contribute to Social Security or Medicare on your behalf, or provide unemployment, workers' compensation, retirement, health, or other employee benefits in respect of your work on gigs sourced through the Services.

## 2. Eligibility & Verification

To register as a Worker, you must: (a) be at least 18 years old; (b) be legally authorized to work in the United States; (c) complete identity verification through our verification partner; (d) submit a valid IRS Form W-9; and (e) maintain accurate profile information including services offered, rates, and availability. Lead and Design Workers may be subject to portfolio review; all Workers may be re-verified periodically.

## 3. Gig Workflow

You may browse and apply to gigs that match your services and availability. Once you accept a confirmed booking, you commit to perform the services described on the dates and at the locations specified. You agree to: (a) arrive on time and ready to work; (b) follow reasonable instructions from the Vendor regarding the result of the work (not the manner of performance, which remains in your control); (c) report submitted hours honestly; (d) communicate proactively about delays or problems; and (e) treat Vendor crews, venue staff, and guests with professionalism.

## 4. Payment

Payment for completed gigs is made through Stripe Connect after the Vendor approves your submitted hours, or after the 24-hour auto-approval window expires. Rosy Recruits is not the source of payment; we facilitate the transaction on behalf of the Vendor.

You acknowledge that hourly rates posted on gigs are gross amounts; you are responsible for your own income tax. Workers who earn $600 or more in a calendar year will receive IRS Form 1099-NEC by January 31 of the following year.

## 5. No-Shows & Conduct

A no-show or last-minute cancellation (less than 24 hours before call time) may result in a strike on your account. Three strikes within a 12-month period may result in suspension. Verified instances of theft, harassment, intoxication on site, falsifying hours, or other serious misconduct will result in immediate termination of your account and may be reported to law enforcement.

## 6. Off-Platform Solicitation

You agree not to solicit, accept, or fulfill engagements from Vendors you met through the Services outside of the platform for a period of twelve (12) months following the introduction. This is a material term — violations may result in account termination and may be enforced by injunctive relief or liquidated damages equal to twice the platform fees that would have been due.

## 7. Insurance & Indemnification

You are responsible for any insurance you deem appropriate for your work. You agree to indemnify and hold harmless Rosy Recruits and the Vendor for any claims, damages, or losses arising out of your acts or omissions while performing services, including personal injury, property damage, or breach of confidentiality.

## 8. Confidentiality

Vendor client lists, event details, guest information, design concepts, and pricing are confidential. You agree to use such information solely to perform the gig and not to disclose it to any third party.

## 9. Termination

You may terminate this Agreement at any time by closing your Rosy Recruits account. We may terminate this Agreement if you breach it or our Terms of Service. Sections 1, 6, 7, 8, 10, and 11 survive termination.

## 10. Governing Law & Arbitration

This Agreement is governed by Illinois law. Disputes are subject to the binding individual arbitration and class-action waiver described in our Terms of Service.

## 11. Contact

Questions about this Worker Agreement? Email **legal@rosyrecruits.com**.
` },
    'vendor-agreement': { name: 'Vendor Agreement', updatedAt: '2026-05-18', disclaimer: legalDisclaimer, body: `# Vendor Agreement

**Effective Date:** {{effective_date}}

This Vendor Agreement ("Agreement") is entered into between you (the "Vendor," "you," or "your") and Rosy Recruits, Inc. ("Rosy Recruits," "we," or "us") and governs your use of the Rosy Recruits platform to engage independent floral-event workers ("Workers"). It supplements our Terms of Service.

## 1. Account & Account Owner

To register as a Vendor you must be at least 18 years old and authorized to bind the studio, agency, or business you represent. The individual who registers is the "Account Owner" and is responsible for actions taken on the account. Multi-user team accounts are available on certain plans; permissions are managed in Settings.

## 2. Your Role as an Independent Engager

You engage Workers as independent contractors of your studio, not as employees of Rosy Recruits. You are responsible for: (a) accurately describing each gig (scope, call time, location, rate, expectations); (b) reasonable supervision of the work product (but not the manner of performance); (c) compliance with all applicable wage-and-hour, anti-discrimination, safety, and other labor laws; (d) obtaining property, general liability, and any other insurance required by your venue or jurisdiction; and (e) ensuring a safe work environment at every event.

If any worker classification rule of the jurisdiction in which an event occurs would deem a Worker your employee, you accept responsibility for any associated employer obligations.

## 3. Posting & Funding Gigs

When you post a gig, you authorize Rosy Recruits to: (a) calculate the total funding required (rate × hours × spots + platform fee + Stripe fees); (b) charge that amount to your Stripe payment method; and (c) hold the funds in escrow until released to Workers per Section 4.

You agree to post in good faith. You will not post fictitious gigs to harvest Worker contact information or to misrepresent rates.

## 4. Approving Hours & Releasing Payment

After each gig, Workers submit hours via the platform. You agree to review and approve (or reasonably dispute) submitted hours within twenty-four (24) hours. If you do not respond within that window, submitted hours are auto-approved and funds are released to the Worker. You may not withhold payment for reasons unrelated to the work performed.

## 5. Platform Fees & Plans

Vendor platform fees are 4–8% of the gig amount depending on plan, plus standard Stripe processing fees. Plan pricing is described on our Pricing page and may be changed on 30 days' notice. Subscription plans are billed monthly or annually in advance, are non-refundable on cancellation, and renew automatically until cancelled.

## 6. Disputes

You may file a dispute within fourteen (14) days of a gig for reasons such as no-show, hours mismatch, quality of work, or misconduct. Disputes are mediated as described in our Terms of Service.

## 7. Off-Platform Solicitation

For twelve (12) months following an introduction to a Worker through the Services, you agree not to engage that Worker outside the platform for gigs Rosy Recruits could reasonably have processed. This is a material term — violations may result in account termination and liquidated damages equal to twice the platform fees that would have been due.

## 8. Worker Information

Worker profiles, ratings, contact details, and W-9 information accessible through the Services are provided solely for your use in operating gigs on the platform. You may not export, resell, scrape, or use this information for any other purpose. Aggregate statistics may be displayed publicly without your further consent.

## 9. Indemnification & Limitation of Liability

You agree to indemnify and hold harmless Rosy Recruits for any claim arising from a gig you posted, including worker-classification claims, wage claims, injury at the event, or any failure to provide a safe and lawful work environment. Limits of liability are as set forth in the Terms of Service.

## 10. Termination

Either party may terminate this Agreement at any time. We may suspend or terminate your account for breach of these terms, repeated disputes resolved against you, or evidence of fraud. On termination, any funds in escrow not subject to an active dispute will be released within sixty (60) days; subscription fees already paid are not refunded.

## 11. Governing Law & Arbitration

This Agreement is governed by Illinois law. Disputes are subject to the binding individual arbitration and class-action waiver described in our Terms of Service.

## 12. Contact

Questions about this Vendor Agreement? Email **legal@rosyrecruits.com**.
` },
  };
  // Gallery — persists to localStorage so admin changes survive refresh.
  // Defaults below are placeholder Unsplash photos until real images are uploaded.
  const defaultGallery = [
    { id: 'g1', src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80', section: 'hero' },
    { id: 'g2', src: 'https://images.unsplash.com/photo-1606041011872-596597976b25?w=600&q=80', section: 'gallery' },
    { id: 'g3', src: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&q=80', section: 'gallery' },
    { id: 'g4', src: 'https://images.unsplash.com/photo-1487070183336-b863922373d4?w=600&q=80', section: 'about' },
    { id: 'g5', src: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=600&q=80', section: 'gallery' },
    { id: 'g6', src: 'https://images.unsplash.com/photo-1416379590848-77df60bf64ec?w=600&q=80', section: 'gallery' },
  ];
  let gallery = defaultGallery;
  try { const raw = localStorage.getItem('rosy.gallery'); if (raw) gallery = JSON.parse(raw) || defaultGallery; } catch (e) {}
  // Site content store: page → blockId → value. Persists to localStorage and best-effort to rr_site_content.
  let siteContent = {};
  try {
    const raw = localStorage.getItem('rosy.siteContent');
    if (raw) siteContent = JSON.parse(raw) || {};
  } catch (e) { /* ignore */ }

  // Admin invites — populated in admin team page if rr_admin_invites table absent.
  let adminInvites = [];
  try {
    const raw = localStorage.getItem('rosy.adminInvites');
    if (raw) adminInvites = JSON.parse(raw) || [];
  } catch (e) { /* ignore */ }

  // Saved profiles (vendor shortlists): { ownerId: [userId, userId...] }
  let savedProfiles = {};
  try {
    const raw = localStorage.getItem('rosy.savedProfiles');
    if (raw) savedProfiles = JSON.parse(raw) || {};
  } catch (e) { /* ignore */ }

  window.RosyStores = { emailTemplates: emails, notificationTemplates, legalDocs, gallery, siteContent, adminInvites, savedProfiles };

  // Helper: persist a site-content block (localStorage + best-effort Supabase row).
  window.RosySaveSiteContent = async (page, blockId, value) => {
    window.RosyStores.siteContent[page] = window.RosyStores.siteContent[page] || {};
    window.RosyStores.siteContent[page][blockId] = value;
    try { localStorage.setItem('rosy.siteContent', JSON.stringify(window.RosyStores.siteContent)); } catch (e) {}
    try {
      if (window.sb) {
        await window.sb.from('rr_site_content').upsert({ page, block_id: blockId, value, updated_at: new Date().toISOString() }, { onConflict: 'page,block_id' });
      }
    } catch (e) { console.warn('rr_site_content upsert failed (table may not exist):', e?.message || e); }
  };
  // Helper: read a site-content block with hardcoded fallback.
  window.RosyContent = (page, blockId, fallback) => {
    const v = window.RosyStores?.siteContent?.[page]?.[blockId];
    return (v === undefined || v === null || v === '') ? fallback : v;
  };
  // Helper: persist saved-profiles list (localStorage + best-effort Supabase).
  window.RosySaveSavedProfiles = async (ownerId) => {
    try { localStorage.setItem('rosy.savedProfiles', JSON.stringify(window.RosyStores.savedProfiles)); } catch (e) {}
  };

  // ============ Email helper ============
  // Sends a templated email via the /api/send-email Vercel function (Postmark).
  // In demo mode the function force-routes the message to ben@pronocoders.com.
  // Pass `slug` to look up the template from RosyStores.emailTemplates; or pass
  // explicit `subject` + `html`. `vars` fill {{placeholders}}.
  window.RosySendEmail = async ({ slug, to, vars = {}, subject, html, text }) => {
    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;
    if (slug && window.RosyStores?.emailTemplates?.[slug]) {
      const tpl = window.RosyStores.emailTemplates[slug];
      if (tpl.live === false) {
        console.info('[email] template', slug, 'is disabled (live=false); skipping');
        return { ok: false, skipped: true };
      }
      finalSubject = finalSubject || tpl.subject;
      finalHtml = finalHtml || tpl.body;
    }
    if (!finalSubject || (!finalHtml && !finalText)) {
      console.warn('[email] missing subject or body for', slug);
      return { ok: false, error: 'missing fields' };
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      try {
        const { data } = await window.sb.auth.getSession();
        if (data?.session?.access_token) headers.Authorization = 'Bearer ' + data.session.access_token;
      } catch (e) { /* unauthenticated send will be rejected by the server */ }
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({ templateSlug: slug, to, vars, subject: finalSubject, html: finalHtml, text: finalText }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { console.warn('[email] send failed', r.status, data); return { ok: false, status: r.status, data }; }
      console.log('[email] sent', slug || '(adhoc)', '→', data?.demoRoutedTo);
      return { ok: true, data };
    } catch (e) {
      console.warn('[email] network error', e);
      return { ok: false, error: String(e) };
    }
  };
  // Best-effort hydrate site-content from Supabase on boot.
  (async () => {
    try {
      if (window.sb) {
        const { data, error } = await window.sb.from('rr_site_content').select('page,block_id,value');
        if (!error && Array.isArray(data)) {
          data.forEach(row => {
            window.RosyStores.siteContent[row.page] = window.RosyStores.siteContent[row.page] || {};
            window.RosyStores.siteContent[row.page][row.block_id] = row.value;
          });
          window.dispatchEvent(new CustomEvent('rosy:site-content-changed'));
        }
      }
    } catch (e) { /* table missing — no-op */ }
  })();
})();

const GALLERY_SECTIONS = [
  { id: 'hero',     label: 'Marketing hero',        max: 1 },
  { id: 'about',    label: 'About section',         max: 1 },
  { id: 'vendor',   label: 'For-vendors page',      max: 1 },
  { id: 'worker',   label: 'For-workers page',      max: 1 },
  { id: 'gallery',  label: 'Gallery grid',          max: 99 },
  { id: 'unused',   label: 'Unused',                max: 99 },
];

window.GALLERY_SECTIONS = GALLERY_SECTIONS;

/* ============ Address autocomplete (mock) ============
   Looks like Google Maps Place Autocomplete — keystrokes filter a list of plausible NY/NJ addresses. */
// Address autocomplete suggestions disabled until Google Maps integration is wired.
// Empty array = AddressInput renders as a plain text input — users type their real
// address rather than being shown placeholder Chicago suggestions they might pick.
const ADDRESS_BANK = [];

function AddressInput({ value, onChange, placeholder = 'Type your address' }) {
  // Autocomplete is disabled until Google Maps is wired (Ben provisioning key).
  // Until then this is a plain text input that calls onChange on every keystroke.
  const [q, setQ] = F_us(value || '');
  React.useEffect(() => { setQ(value || ''); }, [value]);
  const update = (val) => { setQ(val); onChange && onChange(val); };
  return (
    <div style={{ position: 'relative' }}>
      <F_I.MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
      <input className="input" style={{ paddingLeft: 36 }} value={q} placeholder={placeholder}
        onChange={(e) => update(e.target.value)} />
    </div>
  );
}

/* ============ Google sign-in button ============ */
function GoogleButton({ onClick, label = 'Continue with Google' }) {
  return (
    <button type="button" onClick={onClick}
      className="btn btn-ghost btn-block"
      style={{ borderColor: 'var(--color-hairline-strong)', justifyContent: 'center', height: 44 }}>
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.345 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.964 10.71A5.4 5.4 0 0 1 3.68 9c0-.593.102-1.17.284-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.655 3.58 9 3.58z" />
      </svg>
      <span style={{ marginLeft: 8 }}>{label}</span>
    </button>
  );
}

/* ============ "Write it for me" AI fill button ============ */
function WriteForMe({ context, onFill, label = 'Write it for me', placeholderQuestions = [] }) {
  const [open, setOpen] = F_us(false);
  const [busy, setBusy] = F_us(false);
  const [answers, setAnswers] = F_us({});
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    try {
      const prompt = buildPrompt(context, answers);
      const text = await (window.claude?.complete?.(prompt) || Promise.resolve(''));
      const parsed = tryParseJSON(text);
      if (parsed && typeof parsed === 'object') {
        onFill(parsed);
        toast.push({ kind: 'success', title: 'Draft generated', body: 'Review and tweak before saving.' });
      } else {
        // Fallback: paste into a single text field
        onFill({ _raw: text });
        toast.push({ kind: 'success', title: 'Draft generated', body: 'Pasted into the description field.' });
      }
      setOpen(false);
    } catch (e) {
      // Fall back to canned content if Claude isn't reachable
      const fallback = canned(context, answers);
      onFill(fallback);
      toast.push({ kind: 'info', title: 'Draft inserted', body: 'Used a quick template — review and tweak before saving.' });
      setOpen(false);
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" className="btn btn-ghost-teal btn-sm" onClick={() => setOpen(true)} style={{ height: 34 }}>
        <F_I.Sparkles size={14} />{label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Write it for me" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={busy} onClick={submit}>{busy ? 'Writing…' : 'Generate'}</button></>}>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-muted)' }}>Answer a couple quick questions and we'll draft the form for you.</p>
        <div className="col" style={{ gap: 12 }}>
          {placeholderQuestions.map((q, i) => (
            <div key={q.key} className="field">
              <label className="field-label">{q.label}</label>
              {q.type === 'textarea'
                ? <textarea className="textarea" placeholder={q.placeholder} value={answers[q.key] || ''} onChange={(e) => setAnswers(a => ({ ...a, [q.key]: e.target.value }))} />
                : <input className="input" placeholder={q.placeholder} value={answers[q.key] || ''} onChange={(e) => setAnswers(a => ({ ...a, [q.key]: e.target.value }))} />}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

function buildPrompt(context, answers) {
  return `You are helping a florist fill out a form for "${context.kind}". Use these answers to draft the form values. Reply with ONLY a JSON object whose keys match: ${context.fields.join(', ')}.

User's answers:
${Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Tone: warm but operator-fluent (think a luxury floral studio's PR voice — confident, plain language, no exclamation points or emoji). Keep field values short and concrete. Reply ONLY with the JSON.`;
}
function tryParseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function canned(context, answers) {
  const kind = context.kind;
  if (kind === 'event') {
    return {
      name: answers.eventName || 'Untitled event',
      desc: `A ${answers.style || 'modern garden'} ${answers.kind || 'evening reception'} for ${answers.guests || '180'} guests. ${answers.notes || 'Suspended floral installations over the dance floor, twelve dinner tables with low garden compositions in a peach and ivory palette.'} Strike crew loads out after midnight.`,
    };
  }
  if (kind === 'gig') {
    return {
      description: `Build crew for ${answers.eventKind || 'a floral install'}. Strong ${answers.role || 'Assist'} role — calm under pressure, takes direction, lifts 50 lbs. ${answers.notes || 'Chicago-based studio with editorial expectations.'}`,
    };
  }
  if (kind === 'venue') {
    return {
      name: answers.name || 'Carter Garden Estate',
      type: answers.type || 'Garden',
      city: answers.city || 'Chicago, IL',
      address: answers.city || '900 W Fulton Market, Chicago, IL 60607',
      capacity: parseInt(answers.guests) || 220,
      parking: 'Lot for 40 cars, street parking around the perimeter, valet on request.',
      notes: 'Loading dock at the rear, single 30A 120V circuit, contact Ms Lin for site visits.',
    };
  }
  if (kind === 'profile') {
    return {
      bio: `${answers.years || '8'} years across floral events. Specializing in ${answers.specialty || 'suspended installations and editorial moments'}. Reliable, calm under pressure, takes direction well.`,
    };
  }
  if (kind === 'contact') {
    return {
      body: `Hi — I'm with ${answers.company || 'a studio'} and I'd like to ${answers.intent || 'learn more about Pro plan pricing for high-volume operators'}. We do roughly ${answers.volume || '20-30'} events a year and need ${answers.need || 'workflow approvals and same-day Stripe payouts'}. Best time to reach me is ${answers.when || 'mornings EST'}.`,
    };
  }
  return {};
}

Object.assign(window, { AddressInput, GoogleButton, WriteForMe, GALLERY_SECTIONS });

/* Additional shared components: address autocomplete, AI write-for-me, Google auth, runtime stores */

const { useState: F_us, useEffect: F_ue, useRef: F_ur } = React;
const F_I = window.Icons;

/* ============ In-memory runtime stores ============ */
(function initRosyStores() {
  if (window.RosyStores) return;
  // Shared HTML wrapper applied at send time. Body is the inner HTML.
  const htmlWrap = (inner) => `<!doctype html><html><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:24px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);"><tr><td style="background:#F47C5D;padding:18px 24px;color:#fff;font-weight:600;font-size:18px;font-family:Georgia,serif;">Rosy <span style="opacity:0.8;">Recruits</span></td></tr><tr><td style="padding:28px 28px 24px;font-size:15px;line-height:1.6;color:#1A1A1A;">` + inner + `</td></tr><tr><td style="padding:16px 28px;background:#FAF7F2;border-top:1px solid #ECE6DD;font-size:11.5px;color:#7A7470;">You're getting this because you have a Rosy Recruits account. <a href="{{unsubscribe_url}}" style="color:#7A7470;">Unsubscribe</a> · <a href="{{help_url}}" style="color:#7A7470;">Help</a></td></tr></table></td></tr></table></body></html>`;
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
  const legalDocs = {
    'terms-of-service': { name: 'Terms of Service', updatedAt: '2026-05-15', body: '# Terms of Service\n\nLast updated: May 15, 2026\n\nWelcome to Rosy Recruits. By using the platform you agree to the following terms…\n\n## 1. Accounts\n\n## 2. Payments\n\n## 3. Conduct\n\n## 4. Liability\n\n## 5. Termination\n' },
    'privacy-policy':   { name: 'Privacy Policy',   updatedAt: '2026-05-15', body: '# Privacy Policy\n\nLast updated: May 15, 2026\n\nWe collect the minimum necessary to operate the platform…\n' },
    'worker-agreement': { name: 'Worker Agreement', updatedAt: '2026-05-15', body: '# Worker Agreement\n\nLast updated: May 15, 2026\n\nWorkers on Rosy Recruits are independent contractors…\n' },
    'vendor-agreement': { name: 'Vendor Agreement', updatedAt: '2026-05-15', body: '# Vendor Agreement\n\nLast updated: May 15, 2026\n\nVendors agree to release funds promptly on completed gigs…\n' },
  };
  const gallery = [
    { id: 'g1', src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80', section: 'hero' },
    { id: 'g2', src: 'https://images.unsplash.com/photo-1606041011872-596597976b25?w=600&q=80', section: 'gallery' },
    { id: 'g3', src: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&q=80', section: 'gallery' },
    { id: 'g4', src: 'https://images.unsplash.com/photo-1487070183336-b863922373d4?w=600&q=80', section: 'about' },
    { id: 'g5', src: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=600&q=80', section: 'gallery' },
    { id: 'g6', src: 'https://images.unsplash.com/photo-1416379590848-77df60bf64ec?w=600&q=80', section: 'gallery' },
  ];
  window.RosyStores = { emailTemplates: emails, notificationTemplates, legalDocs, gallery };
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
const ADDRESS_BANK = [
  '238 N Halsted St, Chicago, IL 60661',
  '111 N Aberdeen St, Chicago, IL 60607',
  '1900 Sherman Ave, Evanston, IL 60201',
  '155 W Kinzie St, Chicago, IL 60654',
  '900 W Fulton Market, Chicago, IL 60607',
  '4731 N Lincoln Ave, Chicago, IL 60625',
  '290 W Roosevelt Rd, Chicago, IL 60607',
  '475 W Hubbard St, Chicago, IL 60654',
  '1 Lincoln Park West, Chicago, IL 60614',
  '5 Lake Shore Dr, Chicago, IL 60611',
  '1000 W Washington Blvd, Chicago, IL 60607',
  '7 W Madison St, Chicago, IL 60603',
  '321 N Clark St, Chicago, IL 60654',
  '60 W Wacker Dr, Chicago, IL 60601',
  '88 N Halsted St, Chicago, IL 60661',
];

function AddressInput({ value, onChange, placeholder = 'Search address', hint = 'Powered by Google Maps' }) {
  const [q, setQ] = F_us(value || '');
  const [open, setOpen] = F_us(false);
  React.useEffect(() => { setQ(value || ''); }, [value]);
  const wrapRef = F_ur(null);
  F_ue(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  const matches = q.trim().length === 0 ? ADDRESS_BANK.slice(0, 6) :
    ADDRESS_BANK.filter(a => a.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const pick = (addr) => { setQ(addr); onChange && onChange(addr); setOpen(false); };
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <F_I.MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
        <input className="input" style={{ paddingLeft: 36 }} value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      </div>
      {open ? (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 12, boxShadow: 'var(--shadow-modal)', zIndex: 100, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          {matches.length === 0 ? <p style={{ margin: 0, padding: 14, fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>No matches</p> :
           matches.map(addr => (
            <button key={addr} type="button" onClick={() => pick(addr)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--color-hairline)', fontSize: 13.5 }}>
              <F_I.MapPin size={14} style={{ color: 'var(--rosy-coral)', flex: 'none' }} />
              <span>{addr}</span>
            </button>
          ))}
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--color-muted-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#4285F4', fontWeight: 700, fontFamily: 'sans-serif' }}>G</span>
            {hint}
          </div>
        </div>
      ) : null}
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
      name: answers.eventName || 'Garden Society Spring Gala',
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
      bio: `${answers.years || '8'} years across floral events in the Chicagoland. Specializing in ${answers.specialty || 'suspended installations and editorial moments'}. Reliable, calm under pressure, takes direction well.`,
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

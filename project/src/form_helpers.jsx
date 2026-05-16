/* Additional shared components: address autocomplete, AI write-for-me, Google auth, runtime stores */

const { useState: F_us, useEffect: F_ue, useRef: F_ur } = React;
const F_I = window.Icons;

/* ============ In-memory runtime stores ============ */
window.RosyStores = window.RosyStores || {
  // Email templates the admin can edit. Body uses {{var}} placeholders.
  emailTemplates: {
    'worker-confirmed': {
      name: 'Worker — gig confirmed',
      subject: "You're confirmed: {{event_name}}",
      body: "Hi {{worker_first}},\n\nYou're confirmed for {{event_name}} on {{event_date}}.\n\nCall time: {{call_time}}\nVenue: {{venue_name}}, {{venue_city}}\nLead: {{lead_name}}\nRate: ${{hourly_rate}}/hr\n\nSee gig details in the app.\n\n— Rosy",
      lastEdited: '2026-05-10',
      live: true,
    },
    'worker-rejected': { name: 'Worker — gig rejected', subject: 'Update on your application', body: 'Hi {{worker_first}},\n\nThanks for applying to {{event_name}}. The vendor has filled the role this time. Plenty more gigs in your feed.\n\n— Rosy', lastEdited: '2026-05-04', live: true },
    'vendor-application': { name: 'Vendor — application received', subject: '{{worker_name}} applied to your gig', body: 'Hi {{vendor_first}},\n\n{{worker_name}} (★ {{worker_rating}}, {{worker_gigs}} gigs) applied to your {{gig_type}} gig at {{event_name}}.\n\nReview now in the app.\n\n— Rosy', lastEdited: '2026-05-08', live: true },
    'worker-paid': { name: 'Worker — payment paid', subject: "You've been paid ${{amount}}", body: 'Hi {{worker_first}},\n\n${{amount}} for {{event_name}} just landed in your Stripe account.\n\n— Rosy', lastEdited: '2026-05-06', live: true },
    'dispute-filed': { name: 'Both — dispute filed', subject: 'A dispute was filed on {{invoice}}', body: 'A dispute has been filed on {{invoice}} (${{amount}}).\n\nReason: {{reason}}\nFiled by: {{filed_by}}\n\nYou have 48 hours to respond.\n\n— Rosy', lastEdited: '2026-05-12', live: true },
    'weekly-summary': { name: 'Both — weekly summary', subject: 'Your week on Rosy Recruits', body: 'Hi {{first_name}},\n\nThis week: {{gigs_count}} gigs, {{hours}} hours, ${{earned}} earned.\n\nUpcoming: {{upcoming_count}} confirmed.\n\n— Rosy', lastEdited: '2026-04-28', live: false },
  },
  // Gallery — items with section assignment
  gallery: [
    { id: 'g1', src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80', section: 'hero' },
    { id: 'g2', src: 'https://images.unsplash.com/photo-1606041011872-596597976b25?w=600&q=80', section: 'gallery' },
    { id: 'g3', src: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&q=80', section: 'gallery' },
    { id: 'g4', src: 'https://images.unsplash.com/photo-1487070183336-b863922373d4?w=600&q=80', section: 'about' },
    { id: 'g5', src: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=600&q=80', section: 'gallery' },
    { id: 'g6', src: 'https://images.unsplash.com/photo-1416379590848-77df60bf64ec?w=600&q=80', section: 'gallery' },
  ],
};

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

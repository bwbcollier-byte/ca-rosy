/* Inbox (chat), Marketing landing, Auth, Onboarding */

const SX_D = window.RosyData;
const SX_I = window.Icons;
const { useState: SX_us } = React;

/* ============ Inbox ============ */
function PageInbox() {
  const [active, setActive] = SX_us(SX_D.MESSAGES[0].id);
  const [draft, setDraft] = SX_us('');
  const [composeOpen, setComposeOpen] = SX_us(false);
  const [callOpen, setCallOpen] = SX_us(null); // 'voice' | 'video' | null
  const [threadMenuOpen, setThreadMenuOpen] = SX_us(false);
  const fileInputRef = React.useRef(null);
  const toast = useToast();
  const conv = SX_D.MESSAGES.find(c => c.id === active);
  const [localMessages, setLocalMessages] = SX_us(conv?.messages || []);
  React.useEffect(() => { setLocalMessages(conv?.messages || []); }, [active]);

  const send = () => {
    if (!draft.trim()) return;
    setLocalMessages(ms => [...ms, { who: 'me', text: draft, time: 'Just now', day: 'Today' }]);
    setDraft('');
    setTimeout(() => {
      setLocalMessages(ms => [...ms, { who: 'them', text: 'Got it — talk soon.', time: 'Just now', day: 'Today' }]);
    }, 900);
  };

  return (
    <div className="inbox-shell">
      <div className="inbox-list">
        <div className="inbox-search">
          <div style={{ position: 'relative', flex: 1 }}>
            <SX_I.Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search" style={{ paddingLeft: 32, height: 38 }} />
          </div>
          <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setComposeOpen(true)} aria-label="Compose"><SX_I.Pencil size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {SX_D.MESSAGES.map(c => {
            const u = SX_D.USERS.find(x => x.id === c.with);
            return (
              <div key={c.id} className={`inbox-thread ${c.id === active ? 'active' : ''}`} onClick={() => setActive(c.id)}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={c.name} size="lg" />
                  {c.online ? <span style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 9999, background: '#22C55E', border: '2px solid var(--color-canvas)' }} /> : null}
                </div>
                <div className="it-meta">
                  <div className="it-name-row">
                    <span className="it-name">{c.name}</span>
                    <span className="it-time">{c.messages[c.messages.length - 1]?.day}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="it-preview" style={{ flex: 1 }}>{c.preview}</span>
                    {c.unread ? <span className="it-unread">{c.unread}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="inbox-conv">
        {conv ? (
          <>
            <div className="conv-head">
              <Avatar name={conv.name} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{conv.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{conv.online ? 'Online now' : 'Active 3 hours ago'}</p>
              </div>
              <button className="icon-btn" onClick={() => setCallOpen('voice')} aria-label="Voice call"><SX_I.Phone size={16} /></button>
              <button className="icon-btn" onClick={() => setCallOpen('video')} aria-label="Video call"><SX_I.Video size={16} /></button>
              <button className="icon-btn" onClick={() => setThreadMenuOpen(true)} aria-label="Thread options"><SX_I.MoreHorizontal size={16} /></button>
            </div>
            <div className="conv-stream">
              {(() => {
                let lastDay = null;
                return localMessages.map((m, i) => {
                  const showDay = m.day && m.day !== lastDay;
                  lastDay = m.day;
                  return (
                    <React.Fragment key={i}>
                      {showDay ? <div className="date-sep">{m.day}</div> : null}
                      <div className={`msg-bubble ${m.who === 'me' ? 'out' : 'in'}`}>{m.text}</div>
                      <span className="msg-time" style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start' }}>{m.time}</span>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
            <div className="conv-compose">
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  toast.push({ kind: 'success', title: 'File attached', body: `${f.name} (${Math.round(f.size / 1024)} KB)` });
                  e.target.value = '';
                }}
              />
              <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach file"><SX_I.Paperclip size={16} /></button>
              <input className="input" placeholder="Message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="btn btn-teal btn-sm" onClick={send} disabled={!draft.trim()} style={{ width: 38, height: 38, padding: 0, borderRadius: 9999 }}><SX_I.Send size={15} /></button>
            </div>
          </>
        ) : (
          <Empty icon={SX_I.MessageSquare} title="Select a conversation" body="Pick a thread to start messaging." />
        )}
      </div>

      {composeOpen ? (
        <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="New conversation" size="md"
          footer={<button className="btn btn-ghost" onClick={() => setComposeOpen(false)}>Cancel</button>}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-muted)' }}>Pick someone to message:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {SX_D.USERS.filter(u => u.role !== 'admin').slice(0, 8).map(u => (
              <button key={u.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: 10, height: 'auto' }} onClick={() => { setComposeOpen(false); toast.push({ kind: 'success', title: `Conversation started with ${u.first}` }); }}>
                <Avatar name={u.name} size="md" />
                <div style={{ textAlign: 'left', marginLeft: 4 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{u.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{u.company}</p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {callOpen ? (
        <Modal open={!!callOpen} onClose={() => setCallOpen(null)} title={callOpen === 'voice' ? 'Voice call' : 'Video call'} size="sm"
          footer={<><button className="btn btn-ghost" onClick={() => setCallOpen(null)}>Close</button><button className="btn btn-coral" onClick={() => { setCallOpen(null); toast.push({ kind: 'success', title: "We'll email you when it ships" }); }}>Notify me</button></>}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--color-surface-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {callOpen === 'voice' ? <SX_I.Phone size={28} /> : <SX_I.Video size={28} />}
            </div>
            <h4 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.01em' }}>Coming this summer</h4>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>{callOpen === 'voice' ? 'Voice calling is in beta with a few studios. Want early access?' : 'Integrated video rooms launch in Q3. Want to be first?'}</p>
          </div>
        </Modal>
      ) : null}

      {threadMenuOpen ? (
        <Modal open={threadMenuOpen} onClose={() => setThreadMenuOpen(false)} title="Conversation options" size="sm"
          footer={<button className="btn btn-ghost" onClick={() => setThreadMenuOpen(false)}>Close</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setThreadMenuOpen(false); toast.push({ kind: 'info', title: 'Conversation muted', body: "You won't get notifications from this thread." }); }}><SX_I.Bell size={14} />Mute notifications</button>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setThreadMenuOpen(false); toast.push({ kind: 'success', title: 'Conversation archived' }); }}><SX_I.Trash2 size={14} />Archive</button>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--color-error)' }} onClick={() => { setThreadMenuOpen(false); toast.push({ kind: 'warning', title: 'Report submitted', body: 'Rosy Trust & Safety will review within 24h.' }); }}><SX_I.AlertTriangle size={14} />Report</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ============ Marketing — router ============ */
function MarketingPage({ goToApp, goToAuth, subRoute = 'home', setSubRoute }) {
  const setRoute = (r) => setSubRoute(r);
  let body;
  if (subRoute === 'vendors')         body = <MkVendorsPage goToAuth={goToAuth} />;
  else if (subRoute === 'workers')    body = <MkWorkersPage goToAuth={goToAuth} />;
  else if (subRoute === 'gallery')    body = <MkGalleryPage />;
  else if (subRoute === 'pricing')    body = <MkPricingPage goToAuth={goToAuth} />;
  else if (subRoute === 'faq')        body = <MkFAQPage setRoute={setRoute} goToAuth={goToAuth} />;
  else if (subRoute === 'about')      body = <MkAboutPage goToAuth={goToAuth} />;
  else if (subRoute === 'careers')    body = <MkCareersPage setRoute={setRoute} />;
  else if (subRoute === 'press')      body = <MkPressPage setRoute={setRoute} />;
  else if (subRoute === 'contact')    body = <MkContactPage />;
  else if (['terms','privacy','security','payments-info','disputes-info'].includes(subRoute)) body = <MkLegalPage kind={subRoute} />;
  else body = <MarketingHome goToApp={goToApp} goToAuth={goToAuth} setRoute={setRoute} />;
  return <MarketingShell route={subRoute} setRoute={setRoute} goToAuth={goToAuth}>{body}</MarketingShell>;
}

function MarketingHome({ goToApp, goToAuth, setRoute }) {
  return (
    <>
      <section className="mk-section">
        <div className="mk-hero">
          <div>
            <div className="mk-strip" style={{ marginBottom: 20 }}>
              <SX_I.Sparkles size={14} />New: Stripe instant payouts in 5 cities
            </div>
            <h1>Where floral <em>excellence</em> meets efficiency.</h1>
            <p>A skilled crew on every event — booked in minutes, paid in days. Built by florists who got tired of texting from a spreadsheet.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-coral btn-lg" onClick={() => goToAuth('signup')}>Hire a team</button>
              <button className="btn btn-ghost btn-lg" onClick={() => goToAuth('signup')}>Find work</button>
            </div>
            <div className="mk-hero-stats">
              <div className="mk-hero-stat"><span className="num">1,284</span><span className="lbl">active workers</span></div>
              <div className="mk-hero-stat"><span className="num">412</span><span className="lbl">vendor studios</span></div>
              <div className="mk-hero-stat"><span className="num">$284k</span><span className="lbl">paid this month</span></div>
            </div>
          </div>
          <div className="mk-hero-art">
            <img src={SX_D.IMAGES.marketingHero} alt="Floral installation" />
          </div>
        </div>
      </section>

      {/* Gig-type tab bar */}
      <div style={{ background: '#F5B548', padding: '12px 0', marginBottom: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['Strike crew','Lead designer','Onsite design','Floral assistant','Studio clean-up','Event consultation'].map(s => (
            <span key={s} style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--color-ink)', padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Why Rosy */}
      <section className="mk-section">
        <h2 className="display-lg" style={{ marginBottom: 48, maxWidth: 800 }}>The team you need, before sunrise on event day.</h2>
        <div className="grid-3">
          <div className="feature-card peach">
            <SX_I.CalendarCheck size={28} />
            <h3 style={{ margin: '20px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>Post a gig in 60 seconds</h3>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>Date, time, gig type, hourly rate. Workers see it in their feed within minutes. Most posts fill the same day.</p>
          </div>
          <div className="feature-card lavender">
            <SX_I.ShieldCheck size={28} />
            <h3 style={{ margin: '20px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>Vetted, rated, reliable</h3>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>Every worker is ID-verified, rated after every gig, and held to a 4.5★ floor. The bad ones don't last.</p>
          </div>
          <div className="feature-card coral">
            <SX_I.DollarSign size={28} />
            <h3 style={{ margin: '20px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>Pay-day on Tuesday</h3>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.9 }}>Stripe Connect releases worker pay within 48 hours of approved hours. No invoicing, no chasing.</p>
          </div>
        </div>
      </section>

      {/* Worker / Vendor split */}
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="grid-2" style={{ gap: 24 }}>
          <div className="feature-card teal" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: 36 }}>
              <span className="t-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>For workers</span>
              <h3 style={{ margin: '12px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, letterSpacing: '-0.02em' }}>Steady, beautiful work.</h3>
              <p style={{ margin: '0 0 20px', fontSize: 15, opacity: 0.85, lineHeight: 1.6 }}>Three studios a week or thirty events a season — set your availability, pick your gigs, get paid on time. Lead roles pay $50/hr.</p>
              <button className="btn btn-on-color btn-sm" style={{ background: '#fff', color: 'var(--color-ink)' }} onClick={() => goToAuth('signup')}>Join as a worker</button>
            </div>
            <img src={SX_D.IMAGES.marketingWorker} alt="" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
          </div>
          <div className="feature-card ochre" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 36 }}>
              <span className="t-eyebrow">For vendors</span>
              <h3 style={{ margin: '12px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, letterSpacing: '-0.02em' }}>Crew up. Show up. Look brilliant.</h3>
              <p style={{ margin: '0 0 20px', fontSize: 15, opacity: 0.9, lineHeight: 1.6 }}>Spin up an entire wedding team from your phone. Workers see the gig, you see the applications, both sides get paid through Stripe.</p>
              <button className="btn btn-primary btn-sm" onClick={() => goToAuth('signup')}>Hire a team</button>
            </div>
            <img src={SX_D.IMAGES.marketingVendor} alt="" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2 className="display-lg" style={{ marginBottom: 24, maxWidth: 700 }}>Work made by Rosy crews.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '220px', gap: 16 }}>
          {SX_D.IMAGES.gallery.map((src, i) => (
            <div key={i} style={{ gridRow: i % 5 === 0 ? 'span 2' : 'span 1', borderRadius: 16, overflow: 'hidden', background: 'var(--color-surface-card)' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2 className="display-lg" style={{ marginBottom: 32, maxWidth: 700 }}>What people are saying.</h2>
        <div className="grid-3">
          {SX_D.TESTIMONIALS.map(t => (
            <div key={t.id} className="card" style={{ background: 'var(--color-surface-soft)' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 21, lineHeight: 1.4, letterSpacing: '-0.01em' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18 }}>
                <Avatar name={t.who} size="md" />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>{t.who}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2 className="display-lg" style={{ marginBottom: 24, maxWidth: 700 }}>Common questions.</h2>
        <div className="col" style={{ gap: 12 }}>
          {SX_D.FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* CTA band */}
      <section style={{ background: 'var(--color-brand-peach)', padding: '72px 32px', textAlign: 'center' }}>
        <h2 className="display-lg" style={{ maxWidth: 800, margin: '0 auto 16px' }}>Run your next event with the right team.</h2>
        <p style={{ margin: '0 auto 28px', color: 'var(--color-body)', fontSize: 17, maxWidth: 560 }}>Free for vendors to try. No credit card. Post your first gig in 60 seconds.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => goToAuth('signup')}>Get started</button>
          <button className="btn btn-ghost btn-lg" onClick={() => goToApp()}>See it in action</button>
        </div>
      </section>
    </>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = SX_us(false);
  return (
    <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'transparent', border: 0, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
        {q}
        <SX_I.ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
      </button>
      {open ? <div style={{ padding: '0 20px 18px', fontSize: 14.5, color: 'var(--color-body)', lineHeight: 1.6 }}>{a}</div> : null}
    </div>
  );
}

/* ============ Auth ============ */
function AuthPage({ mode = 'login', goToApp, setMode }) {
  const [show, setShow] = SX_us(false);
  const [email, setEmail] = SX_us(mode === 'signup' ? '' : 'naomi.park@gmail.com');
  const [pw, setPw] = SX_us(mode === 'signup' ? '' : 'rosyDemo!1');
  const [agree, setAgree] = SX_us(false);
  const [submitting, setSubmitting] = SX_us(false);
  const toast = useToast();

  const checks = {
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    num:   /\d/.test(pw),
    spec:  /[!@#$%^&*]/.test(pw),
    len:   pw.length >= 8,
  };
  const allPass = Object.values(checks).every(Boolean);

  const submit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.push({ kind: 'success', title: mode === 'signup' ? 'Welcome to Rosy' : 'Welcome back', body: 'Loading your dashboard…' });
      goToApp();
    }, 700);
  };

  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div style={{ backgroundImage: `url(${SX_D.IMAGES.authFloral})` }} />
      </div>
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="mk-logo" style={{ marginBottom: 8 }}><RoseLogo />Rosy<span className="accent"> Recruits</span></div>
          <h2 className="display-md" style={{ fontSize: 32 }}>{mode === 'login' ? 'Welcome back.' : mode === 'forgot' ? 'Reset your password.' : 'Create your account.'}</h2>
          {mode === 'login' ? <p style={{ margin: '-6px 0 0', color: 'var(--color-muted)' }}>Log in to manage your events and gigs.</p> :
            mode === 'signup' ? <p style={{ margin: '-6px 0 0', color: 'var(--color-muted)' }}>Free to start. Pick a role on the next step.</p> :
            <p style={{ margin: '-6px 0 0', color: 'var(--color-muted)' }}>We'll email a link if there's a matching account.</p>}

          <div className="field">
            <label className="field-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstudio.com" />
          </div>

          {mode !== 'forgot' ? (
            <div className="field">
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: 'var(--color-muted)' }}>{show ? <SX_I.EyeOff size={16} /> : <SX_I.Eye size={16} />}</button>
              </div>
              {mode === 'login' ? <a className="btn-link" style={{ alignSelf: 'flex-end', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setMode('forgot')}>Forgot password?</a> : null}
            </div>
          ) : null}

          {mode === 'signup' ? (
            <>
              <div className="col" style={{ gap: 6, padding: '6px 0' }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password requirements</p>
                {[
                  ['upper','At least one uppercase letter'],
                  ['lower','At least one lowercase letter'],
                  ['num','At least one number'],
                  ['spec','At least one special character (!@#$%^&*)'],
                  ['len','At least 8 characters'],
                ].map(([k, label]) => (
                  <div key={k} className={`req-check ${checks[k] ? 'ok' : 'no'}`}>
                    {checks[k] ? <SX_I.CheckCircle size={14} /> : <SX_I.X size={14} />}
                    {label}
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--color-body)' }}>
                <span className={`checkbox ${agree ? 'checked' : ''}`} onClick={() => setAgree(a => !a)} style={{ marginTop: 2 }}>{agree ? <SX_I.CheckCircle size={12} /> : null}</span>
                <span>I agree to the <a style={{ color: 'var(--rosy-teal-dark)', textDecoration: 'underline' }}>terms of service</a> and <a style={{ color: 'var(--rosy-teal-dark)', textDecoration: 'underline' }}>privacy policy</a>.</span>
              </label>
            </>
          ) : null}

          <button className="btn btn-coral btn-lg btn-block" type="submit"
            disabled={submitting || (mode === 'signup' && (!allPass || !agree))}>
            {submitting ? 'Just a moment…' : mode === 'login' ? 'Log in' : mode === 'forgot' ? 'Send reset link' : 'Sign up'}
          </button>

          {mode !== 'forgot' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-muted-soft)', fontSize: 12, fontWeight: 500 }}>
                <span style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />or<span style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
              </div>
              <GoogleButton onClick={() => { toast.push({ kind: 'success', title: mode === 'signup' ? 'Welcome to Rosy' : 'Welcome back', body: 'Authorised via Google.' }); goToApp(); }} label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'} />
            </>
          ) : null}

          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', textAlign: 'center' }}>
            {mode === 'login' ? <>Need an account? <a className="btn-link" style={{ cursor: 'pointer' }} onClick={() => setMode('signup')}>Sign up</a></> :
             mode === 'signup' ? <>Already have an account? <a className="btn-link" style={{ cursor: 'pointer' }} onClick={() => setMode('login')}>Log in</a></> :
             <a className="btn-link" style={{ cursor: 'pointer' }} onClick={() => setMode('login')}>Back to log in</a>}
          </p>
        </form>
      </div>
    </div>
  );
}

/* ============ Onboarding ============ */
function OnboardingPage({ onComplete }) {
  const [step, setStep] = SX_us(1);
  const [role, setRole] = SX_us({ vendor: false, worker: false });
  const [tc, setTc] = SX_us(false);
  const [tcOpen, setTcOpen] = SX_us(false);
  const [stripeOpen, setStripeOpen] = SX_us(false);
  const toast = useToast();
  const hasRole = role.vendor || role.worker;

  return (
    <div className="onb-shell">
      <div className="mk-logo" style={{ marginBottom: 8 }}><RoseLogo />Rosy<span className="accent"> Recruits</span></div>
      <div className="onb-progress">
        <div className={`dot ${step >= 1 ? 'on' : ''}`} /><div className={`dot ${step >= 2 ? 'on' : ''}`} /><div className={`dot ${step >= 3 ? 'on' : ''}`} />
      </div>

      {step === 1 ? (
        <div style={{ width: '100%', maxWidth: 720, background: 'var(--color-canvas)', border: '2px solid var(--rosy-teal)', borderRadius: 24, padding: 40 }}>
          <h2 className="display-md" style={{ textAlign: 'center' }}>Choose all that apply</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 16, maxWidth: 540, margin: '12px auto 28px' }}>
            If you're here to find workers for your events, choose <strong>Vendor</strong>. If you're here to find work with a floral vendor, choose <strong>Worker</strong>. Choose both if you're here to do both.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className={`role-card vendor ${role.vendor ? 'selected' : ''}`} onClick={() => setRole(r => ({ ...r, vendor: !r.vendor }))}>
              <div className="role-icon"><SX_I.Building2 size={32} /></div>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>I'm a Vendor</h4>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Here to manage events and hire.</p>
            </div>
            <div className={`role-card worker ${role.worker ? 'selected' : ''}`} onClick={() => setRole(r => ({ ...r, worker: !r.worker }))}>
              <div className="role-icon"><SX_I.HardHat size={32} /></div>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>I'm a Worker</h4>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Here to find/manage gigs and payments.</p>
            </div>
          </div>
          <button className={`btn btn-block btn-lg ${hasRole ? 'btn-coral' : 'btn-ghost'}`} style={{ marginTop: 24 }} disabled={!hasRole} onClick={() => setStep(2)}>Continue</button>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ width: '100%', maxWidth: 720, background: 'var(--color-canvas)', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--color-hairline)' }}>
          <div style={{ background: role.vendor ? '#F59E0B' : 'var(--rosy-coral)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {role.vendor ? <SX_I.Building2 size={20} /> : <SX_I.HardHat size={20} />}
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.01em' }}>{role.vendor ? 'Vendor Profile' : 'Worker Profile'}</h3>
          </div>
          <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
            <ProfileForm role={role.vendor ? 'vendor' : 'worker'} />
          </div>
          <div style={{ padding: '16px 24px', background: 'var(--color-surface-soft)', borderTop: '1px solid var(--color-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span className={`checkbox ${tc ? 'checked' : ''}`} onClick={() => { if (!tc) setTcOpen(true); else setTc(false); }}>{tc ? <SX_I.CheckCircle size={12} /> : null}</span>
              Agree to the <a className="btn-link" style={{ cursor: 'pointer' }} onClick={() => setTcOpen(true)}>terms & conditions</a>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-coral" disabled={!tc} onClick={() => { setStripeOpen(true); }}>Save changes</button>
            </div>
          </div>
        </div>
      ) : null}

      <TCModal open={tcOpen} onClose={() => setTcOpen(false)} onAgree={() => { setTc(true); setTcOpen(false); toast.push({ kind: 'success', title: 'Terms accepted' }); }} role={role.vendor ? 'vendor' : 'worker'} />

      <Modal open={stripeOpen} onClose={() => setStripeOpen(false)} title="" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setStripeOpen(false); onComplete(); }}>Skip for now</button><button className="btn btn-coral" onClick={() => { setStripeOpen(false); toast.push({ kind: 'success', title: 'Connected to Stripe' }); onComplete(); }}>Continue to Stripe</button></>}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <RoseLogo size={36} />
            <SX_I.ArrowRight size={22} style={{ color: 'var(--color-muted)' }} />
            <div style={{ width: 64, height: 36, borderRadius: 8, background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>stripe</div>
          </div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Rosy Recruits uses Stripe Connect to process payments securely.</h3>
          <div className="grid-2" style={{ marginTop: 24, gap: 14 }}>
            <div style={{ background: 'var(--color-surface-soft)', borderRadius: 12, padding: 14 }}>
              <SX_I.Sparkles size={18} style={{ color: 'var(--rosy-coral)' }} />
              <p style={{ margin: '6px 0 0', fontWeight: 600, fontSize: 14 }}>Easy to connect</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>Link your bank in under 2 minutes</p>
            </div>
            <div style={{ background: 'var(--color-surface-soft)', borderRadius: 12, padding: 14 }}>
              <SX_I.ShieldCheck size={18} style={{ color: 'var(--rosy-teal-dark)' }} />
              <p style={{ margin: '6px 0 0', fontWeight: 600, fontSize: 14 }}>100% secured</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>PCI-DSS Level 1 by Stripe</p>
            </div>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 11.5, color: 'var(--color-muted-soft)' }}>By selecting Continue, you agree to the Stripe End User Privacy Policy.</p>
        </div>
      </Modal>
    </div>
  );
}

function TCModal({ open, onClose, onAgree, role }) {
  const [signed, setSigned] = SX_us(false);
  const [readAck, setReadAck] = SX_us(false);
  React.useEffect(() => { if (!open) { setSigned(false); setReadAck(false); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Terms & conditions" size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-coral" disabled={!signed || !readAck} onClick={onAgree}>I agree</button>
        </>
      }>
      <p>You agree to act in good faith, show up to gigs you've committed to, deliver work to the standard described, and pay or be paid through Stripe Connect.</p>
      <p>Rosy Recruits operates as a neutral marketplace. We don't employ workers or contract with vendors directly. Each engagement is between you and your counterparty.</p>
      <p>Disputes are mediated through Rosy support within 48 hours. Repeated no-shows result in account suspension. ID verification is required for Design and Lead roles.</p>
      <p>Workers receive 92% of the gig rate; vendors pay a 6% platform fee on top. Stripe Connect fees are 2.9% + $0.30 per payout, deducted before transfer.</p>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', fontSize: 14, cursor: 'pointer' }}>
        <CheckBox checked={readAck} onChange={setReadAck} />
        <span>I've read and understand these terms in full.</span>
      </label>
      <div style={{ marginTop: 8 }}>
        <SignaturePad onChange={setSigned} />
      </div>
      {!signed || !readAck ? <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--color-muted)', textAlign: 'center' }}>{!readAck ? 'Check the box and ' : ''}sign above to continue.</p> : null}
    </Modal>
  );
}

function ProfileForm({ role }) {
  const [hours, setHours] = SX_us(false);
  const [photo, setPhoto] = SX_us(null);
  const [services, setServices] = SX_us(role === 'vendor' ? ['Install & Breakdown', 'Onsite Design', 'Event Consultations'] : ['Onsite Design', 'Install & Breakdown']);
  const allServices = ['Install & Breakdown','Onsite Design','D.I.Y. Couples','Studio Clean-Up','Event Consultations'];
  const toggleService = (s) => setServices(arr => arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s]);
  return (
    <div className="col" style={{ gap: 14 }}>
      <ImageUpload value={photo} onChange={setPhoto} label={role === 'vendor' ? 'Upload logo' : 'Upload profile photo'} size={96} round={role !== 'vendor' ? true : false} />
      <div className="grid-2">
        <div className="field"><label className="field-label">First name</label><input className="input" defaultValue={role === 'vendor' ? 'Mariana' : 'Naomi'} /></div>
        <div className="field"><label className="field-label">Last name</label><input className="input" defaultValue={role === 'vendor' ? 'Cruz' : 'Park'} /></div>
      </div>
      <div className="field"><label className="field-label">Your phone number</label><input className="input" defaultValue="+1 (917) 555-0188" /></div>
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Your title' : 'Your specialty'}</label><input className="input" defaultValue={role === 'vendor' ? 'Owner & Lead Designer' : 'Lead designer'} /></div>
      {role === 'vendor' ? <div className="field"><label className="field-label">Company name</label><input className="input" defaultValue="Bloom & Fern Studio" /></div> : null}
      <div className="field"><label className="field-label">Service categories</label>
        <p className="field-hint" style={{ marginTop: -2, marginBottom: 4 }}>Tap to add or remove. {services.length} selected.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allServices.map((s, i) => {
            const on = services.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleService(s)}
                className={`gig-chip ${i % 2 ? 'design' : 'lead'}`}
                style={{ border: '1.5px solid', borderColor: on ? 'currentColor' : 'transparent', opacity: on ? 1 : 0.45, cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: 12, transition: 'opacity 120ms ease, border-color 120ms ease' }}>
                {on ? <SX_I.CheckCircle size={12} style={{ marginRight: 2 }} /> : <SX_I.Plus size={12} style={{ marginRight: 2 }} />}
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Business address' : 'Home base'}</label>
        <AddressInput placeholder={role === 'vendor' ? 'Search a business address' : 'City or neighborhood'} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>Click to add public business hours</span>
        <span className={`toggle ${hours ? 'on' : ''}`} onClick={() => setHours(h => !h)} />
      </div>
      {hours ? (
        <div className="card" style={{ background: 'var(--color-surface-soft)' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 12, alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{d}</span>
              <input className="input" type="time" defaultValue="09:00" style={{ height: 36 }} />
              <input className="input" type="time" defaultValue="18:00" style={{ height: 36 }} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Business description' : 'Bio'}</label>
        <textarea className="textarea" defaultValue={role === 'vendor' ? 'Bloom & Fern is a Brooklyn-based floral studio serving weddings and brand events across the tri-state. We specialize in suspended installations and editorial work.' : '8 years in floral events. Brooklyn-based. Strong at suspended installs, calm under pressure, takes direction well.'} />
      </div>
    </div>
  );
}

Object.assign(window, { PageInbox, MarketingPage, AuthPage, OnboardingPage });

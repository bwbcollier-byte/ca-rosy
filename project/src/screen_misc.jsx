/* Inbox (chat), Marketing landing, Auth, Onboarding */

const SX_D = window.RosyData;
const SX_I = window.Icons;
const { useState: SX_us } = React;

/* ============ Inbox ============ */
function PageInbox({ currentUser }) {
  const meId = currentUser?.id;
  const [active, setActive] = SX_us(SX_D.MESSAGES[0]?.id);
  const [draft, setDraft] = SX_us('');
  const [composeOpen, setComposeOpen] = SX_us(false);
  const [callOpen, setCallOpen] = SX_us(null); // 'voice' | 'video' | null
  const [threadMenuOpen, setThreadMenuOpen] = SX_us(false);
  const [search, setSearch] = SX_us('');
  const [extraConvs, setExtraConvs] = SX_us([]);
  const fileInputRef = React.useRef(null);
  const toast = useToast();
  // Scope to conversations the signed-in user is actually in. Without a session, fall back to
  // the demo seed (so the role-switcher demo still has content).
  const baseConvs = meId
    ? SX_D.MESSAGES.filter(c => {
        const ppl = c.participants || [];
        return ppl.includes(meId) || c.startedBy === meId || c.with === meId;
      })
    : SX_D.MESSAGES;
  const allConvs = [...extraConvs, ...baseConvs];
  const conv = allConvs.find(c => c.id === active);
  const visibleConvs = allConvs.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.name, c.preview].some(s => (s || '').toLowerCase().includes(q));
  });
  const [localMessages, setLocalMessages] = SX_us(conv?.messages || []);
  React.useEffect(() => { setLocalMessages(conv?.messages || []); }, [active]);

  // If another page set window.__rosyComposeTo before navigating here, open compose with that recipient.
  React.useEffect(() => {
    if (window.__rosyComposeTo) {
      window.__rosyComposeTo = null;
      setComposeOpen(true);
    }
  }, []);

  const send = async () => {
    if (!draft.trim()) return;
    const text = draft;
    setLocalMessages(ms => [...ms, { senderId: meId, recipientId: conv?.with, text, time: 'Just now', day: 'Today' }]);
    setDraft('');
    try {
      await window.RosyMutate?.messages?.send({
        conversationId: conv?.id,
        senderId: meId, recipientId: conv?.with, content: text,
      });
    } catch (e) { console.warn('message send failed:', e); }
    setTimeout(() => {
      setLocalMessages(ms => [...ms, { senderId: conv?.with, recipientId: meId, text: 'Got it — talk soon.', time: 'Just now', day: 'Today' }]);
    }, 900);
  };
  // Helper: render-time "me/them" decision against the live session user
  const whoOf = (m) => (m.who === 'me' || m.who === 'them') ? m.who : (m.senderId === meId ? 'me' : 'them');

  return (
    <div className="inbox-shell">
      <div className="inbox-list">
        <div className="inbox-search">
          <div style={{ position: 'relative', flex: 1 }}>
            <SX_I.Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search" style={{ paddingLeft: 32, height: 38 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setComposeOpen(true)} aria-label="Compose"><SX_I.Pencil size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleConvs.length === 0 ? <Empty icon={SX_I.Search} title="No matches" body="Try a different search." /> : null}
          {visibleConvs.map(c => {
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
                  const who = whoOf(m);
                  return (
                    <React.Fragment key={i}>
                      {showDay ? <div className="date-sep">{m.day}</div> : null}
                      <div className={`msg-bubble ${who === 'me' ? 'out' : 'in'}`}>{m.text}</div>
                      <span className="msg-time" style={{ alignSelf: who === 'me' ? 'flex-end' : 'flex-start' }}>{m.time}</span>
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Empty icon={SX_I.MessageSquare} title="Select a conversation" body="Pick a thread to start messaging." />
          </div>
        )}
      </div>

      {composeOpen ? (
        <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="New conversation" size="md"
          footer={<button className="btn btn-ghost" onClick={() => setComposeOpen(false)}>Cancel</button>}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-muted)' }}>Pick someone to message:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {SX_D.USERS.filter(u => u.role !== 'admin').slice(0, 8).map(u => (
              <button key={u.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: 10, height: 'auto' }} onClick={async () => {
                  let conv;
                  try {
                    conv = await window.RosyMutate?.conversations?.create({
                      subject: `Direct message — ${u.name}`,
                      startedBy: meId,
                      participants: [meId, u.id].filter(Boolean),
                    });
                  } catch (e) { console.warn(e); }
                  if (!conv) {
                    const newId = 'm_' + Math.random().toString(36).slice(2, 8);
                    conv = { id: newId, with: u.id, name: u.name, online: false, unread: 0, preview: 'New conversation', messages: [] };
                  } else {
                    conv = { ...conv, with: u.id, name: u.name };
                  }
                  setExtraConvs(arr => [conv, ...arr]);
                  setActive(conv.id);
                  setComposeOpen(false);
                  toast.push({ kind: 'success', title: `Conversation started with ${u.first}` });
                }}>
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
  // Show "Install app" CTA once Chrome / Edge fires beforeinstallprompt, OR detect iOS Safari
  // where users add to home screen manually.
  const [installable, setInstallable] = SX_us(!!window.__pwaInstallEvent);
  const [installed, setInstalled] = SX_us(window.matchMedia('(display-mode: standalone)').matches);
  const toast = useToast();
  SX_us; // hook usage already imported via SX_us
  React.useEffect(() => {
    const onCan = () => setInstallable(true);
    const onIn  = () => { setInstallable(false); setInstalled(true); };
    window.addEventListener('rosy:pwa-installable', onCan);
    window.addEventListener('rosy:pwa-installed',   onIn);
    return () => {
      window.removeEventListener('rosy:pwa-installable', onCan);
      window.removeEventListener('rosy:pwa-installed',   onIn);
    };
  }, []);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const promptInstall = async () => {
    const ev = window.__pwaInstallEvent;
    if (ev && typeof ev.prompt === 'function') {
      try {
        ev.prompt();
        const choice = await ev.userChoice;
        if (choice?.outcome === 'accepted') {
          toast.push({ kind: 'success', title: 'Installing…', body: 'Look for Rosy on your home screen in a sec.' });
        }
      } catch (e) { console.warn('install prompt failed:', e); }
      window.__pwaInstallEvent = null;
      setInstallable(false);
      return;
    }
    if (isIOS) {
      toast.push({ kind: 'info', title: 'Install on iPhone', body: 'Tap the Share icon (square + arrow), then "Add to Home Screen".' });
    } else {
      toast.push({ kind: 'info', title: 'Use Chrome or Edge', body: 'Open this site in Chrome or Edge on Android / desktop for one-click install.' });
    }
  };
  const showInstallButton = !installed && (installable || isIOS);
  return (
    <>
      <section className="mk-section">
        <div className="mk-hero">
          <div>
            <div className="mk-strip" style={{ marginBottom: 20 }}>
              <SX_I.Sparkles size={14} />{(window.RosyContent ? window.RosyContent('home','hero_strip','New: Stripe instant payouts in 5 cities') : 'New: Stripe instant payouts in 5 cities')}
            </div>
            <h1 dangerouslySetInnerHTML={{ __html: (window.RosyContent ? window.RosyContent('home','hero_heading','Where floral <em>excellence</em> meets efficiency.') : 'Where floral <em>excellence</em> meets efficiency.') }} />
            <p>{(window.RosyContent ? window.RosyContent('home','hero_sub','A skilled crew on every event — booked in minutes, paid in days. Built by florists who got tired of texting from a spreadsheet.') : 'A skilled crew on every event — booked in minutes, paid in days. Built by florists who got tired of texting from a spreadsheet.')}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-coral btn-lg" onClick={() => goToAuth('signup')}>{(window.RosyContent ? window.RosyContent('home','cta_primary','Hire a team') : 'Hire a team')}</button>
              <button className="btn btn-ghost btn-lg" onClick={() => goToAuth('signup')}>{(window.RosyContent ? window.RosyContent('home','cta_secondary','Find work') : 'Find work')}</button>
              {showInstallButton ? (
                <button className="btn btn-ghost btn-lg" onClick={promptInstall} aria-label="Install Rosy Recruits to your home screen">
                  <SX_I.Download size={16} />Install app
                </button>
              ) : null}
            </div>
            <div className="mk-hero-stats">
              <div className="mk-hero-stat"><span className="num">{(window.RosyContent ? window.RosyContent('home','hero_stat1_num','1,284') : '1,284')}</span><span className="lbl">{(window.RosyContent ? window.RosyContent('home','hero_stat1_lbl','active workers') : 'active workers')}</span></div>
              <div className="mk-hero-stat"><span className="num">{(window.RosyContent ? window.RosyContent('home','hero_stat2_num','412') : '412')}</span><span className="lbl">{(window.RosyContent ? window.RosyContent('home','hero_stat2_lbl','vendor studios') : 'vendor studios')}</span></div>
              <div className="mk-hero-stat"><span className="num">{(window.RosyContent ? window.RosyContent('home','hero_stat3_num','$284k') : '$284k')}</span><span className="lbl">{(window.RosyContent ? window.RosyContent('home','hero_stat3_lbl','paid this month') : 'paid this month')}</span></div>
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
          <div className="feature-card teal" style={{ overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 36, flex: 1 }}>
              <span className="t-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>For workers</span>
              <h3 style={{ margin: '12px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, letterSpacing: '-0.02em' }}>Steady, beautiful work.</h3>
              <p style={{ margin: '0 0 20px', fontSize: 15, opacity: 0.85, lineHeight: 1.6 }}>Three studios a week or thirty events a season — set your availability, pick your gigs, get paid on time. Lead roles pay $50/hr.</p>
              <button className="btn btn-on-color btn-sm" style={{ background: '#fff', color: 'var(--color-ink)' }} onClick={() => goToAuth('signup')}>Join as a worker</button>
            </div>
            <img src={SX_D.IMAGES.marketingWorker} alt="" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
          </div>
          <div className="feature-card ochre" style={{ overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 36, flex: 1 }}>
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
        <p style={{ margin: '0 auto 28px', color: 'var(--color-body)', fontSize: 17, maxWidth: 560 }}>Post your first gig in 60 seconds. Card on file required so we can fund worker payouts via Stripe Connect.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => goToAuth('signup')}>Get started</button>
          <button className="btn btn-ghost btn-lg" onClick={() => setRoute('gallery')}>See it in action</button>
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
  const [email, setEmail] = SX_us('');
  const [pw, setPw] = SX_us('');
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

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        if (window.sb) await window.sb.auth.resetPasswordForEmail(email);
        toast.push({ kind: 'success', title: 'Reset link sent', body: 'Check your inbox if an account exists for that address.' });
        setSubmitting(false);
        return;
      }
      if (window.sb) {
        const fn = mode === 'signup' ? window.sb.auth.signUp : window.sb.auth.signInWithPassword;
        const { data, error } = await fn.call(window.sb.auth, { email, password: pw });
        if (error) throw error;
        if (mode === 'signup' && !data?.session) {
          toast.push({ kind: 'info', title: 'Check your inbox', body: 'Click the link to confirm your email, then log in.' });
          setSubmitting(false);
          return;
        }
      }
      toast.push({ kind: 'success', title: mode === 'signup' ? 'Welcome to Rosy' : 'Welcome back', body: 'Loading your dashboard…' });
      goToApp();
    } catch (err) {
      toast.push({ kind: 'error', title: mode === 'signup' ? 'Signup failed' : 'Login failed', body: err.message || 'Try again.' });
      setSubmitting(false);
    }
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
            mode === 'signup' ? <p style={{ margin: '-6px 0 0', color: 'var(--color-muted)' }}>Workers join free. Vendors add a card during onboarding to fund payouts.</p> :
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
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: 'var(--color-muted)' }}>{show ? <SX_I.EyeOff size={16} /> : <SX_I.Eye size={16} />}</button>
              </div>
              {mode === 'login' ? <button type="button" className="btn-link" style={{ alignSelf: 'flex-end', fontSize: 12.5, cursor: 'pointer', background: 'transparent', border: 0, padding: 0 }} onClick={() => setMode('forgot')}>Forgot password?</button> : null}
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
              <GoogleButton onClick={async () => { try { if (window.sb) { /* No hash in redirectTo — implicit-flow OAuth appends #access_token=... and a stale hash creates a broken double-hash URL. App.jsx routes us after the session is set. */ const redirectTo = window.location.origin + window.location.pathname; const { error } = await window.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }); if (error) throw error; return; } } catch (err) { toast.push({ kind: 'warning', title: 'Google sign-in not configured', body: err.message }); return; } }} label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'} />
            </>
          ) : null}

          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', textAlign: 'center' }}>
            {mode === 'login' ? <>Need an account? <button type="button" className="btn-link" style={{ cursor: 'pointer', background: 'transparent', border: 0, padding: 0 }} onClick={() => setMode('signup')}>Sign up</button></> :
             mode === 'signup' ? <>Already have an account? <button type="button" className="btn-link" style={{ cursor: 'pointer', background: 'transparent', border: 0, padding: 0 }} onClick={() => setMode('login')}>Log in</button></> :
             <button type="button" className="btn-link" style={{ cursor: 'pointer', background: 'transparent', border: 0, padding: 0 }} onClick={() => setMode('login')}>Back to log in</button>}
          </p>
        </form>
      </div>
    </div>
  );
}

/* ============ Onboarding ============ */
function OnboardingPage({ onComplete }) {
  // Step 1 picks role(s). When done we surface the picked role through onComplete so app.jsx
  // can pin the demo role (signed-in role is already pinned via the session).
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
          {role.vendor ? (
            <>
              <div style={{ background: '#F59E0B', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <SX_I.Building2 size={20} />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.01em' }}>Vendor Profile</h3>
              </div>
              <div style={{ padding: 24, maxHeight: role.worker ? '40vh' : '60vh', overflowY: 'auto' }}>
                <ProfileForm role="vendor" />
              </div>
            </>
          ) : null}
          {role.worker ? (
            <>
              <div style={{ background: 'var(--rosy-coral)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <SX_I.HardHat size={20} />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.01em' }}>Worker Profile</h3>
              </div>
              <div style={{ padding: 24, maxHeight: role.vendor ? '40vh' : '60vh', overflowY: 'auto' }}>
                <ProfileForm role="worker" />
              </div>
            </>
          ) : null}
          <div style={{ padding: '16px 24px', background: 'var(--color-surface-soft)', borderTop: '1px solid var(--color-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span className={`checkbox ${tc ? 'checked' : ''}`} onClick={() => { if (!tc) setTcOpen(true); else setTc(false); }}>{tc ? <SX_I.CheckCircle size={12} /> : null}</span>
              Agree to the <button type="button" className="btn-link" style={{ cursor: 'pointer', background: 'transparent', border: 0, padding: 0 }} onClick={() => setTcOpen(true)}>terms & conditions</button>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-coral" disabled={!tc} onClick={() => { onComplete(role.vendor ? 'vendor' : 'worker'); }}>Continue</button>
            </div>
          </div>
        </div>
      ) : null}

      <TCModal open={tcOpen} onClose={() => setTcOpen(false)} onAgree={() => { setTc(true); setTcOpen(false); toast.push({ kind: 'success', title: 'Terms accepted' }); }} role={role.vendor ? 'vendor' : 'worker'} />

      <Modal open={stripeOpen} onClose={() => setStripeOpen(false)} title="" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setStripeOpen(false); onComplete(role.vendor ? 'vendor' : 'worker'); }}>Skip for now</button><button className="btn btn-coral" onClick={() => { setStripeOpen(false); toast.push({ kind: 'success', title: 'Connected to Stripe' }); onComplete(role.vendor ? 'vendor' : 'worker'); }}>Continue to Stripe</button></>}>
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
  // Worker W-9 / TIN form state
  const [wName, setWName] = SX_us('');
  const [wBusiness, setWBusiness] = SX_us('');
  const [wClass, setWClass] = SX_us('');
  const [wClassOther, setWClassOther] = SX_us('');
  const [wExempt, setWExempt] = SX_us('');
  const [wFatca, setWFatca] = SX_us('');
  const [wSsn, setWSsn] = SX_us('');
  const [wEin, setWEin] = SX_us('');
  React.useEffect(() => {
    if (!open) {
      setSigned(false); setReadAck(false);
      setWName(''); setWBusiness(''); setWClass(''); setWClassOther(''); setWExempt(''); setWFatca(''); setWSsn(''); setWEin('');
    }
  }, [open]);

  const workerValid = wName.trim() && wClass && (wSsn.trim() || wEin.trim());
  const valid = role === 'vendor'
    ? (signed && readAck)
    : (signed && readAck && workerValid);

  return (
    <Modal open={open} onClose={onClose} title={role === 'vendor' ? 'Rosy Recruits — Vendor Terms & Conditions' : 'Rosy Recruits — Worker Terms & Conditions'} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-coral" disabled={!valid} onClick={onAgree}>I agree</button></>}>
      {role === 'vendor' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>Welcome! Please review the terms below. By clicking "I Agree", you confirm that you understand and accept all terms.</p>
          <div><strong>1. Purpose</strong> — Rosy Recruits provides vetted, trained temporary Workers for events and labor. All Workers must be booked and used through the Rosy Recruits App only.</div>
          <div>
            <strong>2. Worker Types & Rates</strong>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--color-surface-soft)' }}><th style={{ padding: '8px 10px', textAlign: 'left' }}>Worker Type</th><th style={{ padding: '8px 10px', textAlign: 'left' }}>Rate</th><th style={{ padding: '8px 10px', textAlign: 'left' }}>Minimum Hours</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>Assist</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>$26/hr</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>4 hours</td></tr>
                <tr><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>Design / Tech / Lead</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>$35/hr</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>4 hours</td></tr>
                <tr><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>Strikers</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>$45/hr</td><td style={{ padding: '8px 10px', borderTop: '1px solid var(--color-hairline)' }}>2 hours</td></tr>
              </tbody>
            </table>
            <p style={{ margin: '8px 0 0', color: 'var(--color-muted)' }}>Time beyond minimum is billed in 15-minute increments. Only actual hours worked will be charged.</p>
          </div>
          <div><strong>3. Payment</strong> — Workers mark shifts complete in the app. You have 24 hours to review and approve. If no approval, charges for hours worked are automatically applied to your credit card. A pre-authorization hold (estimated total + 25%) may be applied before scheduled shifts.</div>
          <div><strong>4. Cancellations</strong> — No Worker assigned: delete freely, no charge. Worker assigned: 2+ weeks before event 50% of total service + fees. Less than 2 weeks: 100% of total service + fees.</div>
          <div><strong>5. Non-Poaching</strong> — You may not hire or engage Workers outside the Rosy Recruits App. If a Worker leaves Company and approaches you within 12 months, you may not hire them. Violations automatically incur penalties: Standard Worker $3,500, Rosy Guide $10,000.</div>
          <div><strong>6. Independent Contractors</strong> — All Workers are independent contractors. You are not their employer.</div>
          <div><strong>7. Liability & Insurance</strong> — Company is not responsible for damages caused by Workers outside its control. You must maintain insurance and provide proper packing/protection for materials.</div>
          <div><strong>8. Confidentiality</strong> — Do not share Company's platform, rates, or Worker data with anyone outside your organization.</div>
          <div><strong>9. Agreement Duration</strong> — Effective until either party gives 30 days' notice. All balances and penalties are due on termination.</div>
          <div><strong>10. Governing Law</strong> — Governed by the laws of the State of [Your State].</div>
          <div><strong>11. Digital Acknowledgment</strong> — By clicking "I Agree", you confirm that: (1) you have read and understand these terms, (2) you accept and agree to comply with all rules, (3) your digital acknowledgment is legally binding.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13.5, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>Welcome! Please review the terms below. By clicking "I Agree", you confirm that you understand and accept all terms.</p>
          <div><strong>1. Purpose</strong> — Rosy Recruits provides vetted, trained temporary Workers for events and labor. All Workers must be booked and used through the Rosy Recruits App only.</div>
          <div><strong>2. Worker Types & Rates</strong> — Assist $26/hr, Design/Tech/Lead $35/hr, Strikers $45/hr. Time beyond minimum is billed in 15-minute increments.</div>
          <div><strong>3. Payment</strong> — Workers mark shifts complete in the app; vendors have 24 hours to approve. Stripe Connect releases your pay within 48 hours of approval.</div>
          <div><strong>4. Cancellations</strong> — If you cancel within 48 hours of a booked shift, you may incur a fee and your rating will be affected. Repeated no-shows result in account suspension.</div>
          <div><strong>5. Non-Poaching</strong> — You may not solicit Vendor work outside the Rosy Recruits App. Violations carry a $3,500 penalty.</div>
          <div><strong>6. Independent Contractor</strong> — You are an independent contractor, not an employee of Rosy Recruits or any Vendor. You're responsible for your own taxes — that's why we collect the W-9 information below.</div>
          <div><strong>7. Confidentiality & Digital Acknowledgment</strong> — Do not share Vendor materials with anyone outside the engagement. By clicking "I Agree" you confirm that you have read and accept these terms.</div>

          <div style={{ borderTop: '1.5px solid var(--color-hairline)', paddingTop: 16 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-0.01em' }}>Request for Taxpayer Identification Number and Certification</h3>
            <p style={{ margin: '8px 0 16px', color: 'var(--color-muted)' }}>The IRS requires this from every U.S.-based independent contractor. We use it for 1099-NEC reporting when you earn more than $600 in a calendar year.</p>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="field"><label className="field-label">Name *</label><input className="input" value={wName} onChange={e => setWName(e.target.value)} placeholder="Full legal name (as on tax return)" /></div>
              <div className="field"><label className="field-label">Business name (if different)</label><input className="input" value={wBusiness} onChange={e => setWBusiness(e.target.value)} placeholder="DBA / entity name" /></div>
            </div>
            <div className="grid-2" style={{ gap: 14, marginTop: 12 }}>
              <div className="field"><label className="field-label">Exempt payee code (if any)</label><input className="input" value={wExempt} onChange={e => setWExempt(e.target.value)} placeholder="Most individuals leave blank" /></div>
              <div className="field"><label className="field-label">FATCA exemption code (if any)</label><input className="input" value={wFatca} onChange={e => setWFatca(e.target.value)} placeholder="Most individuals leave blank" /></div>
            </div>
            <p style={{ margin: '14px 0 6px', fontSize: 13, fontWeight: 600 }}>Check the appropriate box for federal tax classification of the entity / individual whose name is entered on line 1.</p>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="field"><label className="field-label">Tax classification *</label>
                <select className="select" value={wClass} onChange={e => setWClass(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="individual">Individual / sole proprietor / single-member LLC</option>
                  <option value="c_corp">C corporation</option>
                  <option value="s_corp">S corporation</option>
                  <option value="partnership">Partnership</option>
                  <option value="trust">Trust / estate</option>
                  <option value="llc">Limited liability company</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field"><label className="field-label">Other (if "Other" selected)</label><input className="input" value={wClassOther} onChange={e => setWClassOther(e.target.value)} disabled={wClass !== 'other'} placeholder="Describe" /></div>
            </div>
            <p style={{ margin: '14px 0 6px', fontSize: 13, fontWeight: 600 }}>Enter your TIN in the appropriate box. The TIN must match the name on line 1 to avoid backup withholding. For individuals, this is your SSN.</p>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="field"><label className="field-label">Social security number</label><input className="input" value={wSsn} onChange={e => setWSsn(e.target.value)} placeholder="XXX-XX-XXXX" inputMode="numeric" /></div>
              <div className="field"><label className="field-label">(or) Employer identification number</label><input className="input" value={wEin} onChange={e => setWEin(e.target.value)} placeholder="XX-XXXXXXX" inputMode="numeric" /></div>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--color-surface-soft)', borderRadius: 12, fontSize: 12.5, color: 'var(--color-muted)' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-body-strong)', marginBottom: 6 }}>Under penalties of perjury, I certify that:</p>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued).</li>
                <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the IRS that I am subject to backup withholding, or (c) the IRS has notified me that I am no longer subject to backup withholding.</li>
                <li>I am a U.S. citizen or other U.S. person (defined below).</li>
                <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px 0 12px', fontSize: 14, cursor: 'pointer' }}>
        <CheckBox checked={readAck} onChange={setReadAck} />
        <span>I've read and understand these terms{role === 'worker' ? ' and certify that the W-9 information above is correct' : ''}.</span>
      </label>
      <div style={{ marginTop: 8 }}>
        <SignaturePad onChange={setSigned} />
      </div>
      {!valid ? <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--color-muted)', textAlign: 'center' }}>{role === 'worker' && !workerValid ? 'Fill in your name, tax classification, and SSN or EIN above. ' : ''}{!readAck ? 'Check the box and ' : ''}sign above to continue.</p> : null}
    </Modal>
  );
}

function ProfileForm({ role }) {
  const [hours, setHours] = SX_us(false);
  const [photo, setPhoto] = SX_us(null);
  const [first, setFirst] = SX_us('');
  const [last, setLast] = SX_us('');
  const [phone, setPhone] = SX_us('');
  const [title, setTitle] = SX_us('');
  const [company, setCompany] = SX_us('');
  const [bio, setBio] = SX_us('');
  const [services, setServices] = SX_us([]);
  const allServices = ['Install & Breakdown','Onsite Design','D.I.Y. Couples','Studio Clean-Up','Event Consultations'];
  const toggleService = (s) => setServices(arr => arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s]);
  return (
    <div className="col" style={{ gap: 14 }}>
      <ImageUpload value={photo} onChange={setPhoto} label={role === 'vendor' ? 'Upload your studio logo' : 'Upload a profile photo'} size={96} round={role !== 'vendor' ? true : false} />
      <div className="grid-2">
        <div className="field"><label className="field-label">First name</label><input className="input" value={first} onChange={e => setFirst(e.target.value)} placeholder="Jane" /></div>
        <div className="field"><label className="field-label">Last name</label><input className="input" value={last} onChange={e => setLast(e.target.value)} placeholder="Doe" /></div>
      </div>
      <div className="field"><label className="field-label">Phone number <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(US only)</span></label>
        <input className="input" type="tel" value={phone}
          onChange={e => {
            // Auto-format as US (xxx) xxx-xxxx as the user types
            const d = e.target.value.replace(/\D/g, '').slice(0, 10);
            let f = d;
            if (d.length > 6) f = `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
            else if (d.length > 3) f = `(${d.slice(0,3)}) ${d.slice(3)}`;
            else if (d.length > 0) f = `(${d}`;
            setPhone(f);
          }}
          placeholder="(555) 555-0100" />
        {(() => {
          const digits = (phone || '').replace(/\D/g, '');
          if (!digits) return null;
          if (digits.length !== 10) return <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--rosy-coral)' }}>Must be a valid 10-digit US number.</p>;
          // First digit of area code can't be 0 or 1
          if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--rosy-coral)' }}>Not a valid US phone number.</p>;
          return <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--rosy-teal-dark)' }}>✓ Valid US number</p>;
        })()}
      </div>
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Your role at the studio' : 'Your specialty'}</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={role === 'vendor' ? 'Owner / Creative Director / Lead Designer' : 'Lead designer / Strike crew / Assist'} /></div>
      {role === 'vendor' ? <div className="field"><label className="field-label">Studio / company name</label><input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Bloom & Fern Studio" /></div> : null}
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
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Studio address' : 'Home base'}</label>
        <AddressInput placeholder={role === 'vendor' ? 'Search your studio address' : 'City or neighborhood'} />
      </div>
      {role === 'vendor' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Show public business hours on your profile</span>
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
        </>
      ) : null}
      <div className="field"><label className="field-label">{role === 'vendor' ? 'Studio description' : 'About you'}</label>
        <textarea className="textarea" value={bio} onChange={e => setBio(e.target.value)}
          placeholder={role === 'vendor'
            ? 'A short paragraph couples and brands will see. What kind of work, what style, where you work.'
            : 'A short paragraph vendors will see. Years of experience, your strongest skills, anything that stands out.'} />
      </div>
    </div>
  );
}

Object.assign(window, { PageInbox, MarketingPage, AuthPage, OnboardingPage });

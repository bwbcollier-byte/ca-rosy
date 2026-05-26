/* Marketing subpages — vendors, workers, gallery, pricing, faq, about, careers,
   press, contact, terms, privacy, security */

const MP_D = window.RosyData;
const MP_I = window.Icons;
const { useState: MP_us, useEffect: MP_ue } = React;
// Helper — gracefully falls back if RosyContent isn't loaded yet.
const C = (page, blockId, fallback) => (window.RosyContent ? window.RosyContent(page, blockId, fallback) : fallback);
// Hook: re-render this component whenever site content is saved in admin.
function useSiteContentTick() {
  const [, setTick] = MP_us(0);
  MP_ue(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('rosy:site-content-changed', bump);
    return () => window.removeEventListener('rosy:site-content-changed', bump);
  }, []);
}

/* ---------- Shared shell ---------- */
function MarketingShell({ route, setRoute, goToAuth, children }) {
  const wrappedSet = (r) => {
    if (r === route) return;
    // Jump to top instantly behind the crossfade so the new page starts clean
    window.scrollTo({ top: 0, behavior: 'auto' });
    setRoute(r);
  };
  return (
    <div className="mk-shell">
      <MarketingNav route={route} setRoute={wrappedSet} goToAuth={goToAuth} />
      <div key={route} className="mk-page-enter">{children}</div>
      <MarketingFooter setRoute={wrappedSet} goToAuth={goToAuth} />
    </div>
  );
}

function MarketingNav({ route, setRoute, goToAuth }) {
  const items = [
    { id: 'vendors',  label: 'For vendors' },
    { id: 'workers',  label: 'For workers' },
    { id: 'gallery',  label: 'Gallery' },
    { id: 'faq',      label: 'FAQ' },
  ];
  const [open, setOpen] = MP_us(false);
  React.useEffect(() => { setOpen(false); }, [route]);
  const go = (id) => { setOpen(false); setRoute(id); };
  return (
    <header className="mk-nav">
      <div className="mk-logo" style={{ cursor: 'pointer' }} onClick={() => go('home')}>
        <RoseLogo />Rosy<span className="accent"> Recruits</span>
      </div>
      <nav className="mk-links">
        {items.map(i => (
          <a key={i.id} href={`#marketing/${i.id}`} onClick={(e) => { e.preventDefault(); setRoute(i.id); }} aria-current={route === i.id ? 'page' : undefined} className={route === i.id ? 'is-active' : ''} style={{ color: route === i.id ? 'var(--rosy-coral)' : 'var(--color-body-strong)' }}>{i.label}</a>
        ))}
      </nav>
      <div className="mk-right">
        <MarketingNavAuthButtons goToAuth={goToAuth} />
      </div>
      <button className="mk-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? <MP_I.X size={22} /> : <MP_I.Menu size={22} />}
      </button>
      {open ? (
        <div className="mk-mobile-menu">
          {items.map(i => (
            <button key={i.id} className={`mk-mobile-link ${route === i.id ? 'is-active' : ''}`} onClick={() => go(i.id)}>{i.label}</button>
          ))}
          <div className="mk-mobile-divider" />
          <button className="btn btn-ghost btn-block" onClick={() => { setOpen(false); goToAuth('login'); }}>Log in</button>
          <button className="btn btn-coral btn-block" onClick={() => { setOpen(false); goToAuth('signup'); }}>Get started</button>
        </div>
      ) : null}
    </header>
  );
}

function MarketingNavAuthButtons({ goToAuth }) {
  const [hasSession, setHasSession] = MP_us(false);
  React.useEffect(() => {
    if (!window.sb) return;
    window.sb.auth.getSession().then(({ data }) => setHasSession(!!data?.session));
    const { data: sub } = window.sb.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);
  if (hasSession) {
    return (
      <>
        <button className="btn btn-ghost btn-sm" onClick={() => { window.location.hash = 'logout'; }}>Log out</button>
        <button className="btn btn-coral btn-sm" onClick={() => { window.location.hash = 'app/dashboard'; }}>Open app</button>
      </>
    );
  }
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => goToAuth('login')}>Log in</button>
      <button className="btn btn-coral btn-sm" onClick={() => goToAuth('signup')}>Get started</button>
    </>
  );
}

function MarketingFooter({ setRoute, goToAuth }) {
  const cols = [
    { h: 'Product', items: [['Vendors','vendors'], ['Workers','workers']] },
    { h: 'Company', items: [['About','about'], ['Contact','contact']] },
    { h: 'Legal',   items: [['Terms','terms'], ['Privacy','privacy']] },
  ];
  return (
    <footer style={{ background: 'var(--color-surface-soft)', padding: '56px 32px 28px', borderTop: '1px solid var(--color-hairline)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, alignItems: 'flex-start' }}>
          <div>
            <div className="mk-logo" style={{ marginBottom: 12 }}><RoseLogo />Rosy<span className="accent"> Recruits</span></div>
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13.5, maxWidth: 320 }}>The hiring and payments platform for floral event studios, with Stripe Connect for instant worker payouts.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-coral btn-sm" onClick={() => goToAuth('signup')}>Get started</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setRoute('contact')}>Talk to us</button>
            </div>
          </div>
          {cols.map(col => (
            <div key={col.h}>
              <p className="t-eyebrow" style={{ marginBottom: 12 }}>{col.h}</p>
              {col.items.map(([label, id]) => (
                <p key={id} style={{ margin: '0 0 8px', fontSize: 13.5 }}>
                  <a href={`#marketing/${id}`} style={{ color: 'var(--color-body)', textDecoration: 'none', cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRoute(id); }}>{label}</a>
                </p>
              ))}
            </div>
          ))}
        </div>
        <div className="divider" style={{ margin: '32px 0 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--color-muted-soft)' }}>
          <span>© 2026 Rosy Recruits, Inc. · Made in Chicago.</span>
          <span style={{ display: 'flex', gap: 16 }}>
            <a href="#marketing/terms" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRoute('terms'); }}>Terms</a>
            <a href="#marketing/privacy" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRoute('privacy'); }}>Privacy</a>
            <a href="#marketing/security" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRoute('security'); }}>Security</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Page hero block (reusable) ---------- */
function MkHero({ eyebrow, title, sub, cta, ctaLabel, accent = 'peach' }) {
  return (
    <section style={{ background: `var(--color-brand-${accent})`, padding: '88px 32px 96px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {eyebrow ? <span className="t-eyebrow" style={{ color: 'var(--color-ink)' }}>{eyebrow}</span> : null}
        <h1 className="display-xl" style={{ margin: '14px 0 18px', maxWidth: 900 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 19, color: 'var(--color-body)', maxWidth: 620 }}>{sub}</p>
        {cta ? <div style={{ marginTop: 28 }}><button className="btn btn-primary btn-lg" onClick={cta}>{ctaLabel}</button></div> : null}
      </div>
    </section>
  );
}

/* ============ For vendors ============ */
function MkVendorsPage({ goToAuth }) {
  useSiteContentTick();
  return (
    <>
      <MkHero accent="ochre"
        eyebrow={C('vendors', 'eyebrow', 'For vendors')}
        title={C('vendors', 'hero_title', 'Crew up. Show up. Look brilliant.')}
        sub={C('vendors', 'hero_sub', 'Spin up an entire wedding team from your phone. Workers see the gig, you approve the applications, both sides get paid through Stripe Connect.')}
        cta={() => goToAuth('signup')}
        ctaLabel={C('vendors', 'cta_label', "Start hiring — it's free")} />

      <section className="mk-section">
        <div className="grid-3">
          {[
            { color: 'peach',    icon: MP_I.CalendarCheck, h: C('vendors','feature1_title','Post in 60 seconds'), p: C('vendors','feature1_body','Type, date, hourly rate, spots. We push it to qualified workers in your zip code within minutes.') },
            { color: 'lavender', icon: MP_I.ShieldCheck,   h: C('vendors','feature2_title','Verified only'),      p: C('vendors','feature2_body','Every Lead and Design role is portfolio-reviewed and ID-verified. Strike and Assist are background-checked.') },
            { color: 'coral',    icon: MP_I.DollarSign,    h: C('vendors','feature3_title','One bill, one check'),p: C('vendors','feature3_body','Fund the gig once. Rosy splits payouts across your team. No 1099s, no chasing receipts.') },
          ].map(c => (
            <div key={c.h} className={`feature-card ${c.color}`}>
              <c.icon size={28} />
              <h3 style={{ margin: '18px 0 8px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>{c.h}</h3>
              <p style={{ margin: 0, fontSize: 15, opacity: 0.9 }}>{c.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2 className="display-lg" style={{ maxWidth: 720, marginBottom: 32 }}>{C('vendors','section_title',"The studio dashboard you've been faking with spreadsheets.")}</h2>
        <div className="grid-2" style={{ gap: 32, alignItems: 'center' }}>
          <div className="col" style={{ gap: 16 }}>
            {[
              ['One view of every event','See dates, venues, gig fill rates, and pending payouts in one screen. No spreadsheet handoff.'],
              ['Move workers across events','Reuse your roster. Tag your favorites. Worker shows up on Saturday, helps the next Saturday too.'],
              ['Disputes mediated in 48h','When something goes wrong, file a dispute. Rosy reviews evidence from both sides and rules.'],
              ['Stripe Connect, day one','Connect your bank in two minutes. Funds move on Tuesdays.'],
            ].map(([h, p]) => (
              <div key={h} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--rosy-coral-soft)', color: 'var(--rosy-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><MP_I.CheckCircle size={18} /></div>
                <div><p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{h}</p><p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>{p}</p></div>
              </div>
            ))}
          </div>
          <div style={{ aspectRatio: '4/5', borderRadius: 24, overflow: 'hidden', background: 'var(--color-brand-mint)' }}>
            <img src={MP_D.IMAGES.marketingVendor} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      <CTABand goToAuth={goToAuth} />
    </>
  );
}

/* ============ For workers ============ */
function MkWorkersPage({ goToAuth }) {
  useSiteContentTick();
  return (
    <>
      <MkHero accent="mint"
        eyebrow={C('workers','eyebrow','For workers')}
        title={C('workers','hero_title','Steady, beautiful work.')}
        sub={C('workers','hero_sub','Three studios a week or thirty events a season — set your availability, pick your gigs, get paid on time. Lead roles pay $50/hr.')}
        cta={() => goToAuth('signup')}
        ctaLabel={C('workers','cta_label','Join as a worker')} />

      <section className="mk-section">
        <h2 className="display-lg" style={{ maxWidth: 720, marginBottom: 32 }}>{C('workers','rates_title','What you actually take home.')}</h2>
        <div className="grid-4">
          {[
            { type: 'Lead',   hourly: 50, color: 'var(--gig-design-bg)' },
            { type: 'Design', hourly: 38, color: 'var(--gig-design-bg)' },
            { type: 'Assist', hourly: 22, color: 'var(--gig-assist-bg)' },
            { type: 'Strike', hourly: 28, color: 'var(--gig-strike-bg)' },
          ].map(g => (
            <div key={g.type} className="card" style={{ background: g.color, border: 0 }}>
              <GigChip type={g.type} />
              <p style={{ margin: '14px 0 0', fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 500, letterSpacing: '-0.02em' }}>${g.hourly}<span style={{ fontSize: 16, color: 'var(--color-muted)', fontFamily: 'var(--font-body)', fontWeight: 400, marginLeft: 4 }}>/hr</span></p>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>Avg, varies by event</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="grid-2" style={{ gap: 32, alignItems: 'center' }}>
          <div style={{ aspectRatio: '4/5', borderRadius: 24, overflow: 'hidden', background: 'var(--color-brand-peach)' }}>
            <img src={MP_D.IMAGES.marketingWorker} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div className="col" style={{ gap: 16 }}>
            <h2 className="display-md">{C('workers','why_title','Why workers stay.')}</h2>
            {[
              ['Set your own availability','Block the days you don\'t want to work. We won\'t show you gigs on those days.'],
              ['Get paid Tuesdays','Stripe Connect releases your earnings within 48 hours of approved hours.'],
              ['Real ratings, real visibility','High ratings push you to the top of vendor feeds. We don\'t hide your rank behind paywalls.'],
              ['1099-NEC at year-end','Rosy generates and mails your tax forms automatically.'],
            ].map(([h, p]) => (
              <div key={h} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9999, background: 'var(--rosy-teal-soft)', color: 'var(--rosy-teal-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><MP_I.CheckCircle size={15} /></div>
                <div><p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{h}</p><p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>{p}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABand goToAuth={goToAuth} ctaLabel="Sign up as a worker" />
    </>
  );
}

/* ============ Gallery ============ */
function MkGalleryPage() {
  useSiteContentTick();
  const [active, setActive] = MP_us(null);
  const heights = [320, 260, 380, 280, 340, 300, 360, 240, 380, 300, 260, 340];
  const tiles = [...MP_D.IMAGES.gallery, ...MP_D.IMAGES.events];
  return (
    <>
      <section style={{ background: 'var(--color-canvas)', padding: '72px 32px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <span className="t-eyebrow">{C('gallery','eyebrow','Gallery')}</span>
          <h1 className="display-xl" style={{ margin: '14px 0 16px' }}>{C('gallery','title','Work made by Rosy crews.')}</h1>
          <p style={{ margin: 0, fontSize: 18, color: 'var(--color-body)', maxWidth: 620 }}>{C('gallery','sub','A few rooms, weddings, and editorial moments built end-to-end by teams booked through the platform.')}</p>
        </div>
      </section>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>
        <div style={{ columnCount: 3, columnGap: 16 }}>
          {tiles.map((src, i) => (
            <div key={i} onClick={() => setActive(src)} style={{ breakInside: 'avoid', marginBottom: 16, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: 'var(--color-surface-card)' }}>
              <img src={src} alt="" style={{ width: '100%', height: heights[i % heights.length], objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      </section>
      <Modal open={!!active} onClose={() => setActive(null)} title="" size="xl">
        {active ? <img src={active} alt="" style={{ width: '100%', display: 'block', borderRadius: 12 }} /> : null}
      </Modal>
    </>
  );
}

/* ============ Pricing ============ */
function MkPricingPage({ goToAuth }) {
  const [yearly, setYearly] = MP_us(false);
  // Live platform fee from rr_platform_settings. Falls back to seed % if not hydrated.
  const [livePlatformFee, setLivePlatformFee] = MP_us(null);
  MP_ue(() => {
    let cancel = false;
    (async () => {
      if (!window.sb) return;
      try {
        const { data } = await window.sb.from('rr_platform_settings').select('key,value').eq('key', 'platform_fee_percent').single();
        if (!cancel && data) setLivePlatformFee(Number(data.value) || null);
      } catch (e) {}
    })();
    return () => { cancel = true; };
  }, []);
  const workerTake = livePlatformFee != null ? (100 - livePlatformFee) : 92;
  const tiers = [
    { id: 'starter', name: 'Starter',   price: 0,   yprice: 0,   fee: '8%', desc: 'Solo florists and side studios.',  cta: 'Start free',
      features: ['Post unlimited gigs','Up to 4 active events','Stripe Connect payouts','Standard support','Basic analytics'] },
    { id: 'studio',  name: 'Studio',    price: 39,  yprice: 32,  fee: '6%', desc: 'Working studios with 5–25 events a year.', cta: 'Start free trial',
      features: ['Everything in Starter','Unlimited events','Worker favorites + rosters','Priority support','Custom branding on invoices','Recurring gig templates'] },
    { id: 'pro',     name: 'Pro',       price: 99,  yprice: 79,  fee: '4%', desc: 'High-volume studios + planners.', highlight: true, cta: 'Start free trial',
      features: ['Everything in Studio','Multi-user team accounts','Approval workflows','Worker performance reports','Dedicated success manager','Same-day Stripe payouts','API & webhooks'] },
    { id: 'ent',     name: 'Enterprise', price: null, fee: 'Custom', desc: 'Agencies & multi-market operators.', cta: 'Talk to sales',
      features: ['Everything in Pro','SSO & SAML','Custom contracts','SLA-backed support','Audit & SOC 2 reports','Per-market workflows','Embedded payments'] },
  ];
  return (
    <>
      <section style={{ padding: '72px 32px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <span className="t-eyebrow">Pricing</span>
          <h1 className="display-xl" style={{ margin: '14px 0 14px' }}>Plans that scale with your event load.</h1>
          <p style={{ margin: '0 auto', fontSize: 18, color: 'var(--color-body)', maxWidth: 620 }}>Workers join at no cost. Vendors pay a transparent per-gig platform fee plus an optional plan for higher volume.</p>
          <div style={{ display: 'inline-flex', background: 'var(--color-surface-soft)', padding: 3, borderRadius: 9999, marginTop: 24 }}>
            <button onClick={() => setYearly(false)} aria-pressed={!yearly} style={{ border: 0, padding: '8px 18px', borderRadius: 9999, background: !yearly ? 'var(--color-canvas)' : 'transparent', color: !yearly ? 'var(--color-ink)' : 'var(--color-muted)', boxShadow: !yearly ? 'var(--shadow-soft)' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Monthly</button>
            <button onClick={() => setYearly(true)} aria-pressed={yearly} style={{ border: 0, padding: '8px 18px', borderRadius: 9999, background: yearly ? 'var(--color-canvas)' : 'transparent', color: yearly ? 'var(--color-ink)' : 'var(--color-muted)', boxShadow: yearly ? 'var(--shadow-soft)' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Yearly <span style={{ color: 'var(--rosy-coral)', fontSize: 11, marginLeft: 4 }}>Save 20%</span></button>
          </div>
        </div>
      </section>
      <section className="mk-section" style={{ paddingTop: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {tiers.map(t => (
            <div key={t.id} style={{ background: t.highlight ? 'var(--rosy-teal-soft)' : 'var(--color-canvas)', border: t.highlight ? '2px solid var(--rosy-teal)' : '1px solid var(--color-hairline)', borderRadius: 20, padding: 28, position: 'relative' }}>
              {t.highlight ? <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--rosy-teal)', color: '#fff', padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Most popular</span> : null}
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24 }}>{t.name}</h3>
              <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--color-muted)' }}>{t.desc}</p>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {t.price == null ? 'Custom' : `$${yearly ? t.yprice : t.price}`}
                {t.price != null ? <span style={{ fontSize: 14, color: 'var(--color-muted)', fontFamily: 'var(--font-body)', fontWeight: 400, marginLeft: 4 }}>/mo</span> : null}
              </p>
              <p style={{ margin: '12px 0 18px', fontSize: 12.5, color: 'var(--color-muted)' }}>Platform fee: <strong style={{ color: 'var(--color-ink)' }}>{t.fee}</strong></p>
              <button className={`btn btn-block ${t.highlight ? 'btn-coral' : 'btn-ghost'}`} onClick={() => { if (t.id === 'ent') { window.location.hash = 'marketing/contact'; } else { goToAuth('signup'); } }}>{t.cta}</button>
              <div className="divider" style={{ margin: '20px 0' }} />
              <div className="col" style={{ gap: 8 }}>
                {t.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                    <MP_I.CheckCircle size={15} style={{ color: 'var(--rosy-teal-dark)', flex: 'none', marginTop: 1 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, padding: 20, background: 'var(--color-surface-soft)', borderRadius: 16, textAlign: 'center', fontSize: 14, color: 'var(--color-body)' }}>
          <strong>Workers are always free.</strong> Workers keep {workerTake}% of every gig rate. The platform fee above applies only to vendors.
        </div>
      </section>
      <CTABand goToAuth={goToAuth} />
    </>
  );
}

/* ============ FAQ ============ */
function MkFAQPage({ goToAuth, setRoute }) {
  useSiteContentTick();
  // Refetch FAQs on mount so a hard refresh on /#marketing/faq always renders
  // the current DB state — defensive against any realtime drop or stale cache.
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.sb) return;
        const { data, error } = await window.sb.from('rr_faqs').select('*').order('sort_order', { ascending: true });
        if (cancelled || error || !Array.isArray(data)) return;
        window.RosyData.FAQS = data.map(f => ({
          q: f.question, a: f.answer,
          id: f.id, question: f.question, answer: f.answer,
          sort_order: f.sort_order, is_visible: f.is_visible,
          audiences: Array.isArray(f.audiences) ? f.audiences : [],
          audience_orders: f.audience_orders && typeof f.audience_orders === 'object' ? f.audience_orders : {},
        }));
        forceTick(t => t + 1);
      } catch (e) { /* keep existing FAQS on error */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // Prefer live admin-managed FAQs from window.RosyData.FAQS (hydrated from rr_faqs).
  // Filter to FAQs tagged with the 'marketing' audience. Falls back to the
  // seed list only on cold-boot before hydration completes.
  const liveFaqs = (window.RosyData?.FAQS || [])
    .filter(f => f.is_visible !== false)
    // Strict: the FAQ must be EXPLICITLY tagged 'marketing'. Untagged legacy
    // rows are excluded — admins should re-tag them via the FAQs admin page.
    // Previously `!f.audiences` let untagged rows leak through, and any
    // empty-array audiences row counted as "untagged".
    .filter(f => Array.isArray(f.audiences) && f.audiences.includes('marketing'))
    .sort((a, b) => {
      // Use the admin's per-audience drag order (marketing slot here).
      const ao = (a.audience_orders || {}).marketing;
      const bo = (b.audience_orders || {}).marketing;
      const an = ao != null ? ao : (a.sort_order ?? 0);
      const bn = bo != null ? bo : (b.sort_order ?? 0);
      return an - bn;
    })
    .map(f => ({ q: f.question, a: f.answer }));
  const startingItems = liveFaqs.length ? liveFaqs : MP_D.FAQS;
  const groups = [
    { h: 'Getting started', items: startingItems },
    { h: 'Payments & taxes', items: [
      { q: C('faq','faq1_q','When do workers get paid?'), a: C('faq','faq1_a','Within 48 hours of vendor-approved hours, via Stripe Connect direct deposit.') },
      { q: C('faq','faq2_q','Are 1099s automatic?'),      a: C('faq','faq2_a','Yes. If you earn more than $600 in a calendar year, Rosy generates and mails your 1099-NEC by Jan 31.') },
      { q: C('faq','faq3_q','What does the vendor fee cover?'), a: C('faq','faq3_a','Stripe fees, escrow, dispute mediation, identity verification, and platform development.') },
    ]},
    { h: 'Worker disputes', items: [
      { q: 'A vendor disputed my hours — what happens?', a: 'You\'ll get a notification with the vendor\'s evidence. You have 48 hours to respond. Rosy mediates.' },
      { q: 'A worker no-showed. What can I do?', a: 'Mark them no-show on the gig page. We refund your gig fee and apply a 30-day suspension to the worker pending review.' },
    ]},
  ];
  return (
    <>
      <section style={{ padding: '72px 32px 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <span className="t-eyebrow">{C('faq','eyebrow','FAQ')}</span>
          <h1 className="display-xl" style={{ margin: '14px 0 14px' }}>{C('faq','title','Answers, before you ask.')}</h1>
          <p style={{ margin: '0 auto', fontSize: 18, color: 'var(--color-body)', maxWidth: 620 }}>{C('faq','sub','Still need help?')} <a href="#marketing/contact" className="btn-link" onClick={(e) => { e.preventDefault(); setRoute('contact'); }} style={{ cursor: 'pointer' }}>Talk to a real person.</a></p>
        </div>
      </section>
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '48px 32px 96px' }}>
        {groups.map(g => (
          <div key={g.h} style={{ marginBottom: 36 }}>
            <h3 className="display-sm" style={{ marginBottom: 16 }}>{g.h}</h3>
            <div className="col" style={{ gap: 10 }}>
              {g.items.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

/* ============ About ============ */
function MkAboutPage({ goToAuth }) {
  useSiteContentTick();
  return (
    <>
      <MkHero accent="lavender"
        eyebrow={C('about','eyebrow','About')}
        title={C('about','hero_title','Built by florists. For florists.')}
        sub={C('about','hero_sub','Rosy started as a private group text between three Chicago studios passing workers back and forth. It got out of hand. Then it got organized.')} />
      <section className="mk-section" style={{ paddingTop: 64 }}>
        <div className="grid-2" style={{ gap: 48, alignItems: 'flex-start' }}>
          <div className="col" style={{ gap: 20 }}>
            <h2 className="display-md">{C('about','why_title','Why we built this.')}</h2>
            <p style={{ fontSize: 16, color: 'var(--color-body)', lineHeight: 1.65 }}>{C('about','why_body1','Floral event work is local, seasonal, and ferociously busy. Every studio knows the same forty freelancers. Every freelancer knows the same fifteen studios. The matching happens over Sunday-night group texts, paper invoices that get lost, and Venmo requests that nobody chases.')}</p>
            <p style={{ fontSize: 16, color: 'var(--color-body)', lineHeight: 1.65 }}>{C('about','why_body2','Rosy organizes that informal economy into a real marketplace — with verified workers, escrowed payments, ratings that survive, and tax docs that actually arrive. Same community. Less chaos.')}</p>
          </div>
          <div style={{ aspectRatio: '4/5', borderRadius: 24, overflow: 'hidden' }}>
            <img src={MP_D.IMAGES.marketingAbout} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>
      {(() => {
        // Live counts. Hide the section entirely if there's nothing to brag about
        // yet — better to omit than to show fake numbers like the prior 1,284/412 demo data.
        const D = window.RosyData || {};
        const users = D.USERS || [];
        const workers = users.filter(u => u.role === 'worker').length;
        const vendors = users.filter(u => u.role === 'vendor').length;
        const gigs = (D.GIGS || []).filter(g => g.status === 'completed').length;
        const paidOut = (D.TRANSACTIONS || []).filter(t => t.status === 'Paid').reduce((s, t) => s + (t.amount || 0), 0);
        const stats = [
          [workers.toString(), 'Active workers'],
          [vendors.toString(), 'Vendor studios'],
          [gigs.toString(), 'Gigs filled'],
          [`$${paidOut.toLocaleString()}`, 'Paid out'],
        ];
        if (workers + vendors + gigs + paidOut === 0) return null;
        return (
          <section className="mk-section" style={{ paddingTop: 0 }}>
            <h2 className="display-md" style={{ marginBottom: 24 }}>By the numbers.</h2>
            <div className="grid-4">
              {stats.map(([n, l]) => (
                <div key={l} className="card" style={{ background: 'var(--color-surface-soft)' }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 44, letterSpacing: '-0.02em' }}>{n}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>{l}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
      <CTABand goToAuth={goToAuth} />
    </>
  );
}

/* ============ Careers ============ */
function MkCareersPage({ setRoute }) {
  const jobs = [
    { team: 'Engineering',  title: 'Senior Backend Engineer',     city: 'Chicago or remote',  type: 'Full-time' },
    { team: 'Engineering',  title: 'Mobile Engineer (iOS/Android)',city: 'Chicago or remote', type: 'Full-time' },
    { team: 'Design',       title: 'Product Designer, Vendor app',city: 'Chicago or remote',  type: 'Full-time' },
    { team: 'Operations',   title: 'Worker Success Lead',         city: 'Chicago',            type: 'Full-time' },
    { team: 'Marketing',    title: 'Content & Community Manager', city: 'Chicago',            type: 'Part-time' },
  ];
  return (
    <>
      <MkHero accent="peach" eyebrow="Careers" title="Help us build the rest of this." sub="Small team. Chicago HQ above a florist shop in West Loop. We move quickly, ship constantly, and care a lot about the people on both sides of the marketplace." />
      <section className="mk-section">
        <h2 className="display-md" style={{ marginBottom: 24 }}>Open roles</h2>
        <div className="table-wrap">
          <table className="rosy-table">
            <thead><tr><th>Role</th><th>Team</th><th>Location</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.title}>
                  <td style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{j.title}</td>
                  <td>{j.team}</td>
                  <td style={{ color: 'var(--color-muted)' }}>{j.city}</td>
                  <td><Badge kind="Active">{j.type}</Badge></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setRoute('contact')}>Apply</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-muted)' }}>Don't see your role? <a href="#marketing/contact" className="btn-link" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRoute('contact'); }}>Send us a note anyway.</a></p>
      </section>
    </>
  );
}

/* ============ Press ============ */
function MkPressPage({ setRoute }) {
  // Press list — empty by default until real coverage lands. Admins can wire
  // a future rr_press_articles table here. Until then we hide the section
  // rather than ship invented headlines.
  const press = [
  ];
  return (
    <>
      <MkHero accent="ochre" eyebrow="Press" title="In the news." sub="Selected coverage. For media inquiries, get in touch." />
      <section className="mk-section">
        <h2 className="display-md" style={{ marginBottom: 24 }}>Coverage</h2>
        <div className="col" style={{ gap: 0 }}>
          {press.length === 0 ? (
            <p style={{ margin: 0, padding: 24, fontSize: 14.5, color: 'var(--color-muted)' }}>No press features yet — we'll list them here as coverage publishes. <a href="#marketing/contact" style={{ color: 'var(--rosy-teal-dark)' }}>Pitch a story →</a></p>
          ) : press.map(p => (
            <div key={p.headline} style={{ padding: '20px 0', borderBottom: '1px solid var(--color-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
              <div>
                <span className="t-eyebrow">{p.source}</span>
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em', maxWidth: 720 }}>"{p.headline}"</p>
              </div>
              <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{p.date}</span>
                {p.url ? <a className="btn btn-ghost btn-sm" href={p.url} target="_blank" rel="noopener noreferrer"><MP_I.ExternalLink size={13} />Read</a> : null}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, padding: 24, background: 'var(--color-brand-mint)', borderRadius: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>Press kit</h3>
          <p style={{ margin: '6px 0 14px', fontSize: 14 }}>Logos, founder photos, fact sheet, and high-res visuals.</p>
          <button className="btn btn-primary" onClick={() => setRoute('contact')}>Request press kit</button>
        </div>
      </section>
    </>
  );
}

/* ============ Contact ============ */
function MkContactPage() {
  useSiteContentTick();
  const toast = useToast();
  const [form, setForm] = MP_us({ name: '', email: '', topic: 'sales', body: '' });
  const [sending, setSending] = MP_us(false);
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error('Send failed');
      toast.push({ kind: 'success', title: 'Message sent', body: "We'll be back to you within one business day." });
      setForm({ name: '', email: '', topic: 'sales', body: '' });
    } catch (err) {
      toast.push({ kind: 'error', title: "Couldn't send message", body: 'Please try again in a moment.' });
    } finally { setSending(false); }
  };
  return (
    <>
      <section style={{ padding: '72px 32px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <span className="t-eyebrow">{C('contact','eyebrow','Contact')}</span>
          <h1 className="display-xl" style={{ margin: '14px 0 14px' }}>{C('contact','title','Talk to us.')}</h1>
          <p style={{ margin: 0, fontSize: 18, color: 'var(--color-body)' }}>{C('contact','sub','Sales, support, press, careers — one inbox.')}</p>
        </div>
      </section>
      <section className="mk-section" style={{ paddingTop: 48 }}>
        <div className="grid-2" style={{ gap: 48 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Send a message</h3>
            <form className="col" style={{ gap: 14 }} onSubmit={submit}>
              <div className="field"><label className="field-label">Your name</label><input className="input" required autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
              <div className="field"><label className="field-label">Email</label><input className="input" required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@studio.com" /></div>
              <div className="field"><label className="field-label">Topic</label>
                <select className="select" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                  <option value="press">Press</option>
                  <option value="careers">Careers</option>
                </select>
              </div>
              <div className="field"><label className="field-label">Message</label><textarea className="textarea" required maxLength={5000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value.slice(0, 5000) })} placeholder="What can we help with?" /><p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--color-muted)' }}>{form.body.length} / 5000</p></div>
              <button className="btn btn-coral" type="submit" disabled={sending || !form.name.trim() || !form.email.trim() || !form.body.trim()}>{sending ? 'Sending…' : 'Send message'}</button>
            </form>
          </div>
          <div className="col" style={{ gap: 18 }}>
            {[
              ['Sales',   'sales@rosyrecruits.com',   'For demos, custom plans, multi-studio operators.'],
              ['Support', 'help@rosyrecruits.com',    'Account questions, gig issues, payment disputes.'],
              ['Press',   'press@rosyrecruits.com',   'Media inquiries and interview requests.'],
              ['Careers', 'jobs@rosyrecruits.com',    'Open roles and applications.'],
            ].map(([h, mail, p]) => (
              <div key={h} className="card">
                <p className="t-eyebrow" style={{ marginBottom: 6 }}>{h}</p>
                <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em' }}>{mail}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>{p}</p>
              </div>
            ))}
            <div className="card" style={{ background: 'var(--color-brand-peach)', border: 0 }}>
              <p className="t-eyebrow" style={{ marginBottom: 6 }}>Studio</p>
              <p style={{ margin: 0, fontWeight: 600 }}>Rosy Recruits, Inc.</p>
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>238 N 6th St · Chicago, IL 11211</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ============ Legal / Security / Payments / Disputes (info pages) ============ */
function MkLegalPage({ kind }) {
  const TITLES = {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    security: 'Security',
    'payments-info': 'How payments work',
    'disputes-info': 'How disputes work',
  };
  const SECTIONS = {
    terms: [
      ['1. Acceptance', 'By creating an account, you agree to these terms. Rosy Recruits, Inc. operates a neutral marketplace and is not the employer or contractor of either party.'],
      ['2. Marketplace conduct', 'Vendors agree to fund gigs at the time of posting and to approve hours in good faith. Workers agree to show up to confirmed gigs, perform the agreed work, and submit hours honestly.'],
      ['3. Payments', 'Funds are held in escrow by our payments partner (Stripe) and released to workers after vendor approval or 24-hour auto-approval. Platform fees and Stripe processing fees are deducted before payout.'],
      ['4. Disputes', 'Either party may file a dispute within 14 days of the gig date. Rosy reviews evidence from both sides and issues a decision within 48 hours.'],
      ['5. Account termination', 'We may suspend or terminate accounts for repeated no-shows, fraud, abuse, or violation of these terms. Funds owed to terminated accounts will be released within 60 days subject to dispute review.'],
      ['6. Limits of liability', 'Rosy is not liable for personal injury, property damage, or business losses that occur during a gig. Workers and vendors are responsible for their own insurance.'],
    ],
    privacy: [
      ['What we collect', 'Account info (name, email, phone), identity verification documents, profile content, gig and payment history, messages exchanged on platform, and device/usage data.'],
      ['How we use it', 'To run the marketplace: match workers to gigs, process payments, prevent fraud, mediate disputes, generate tax forms, and improve the product. We do not sell your data.'],
      ['Who sees it', 'Stripe (payments), our identity-verification partner (Persona), and select Rosy staff under NDA. Tax forms are filed with the IRS. Court-ordered disclosure as required.'],
      ['Your rights', 'Export, correct, or delete your data at any time from Settings → Account. We retain financial records for 7 years per IRS requirements.'],
    ],
    security: [
      ['Encryption', 'All traffic encrypted with TLS 1.3. Data at rest encrypted with AES-256.'],
      ['Identity verification', 'Persona-powered ID checks for all Lead and Design workers, plus all vendors. Workers must re-verify every 24 months.'],
      ['Payments', 'Card data never touches Rosy servers. All payment flows are handled by Stripe (PCI-DSS Level 1).'],
      ['Audits', 'Annual SOC 2 Type II audit (latest report available on request). Bug bounty program through HackerOne.'],
      ['Account safety', 'Two-factor authentication required for all vendors. Suspicious-login alerts on every device change.'],
    ],
    'payments-info': [
      ['Vendor flow', 'Post a gig → fund it via Stripe (card or ACH) → worker performs work → approve hours → Stripe releases funds to worker within 48 hours.'],
      ['Worker flow', 'Apply for a gig → confirm → show up and work → submit hours → vendor approves (or auto-approves after 24h) → paid via Stripe Connect direct deposit.'],
      ['Fees', 'Vendor platform fee: 4–8% depending on plan. Stripe processing: 2.9% + $0.30 per transaction. Worker take rate: 92% of gig rate.'],
      ['Payouts', 'Standard payouts: 1–2 business days after release. Pro / Enterprise: same-day payouts available.'],
      ['Taxes', 'Workers earning $600+ in a calendar year receive a 1099-NEC by Jan 31. Vendors receive an annual summary report for their accountant.'],
    ],
    'disputes-info': [
      ['Filing', 'Either party can file within 14 days of the gig. Pick a reason (hours mismatch, no-show, quality of work, conduct) and submit evidence (photos, messages, timestamps).'],
      ['Mediation', 'Rosy support reviews evidence from both sides within 48 hours. We may message either party for clarification.'],
      ['Outcomes', 'Hours adjustment, partial or full refund, full payment release, or a strike on the offending party. Repeated strikes lead to suspension.'],
      ['Escalation', 'Decisions can be appealed once. If the appeal is rejected, the decision is final.'],
    ],
  };
  return (
    <section style={{ maxWidth: 800, margin: '0 auto', padding: '72px 32px 96px' }}>
      <span className="t-eyebrow">{kind === 'terms' || kind === 'privacy' ? 'Legal' : kind === 'security' ? 'Security' : 'How it works'}</span>
      <h1 className="display-lg" style={{ margin: '14px 0 8px' }}>{TITLES[kind]}</h1>
      <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 14 }}>Last updated May 1, 2026</p>
      <div className="col" style={{ gap: 28, marginTop: 36 }}>
        {(SECTIONS[kind] || []).map(([h, p]) => (
          <div key={h}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, letterSpacing: '-0.015em' }}>{h}</h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-body)' }}>{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Reusable CTA band ============ */
function CTABand({ goToAuth, ctaLabel = 'Get started' }) {
  return (
    <section style={{ background: 'var(--color-brand-peach)', padding: '72px 32px', textAlign: 'center' }}>
      <h2 className="display-lg" style={{ maxWidth: 800, margin: '0 auto 16px' }}>Run your next event with the right team.</h2>
      <p style={{ margin: '0 auto 28px', color: 'var(--color-body)', fontSize: 17, maxWidth: 560 }}>Post your first gig in 60 seconds. Card on file required so we can fund worker payouts via Stripe Connect.</p>
      <button className="btn btn-primary btn-lg" onClick={() => goToAuth('signup')}>{ctaLabel}</button>
    </section>
  );
}

Object.assign(window, {
  MarketingShell, MarketingNav, MarketingFooter,
  MkVendorsPage, MkWorkersPage, MkGalleryPage, MkPricingPage, MkFAQPage,
  MkAboutPage, MkCareersPage, MkPressPage, MkContactPage, MkLegalPage, CTABand,
});

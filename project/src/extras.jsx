/* Extra components: SignaturePad, ImageUpload, BuildMyTeam wizard, NotificationCenter, Checkbox */

const { useRef: X_ur, useEffect: X_ue, useState: X_us } = React;
const X_I = window.Icons;
const X_D = window.RosyData;

/* ============ Signature pad ============ */
function SignaturePad({ value, onChange, height = 160 }) {
  const canvasRef = X_ur(null);
  const [hasInk, setHasInk] = X_us(false);
  const drawing = X_ur(false);
  const last = X_ur({ x: 0, y: 0 });

  X_ue(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2.2;
  }, []);

  const pos = (e) => {
    const cvs = canvasRef.current;
    const rect = cvs.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) { setHasInk(true); onChange && onChange(true); }
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    setHasInk(false);
    onChange && onChange(false);
  };

  return (
    <div style={{ background: 'var(--color-surface-soft)', borderRadius: 12, padding: 12, border: '1.5px dashed var(--color-hairline-strong)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Sign here</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!hasInk} onClick={clear} style={{ height: 28 }}><X_I.RefreshCw size={12} />Redo</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, background: '#fff', borderRadius: 8, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--color-muted-soft)', textAlign: 'center' }}>
        {hasInk ? 'Looks good. Tap Redo to sign again.' : 'Draw your signature above with mouse or finger.'}
      </p>
    </div>
  );
}

/* ============ Image upload ============ */
function ImageUpload({ value, onChange, label = 'Upload photo', size = 96, round = true }) {
  const inputRef = X_ur(null);
  const [preview, setPreview] = X_us(value || null);
  React.useEffect(() => { setPreview(value || null); }, [value]);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPreview(ev.target.result); onChange && onChange(ev.target.result); };
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: size, height: size, borderRadius: round ? 9999 : 12, background: preview ? `center/cover no-repeat url(${preview})` : 'var(--rosy-teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rosy-teal)', flex: 'none', overflow: 'hidden', border: '1px solid var(--color-hairline)' }}>
        {!preview ? <X_I.Flower size={size * 0.4} /> : null}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <button type="button" className="btn btn-ghost-amber btn-sm" onClick={() => inputRef.current && inputRef.current.click()}><X_I.UploadCloud size={14} />{preview ? 'Replace photo' : label}</button>
        {preview ? <button type="button" className="btn-link" style={{ fontSize: 12, textAlign: 'left', padding: 0 }} onClick={() => { setPreview(null); onChange && onChange(null); }}>Remove</button> : null}
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-muted-soft)' }}>JPG or PNG, up to 8MB.</p>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
      </div>
    </div>
  );
}

/* ============ Notification Center (full page) ============ */
function PageNotificationCenter({ setRoute, role }) {
  const toast = useToast();
  const [items, setItems] = X_us(X_D.NOTIFICATIONS);
  const [tab, setTab] = X_us('all');
  const filtered = items.filter(n => tab === 'all' || (tab === 'unread' && n.unread));
  const unreadCount = items.filter(n => n.unread).length;

  const open = (n) => {
    setItems(arr => arr.map(x => x.id === n.id ? { ...x, unread: false } : x));
    const target = (n.link || '').replace('#', '').split('/').pop() || 'dashboard';
    // Map old-style links to current routes
    const map = { 'e1': 'events:e1', 'admin': 'dashboard', 'vendor': 'dashboard', 'worker': 'dashboard', 'disputes': 'disputes', 'my-gigs': 'my-gigs', 'inbox': 'inbox', 'profile': 'settings', 'payments': 'payments' };
    setRoute(map[target] || target);
  };

  const markAll = () => {
    setItems(arr => arr.map(n => ({ ...n, unread: false })));
    toast.push({ kind: 'success', title: 'All notifications marked read' });
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Notifications</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="tabs">
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All ({items.length})</button>
            <button className={tab === 'unread' ? 'on' : ''} onClick={() => setTab('unread')}>Unread ({unreadCount})</button>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={!unreadCount} onClick={markAll}>Mark all read</button>
        </div>
      </div>
      <div className="card card-flush">
        {filtered.length === 0 ? <Empty icon={X_I.Bell} title="You're all caught up" body="No new notifications." /> :
         filtered.map(n => {
          const IconMap = { gig_application: X_I.CalendarCheck, gig_confirmed: X_I.CheckCircle2, gig_rejected: X_I.XCircle, payment_sent: X_I.DollarSign, payment_disputed: X_I.AlertTriangle, new_message: X_I.MessageSquare, rating_received: X_I.Star };
          const colorMap = { gig_application: 'var(--rosy-teal-dark)', gig_confirmed: 'var(--color-success)', gig_rejected: 'var(--rosy-coral)', payment_sent: 'var(--color-success)', payment_disputed: 'var(--color-warning)', new_message: 'var(--rosy-teal-dark)', rating_received: '#D97706' };
          const bgMap = { gig_application: 'var(--rosy-teal-soft)', gig_confirmed: 'var(--color-success-bg)', gig_rejected: 'var(--rosy-coral-soft)', payment_sent: 'var(--color-success-bg)', payment_disputed: 'var(--color-warning-bg)', new_message: 'var(--rosy-teal-soft)', rating_received: '#FEF3C7' };
          const I = IconMap[n.type] || X_I.Bell;
          return (
            <div key={n.id} onClick={() => open(n)}
              style={{ display: 'flex', gap: 16, padding: '18px 24px', borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer', background: n.unread ? 'var(--color-canvas)' : 'transparent', alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 9999, background: bgMap[n.type] || 'var(--color-surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorMap[n.type] || 'var(--color-ink)', flex: 'none' }}>
                <I size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{n.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>{n.body}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted-soft)' }}>{n.time}</p>
              </div>
              {n.unread ? <span style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--rosy-teal)', marginTop: 8, flex: 'none' }} /> : null}
              <X_I.ChevronRight size={16} style={{ color: 'var(--color-muted-soft)', marginTop: 12 }} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <h3 className="display-sm" style={{ marginBottom: 16, fontSize: 22 }}>Notification preferences</h3>
        <div className="card">
          <div className="col" style={{ gap: 12 }}>
            {[
              ['Gig applications & confirmations', true],
              ['New messages',                     true],
              ['Payment status changes',           true],
              ['Disputes',                         true],
              ['Ratings & reviews',                false],
              ['Weekly summary digest',            false],
            ].map(([label, on]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                <span>{label}</span>
                <span className={`toggle ${on ? 'on' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Build My Team wizard (vendor) ============ */
function BuildMyTeamWizard({ open, onClose }) {
  const toast = useToast();
  const [step, setStep] = X_us(0);
  const [config, setConfig] = X_us({
    eventName: 'Carter Garden Brunch',
    date: '2026-07-04',
    duration: 6,
    location: 'Brooklyn, NY',
    radius: 25,
    needs: { Lead: 1, Design: 2, Assist: 3, Strike: 2 },
    minRating: 4.5,
    favoriteOnly: false,
    budget: 2400,
  });
  const [picked, setPicked] = X_us([]);

  X_ue(() => { if (open) { setStep(0); setPicked([]); } }, [open]);

  const update = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const updateNeed = (t, delta) => setConfig(c => ({ ...c, needs: { ...c.needs, [t]: Math.max(0, c.needs[t] + delta) } }));

  // Generate team: pick top workers per role from seed data
  const generateTeam = () => {
    const workers = X_D.USERS.filter(u => u.role === 'worker' && u.status === 'active' && (u.rating || 0) >= config.minRating);
    const sorted = [...workers].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const team = [];
    Object.entries(config.needs).forEach(([type, count]) => {
      let pool = sorted;
      // Naive specialty mapping by name for variety
      if (type === 'Lead')   pool = sorted.filter(u => (u.gigs || 0) >= 30);
      if (type === 'Design') pool = sorted.filter(u => (u.gigs || 0) >= 15);
      if (type === 'Strike') pool = sorted.filter(u => (u.gigs || 0) >= 5);
      const used = new Set(team.map(t => t.user.id));
      const slot = pool.filter(u => !used.has(u.id)).slice(0, count);
      slot.forEach(u => team.push({ user: u, role: type, rate: X_D.GIG_TYPES[type].hourly }));
    });
    return team;
  };

  const totalBudget = picked.reduce((s, m) => s + m.rate * config.duration, 0);

  const next = () => {
    if (step === 2) {
      setPicked(generateTeam());
    }
    setStep(s => s + 1);
  };

  return (
    <Modal open={open} onClose={onClose} title="Build my team" size="lg"
      footer={
        step < 3 ? (
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>Back</button> : null}
            <button className="btn btn-coral" onClick={next}>{step === 2 ? 'Auto-pick team' : 'Continue'}</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Tweak preferences</button>
            <button className="btn btn-ghost-coral" onClick={() => setPicked(generateTeam())}><X_I.RefreshCw size={14} />Re-roll</button>
            <button className="btn btn-coral" onClick={() => { onClose(); toast.push({ kind: 'success', title: 'Team confirmed', body: `${picked.length} workers invited to ${config.eventName}.` }); }}>Send invites</button>
          </>
        )
      }>
      <Stepper step={step} steps={['Event','Roles','Filters','Review']} />

      {step === 0 ? (
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Event name</label><input className="input" value={config.eventName} onChange={e => update('eventName', e.target.value)} /></div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Date</label><input className="input" type="date" value={config.date} onChange={e => update('date', e.target.value)} /></div>
            <div className="field"><label className="field-label">Duration (hours)</label><input className="input" type="number" value={config.duration} onChange={e => update('duration', +e.target.value)} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Location</label><input className="input" value={config.location} onChange={e => update('location', e.target.value)} /></div>
            <div className="field"><label className="field-label">Search radius (mi)</label><input className="input" type="number" value={config.radius} onChange={e => update('radius', +e.target.value)} /></div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="col" style={{ gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>How many of each role do you need?</p>
          {Object.keys(config.needs).map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--color-surface-soft)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <GigChip type={t} />
                <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>${X_D.GIG_TYPES[t].hourly}/hr avg · {X_D.GIG_TYPES[t].blurb}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="row-action-btn" onClick={() => updateNeed(t, -1)}>–</button>
                <span style={{ width: 28, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>{config.needs[t]}</span>
                <button className="row-action-btn" onClick={() => updateNeed(t, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Minimum rating (★ {config.minRating.toFixed(1)})</label>
            <input type="range" min="3.5" max="5" step="0.1" value={config.minRating} onChange={e => update('minRating', +e.target.value)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-muted)' }}><span>3.5★</span><span>5★</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><p style={{ margin: 0, fontWeight: 500 }}>Only suggest from my favorites</p><p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>Workers you've previously rated 5★.</p></div>
            <span className={`toggle ${config.favoriteOnly ? 'on' : ''}`} onClick={() => update('favoriteOnly', !config.favoriteOnly)} />
          </div>
          <div className="field"><label className="field-label">Budget cap (optional)</label><input className="input" type="number" value={config.budget} onChange={e => update('budget', +e.target.value)} /></div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Auto-picked team for {config.eventName}</p>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em' }}>{picked.length} workers</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Estimated cost ({config.duration}h)</p>
              <p className="t-mono" style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: totalBudget > config.budget ? 'var(--rosy-coral)' : 'var(--color-ink)' }}>{fmtMoney(totalBudget)}</p>
              {totalBudget > config.budget ? <p style={{ margin: 0, fontSize: 11.5, color: 'var(--rosy-coral)' }}>Over budget by {fmtMoney(totalBudget - config.budget)}</p> : null}
            </div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {picked.length === 0 ? <Empty icon={X_I.Users} title="No matching workers" body="Lower the minimum rating or expand the search radius." /> :
             picked.map(m => (
              <div key={m.user.id + m.role} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--color-surface-soft)', borderRadius: 12 }}>
                <Avatar name={m.user.name} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.user.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{m.user.city} · {m.user.gigs} gigs · ★ {m.user.rating}</p>
                </div>
                <GigChip type={m.role} />
                <span className="t-mono-amount">${m.rate}/hr</span>
                <button className="row-action-btn danger" onClick={() => setPicked(p => p.filter(x => !(x.user.id === m.user.id && x.role === m.role)))}><X_I.X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Stepper({ step, steps }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: 9999, background: i <= step ? 'var(--rosy-coral)' : 'var(--color-surface-card)', color: i <= step ? '#fff' : 'var(--color-muted)', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: i === step ? 'var(--color-ink)' : i < step ? 'var(--color-body)' : 'var(--color-muted)' }}>{label}</span>
          </div>
          {i < steps.length - 1 ? <span style={{ flex: 1, height: 1, background: i < step ? 'var(--rosy-coral)' : 'var(--color-hairline)' }} /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ============ Reusable Checkbox component (for tables) ============ */
function CheckBox({ checked, onChange, onClick }) {
  return (
    <span className={`checkbox ${checked ? 'checked' : ''}`}
      onClick={(e) => { e.stopPropagation(); if (onChange) onChange(!checked); if (onClick) onClick(e); }}
      role="checkbox" aria-checked={checked} tabIndex={0} />
  );
}

/* ============ Build my team — page wrapper that opens the wizard ============ */
function PageBuildTeam({ currentUser }) {
  const [open, setOpen] = X_us(false);
  const [demoOpen, setDemoOpen] = X_us(false);
  const toast = useToast();
  const recent = [
    { event: 'Wheeler Wedding', date: '2026-06-23', team: 7, status: 'Confirmed', cost: 4900 },
    { event: 'Atelier Press Preview', date: '2026-05-28', team: 3, status: 'Partial', cost: 1240 },
    { event: 'Wave Hill Garden Brunch', date: '2026-05-18', team: 3, status: 'Completed', cost: 588 },
  ];
  return (
    <div className="content fade-up">
      <div className="card" style={{ background: 'var(--color-brand-mint)', border: 0, borderRadius: 24, padding: 36, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <span className="t-eyebrow" style={{ color: 'var(--color-ink)' }}>New</span>
            <h1 className="display-md" style={{ margin: '10px 0 12px' }}>Build my team in 60 seconds.</h1>
            <p style={{ margin: '0 0 20px', fontSize: 16, maxWidth: 560 }}>Tell us about the event. We'll auto-pick a vetted team from your favorites and top-rated workers nearby — ready to invite with one click.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-lg" onClick={() => setOpen(true)}><X_I.Sparkles size={16} />Build my team</button>
              <button className="btn btn-ghost btn-lg" onClick={() => setDemoOpen(true)}>Watch demo</button>
            </div>
          </div>
          <div style={{ width: 220, flex: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['u3','u9','u10','u7'].map(id => {
                const u = X_D.USERS.find(x => x.id === id);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.7)', padding: '8px 12px', borderRadius: 12 }}>
                    <Avatar name={u.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{u.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>★ {u.rating} · {u.gigs} gigs</p>
                    </div>
                    <X_I.CheckCircle2 size={14} style={{ color: 'var(--rosy-teal-dark)' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { icon: X_I.Sparkles, h: '1. Tell us about your event', p: 'Date, hours, location, and which roles you need.' },
          { icon: X_I.UsersRound, h: '2. We auto-pick the team', p: 'Top-rated workers near you who fit your event profile.' },
          { icon: X_I.CheckCircle2, h: '3. Confirm and invite', p: 'One click sends all the invites. Track replies in Notifications.' },
        ].map(s => (
          <div key={s.h} className="card">
            <s.icon size={22} style={{ color: 'var(--rosy-coral)' }} />
            <h3 style={{ margin: '10px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20 }}>{s.h}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>{s.p}</p>
          </div>
        ))}
      </div>

      <div className="section-heading"><h2>Recent auto-builds</h2></div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr><th>Event</th><th>Date</th><th>Team size</th><th>Status</th><th>Cost</th><th></th></tr></thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.event}>
                <td style={{ fontWeight: 600 }}>{r.event}</td>
                <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{fmtDate(r.date, 'mdy-dots')}</td>
                <td>{r.team} workers</td>
                <td><Badge kind={r.status === 'Confirmed' ? 'Confirmed' : r.status === 'Partial' ? 'Pending' : 'Completed'}>{r.status}</Badge></td>
                <td className="t-mono-amount">{fmtMoney(r.cost)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Re-run</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BuildMyTeamWizard open={open} onClose={() => setOpen(false)} />

      {demoOpen ? (
        <Modal open={demoOpen} onClose={() => setDemoOpen(false)} title="Product demo" size="lg"
          footer={<><button className="btn btn-ghost" onClick={() => setDemoOpen(false)}>Close</button><button className="btn btn-coral" onClick={() => { setDemoOpen(false); toast.push({ kind: 'success', title: "We'll email you the link" }); }}>Email me</button></>}>
          <div style={{ aspectRatio: '16/9', background: 'var(--color-surface-card)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: 9999, background: 'var(--rosy-coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: '28px solid #fff', marginLeft: 6 }} />
            </div>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--color-muted)' }}>90-second walkthrough lands in your inbox</p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

Object.assign(window, { SignaturePad, ImageUpload, PageNotificationCenter, BuildMyTeamWizard, CheckBox, Stepper, PageBuildTeam });

/* ============ Walkthrough / product tour ============ */
const TOUR_SLIDES = {
  admin: [
    { tone: 'coral',    icon: 'Sparkles',    h: "You're the conductor.",        p: "Rosy gives you full visibility into every event, gig, vendor, and worker. Here's a quick tour of what's at your fingertips.", art: 'admin-1' },
    { tone: 'mint',     icon: 'Users',       h: 'Users — your whole community.', p: 'Approve new signups, suspend bad actors, invite people, and dig into any profile in one click.', art: 'admin-2', nav: 'users' },
    { tone: 'peach',    icon: 'Calendar',    h: 'Events & gigs at a glance.',    p: 'Every event across every vendor in one table. Need to backfill a worker? Hit Build my team and we auto-pick the best available crew.', art: 'admin-3', nav: 'events' },
    { tone: 'lavender', icon: 'AlertTriangle', h: 'Mediate disputes in minutes.', p: 'Both sides upload evidence. You decide: release, refund, split, or escalate. Resolution within 48 hours.', art: 'admin-4', nav: 'disputes' },
    { tone: 'ochre',    icon: 'Send',        h: 'Broadcast to everyone, instantly.', p: 'Push announcements to all users, just vendors, just workers, or just admins — across in-app, email, push, and SMS. Schedule for later if you want.', art: 'admin-5', nav: 'broadcast' },
    { tone: 'mint',     icon: 'ShieldCheck', h: 'Bring on Admin Assistants.',     p: 'Invite teammates, pick a role preset, and toggle exactly which permissions they get. Owners keep the keys.', art: 'admin-6', nav: 'admin-team' },
  ],
  vendor: [
    { tone: 'coral',    icon: 'Sparkles',    h: 'Your studio, organized.',       p: 'Rosy turns the Sunday-night spreadsheet into a few clicks. Here\'s the lay of the land.', art: 'vendor-1' },
    { tone: 'peach',    icon: 'Calendar',    h: 'All your events in one view.',  p: 'Status, fill rate, venue, and gig progress for every booking. Click any row to dive in.', art: 'vendor-2', nav: 'events' },
    { tone: 'lavender', icon: 'Sparkles',    h: 'Build my team — auto-pick a crew.', p: 'Tell us about the event. We\'ll pull top-rated workers nearby who match your roles and budget. Send the whole team in one click.', art: 'vendor-3', nav: 'build-team' },
    { tone: 'mint',     icon: 'Briefcase',   h: 'Post a gig in 60 seconds.',     p: 'Date, time, rate, spots. Workers see it within minutes. Most posts fill the same day.', art: 'vendor-4', nav: 'gigs' },
    { tone: 'ochre',    icon: 'CreditCard',  h: 'Stripe handles the money.',     p: 'Fund the gig at booking. Approve hours. Stripe Connect releases worker pay within 48 hours. No 1099s, no chasing.', art: 'vendor-5', nav: 'payments' },
    { tone: 'mint',     icon: 'MessageSquare', h: 'Talk to your crew right here.', p: 'Inbox keeps every conversation tied to its gig and event. No more lost texts.', art: 'vendor-6', nav: 'inbox' },
  ],
  worker: [
    { tone: 'coral',    icon: 'Sparkles',    h: 'Welcome to steady work.',       p: 'Pick gigs you want. Show up. Get paid. Here\'s how it works.', art: 'worker-1' },
    { tone: 'peach',    icon: 'ClipboardList', h: 'Browse gig posts.',           p: 'Vendors post in your feed by type, date, and location. Apply with one click — withdraw any time before confirmation.', art: 'worker-2', nav: 'gig-posts' },
    { tone: 'lavender', icon: 'CheckSquare', h: 'My Gigs — your bookings.',      p: 'Confirmed gigs live here. Get directions, see your call time, message the lead.', art: 'worker-3', nav: 'my-gigs' },
    { tone: 'mint',     icon: 'CheckCircle2', h: 'Mark complete after the event.', p: 'Submit your hours when you wrap. The vendor has 24 hours to approve — otherwise we auto-approve.', art: 'worker-4', nav: 'my-gigs' },
    { tone: 'ochre',    icon: 'DollarSign',  h: 'Paid in 48 hours, every time.', p: 'Stripe Connect deposits straight to your bank. 92% of the gig rate is yours.', art: 'worker-5', nav: 'payments' },
    { tone: 'mint',     icon: 'Star',        h: 'Ratings shape your future.',    p: 'Vendors rate you after every gig. High ratings push you to the top of feeds. Repeat work is the goal.', art: 'worker-6' },
  ],
};

function Walkthrough({ role, onClose, setRoute }) {
  const [idx, setIdx] = X_us(0);
  const slides = TOUR_SLIDES[role] || TOUR_SLIDES.admin;
  const slide = slides[idx];
  const Icon = X_I[slide.icon] || X_I.Sparkles;
  const tones = { coral: 'var(--rosy-coral)', mint: 'var(--color-brand-mint)', peach: 'var(--color-brand-peach)', lavender: 'var(--color-brand-lavender)', ochre: 'var(--color-brand-ochre)' };
  return (
    <div className="modal-backdrop" style={{ background: 'rgba(10, 10, 10, 0.55)' }}>
      <div className="modal lg" style={{ maxWidth: 720, overflow: 'hidden' }}>
        <div style={{ height: 240, background: tones[slide.tone] || tones.coral, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 110, height: 110, borderRadius: 9999, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={56} style={{ color: 'var(--color-ink)' }} />
          </div>
          <button onClick={onClose} className="icon-btn" style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.85)', border: 0 }}><X_I.X size={16} /></button>
          <span style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.85)', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600 }}>{idx + 1} of {slides.length}</span>
        </div>
        <div style={{ padding: 36, textAlign: 'center' }}>
          <h2 className="display-md" style={{ marginBottom: 12 }}>{slide.h}</h2>
          <p style={{ margin: '0 auto', fontSize: 16, color: 'var(--color-body)', lineHeight: 1.6, maxWidth: 480 }}>{slide.p}</p>
          {slide.nav ? (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={() => { setRoute && setRoute(slide.nav); onClose(); }}>Show me <X_I.ArrowRight size={13} /></button>
          ) : null}
        </div>
        <div style={{ padding: '16px 36px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, borderTop: '1px solid var(--color-hairline)' }}>
          <button className="btn btn-link" onClick={onClose}>Skip tour</button>
          <div style={{ display: 'flex', gap: 6 }}>
            {slides.map((_, i) => (
              <span key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 9999, background: i === idx ? 'var(--rosy-coral)' : i < idx ? 'var(--color-muted-soft)' : 'var(--color-hairline-strong)', transition: 'all 200ms ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 ? <button className="btn btn-ghost btn-sm" onClick={() => setIdx(i => i - 1)}>Back</button> : null}
            {idx < slides.length - 1 ?
              <button className="btn btn-coral btn-sm" onClick={() => setIdx(i => i + 1)}>Next</button>
              : <button className="btn btn-coral btn-sm" onClick={onClose}>Start using Rosy</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Walkthrough, TOUR_SLIDES });

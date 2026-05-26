/* Extra components: SignaturePad, ImageUpload, BuildMyTeam wizard, NotificationCenter, Checkbox */

/* Demo / Test mode banner — fixed bottom strip on every screen, dismissible per session.
   Tells the client (and Tonya / Mariana) that this build is a staging environment so any
   data they enter is safe to throw away + outgoing emails route to ben@pronocoders.com. */
function DemoModeBanner() {
  const [dismissed, setDismissed] = React.useState(() => {
    try { return sessionStorage.getItem('rosy.demoBanner.dismissed') === '1'; } catch (e) { return false; }
  });
  if (dismissed) return null;
  const dismiss = () => {
    try { sessionStorage.setItem('rosy.demoBanner.dismissed', '1'); } catch (e) {}
    setDismissed(true);
  };
  return (
    <div role="status" aria-label="Demo mode" style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 9000,
      maxWidth: 340, display: 'flex', alignItems: 'flex-start', gap: 10,
      background: '#FFF4D6', border: '1px solid #E0C97A', borderRadius: 12,
      padding: '10px 14px 10px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
      fontFamily: '-apple-system, Segoe UI, Helvetica, Arial, sans-serif',
    }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 9999, background: '#E0C97A', color: '#7A5800', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>!</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#7A5800' }}>Demo / staging environment</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.4, color: '#7A5800' }}>Test data only. Outgoing emails route to the staging inbox.</p>
      </div>
      <button onClick={dismiss} aria-label="Dismiss demo banner" style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 2, color: '#7A5800', flex: 'none' }}>
        <X_I.X size={14} />
      </button>
    </div>
  );
}
Object.assign(window, { DemoModeBanner });


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
    if (!hasInk) { setHasInk(true); }
  };
  const end = async () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Emit the local data URL immediately so the parent UI reacts. Then upload
    // to Supabase Storage in the background and swap the value to the public
    // URL when the upload finishes. Avoids storing multi-KB base64 blobs in
    // rr_profiles signature columns.
    let dataUrl = null;
    try { dataUrl = canvasRef.current.toDataURL('image/png'); } catch (e) { return; }
    onChange && onChange(dataUrl);
    try {
      const sb = window.sb;
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      const uid = user?.id || 'anon';
      // Convert data URL → Blob → Storage upload.
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${uid}/${Date.now()}.png`;
      const { error } = await sb.storage.from('rr-signatures').upload(path, blob, { cacheControl: '3600', upsert: true, contentType: 'image/png' });
      if (error) throw error;
      // Signed URL since the bucket is private. 7-day expiry — long enough for
      // the admin to view from the user-detail modal without re-signing.
      const { data: signed, error: sErr } = await sb.storage.from('rr-signatures').createSignedUrl(path, 60 * 60 * 24 * 7);
      if (sErr) throw sErr;
      onChange && onChange(signed?.signedUrl || dataUrl);
    } catch (e) { console.warn('Signature upload failed (kept local data URL):', e.message); }
  };

  const clear = () => {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    setHasInk(false);
    onChange && onChange(null);
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
function ImageUpload({ value, onChange, label = 'Upload photo', size = 96, round = true, bucket = 'rr-avatars' }) {
  const inputRef = X_ur(null);
  const [preview, setPreview] = X_us(value || null);
  const [uploading, setUploading] = X_us(false);
  React.useEffect(() => { setPreview(value || null); }, [value]);
  const toast = useToast();
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.push({ kind: 'warning', title: 'Image too large', body: `${(f.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB limit.` });
      e.target.value = ''; return;
    }
    // Optimistic preview from local FileReader.
    const localUrl = await new Promise((res) => { const r = new FileReader(); r.onload = (ev) => res(ev.target.result); r.readAsDataURL(f); });
    setPreview(localUrl);
    // Upload to Supabase Storage. Fall back to the data URL on failure so the
    // user still sees the photo even if Storage is unreachable.
    setUploading(true);
    try {
      const sb = window.sb;
      if (!sb) throw new Error('Supabase not loaded');
      const { data: { user } } = await sb.auth.getUser();
      const uid = user?.id || 'anon';
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${uid}/${Date.now()}.${ext || 'jpg'}`;
      const { error } = await sb.storage.from(bucket).upload(path, f, { cacheControl: '3600', upsert: true, contentType: f.type || 'image/jpeg' });
      if (error) throw error;
      const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
      const url = pub?.publicUrl || localUrl;
      setPreview(url);
      onChange && onChange(url);
    } catch (err) {
      console.warn('Storage upload failed, falling back to data URL:', err.message);
      onChange && onChange(localUrl);
      toast.push({ kind: 'warning', title: "Uploaded locally", body: "Couldn't save to cloud storage — image will still appear." });
    }
    setUploading(false);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: size, height: size, borderRadius: round ? 9999 : 12, background: preview ? `center/cover no-repeat url(${preview})` : 'var(--rosy-teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rosy-teal)', flex: 'none', overflow: 'hidden', border: '1px solid var(--color-hairline)', position: 'relative' }}>
        {!preview ? <X_I.Flower size={size * 0.4} /> : null}
        {uploading ? <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--color-body)', fontWeight: 600 }}>Uploading…</span> : null}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <button type="button" className="btn btn-ghost-amber btn-sm" disabled={uploading} onClick={() => inputRef.current && inputRef.current.click()}><X_I.UploadCloud size={14} />{uploading ? 'Uploading…' : (preview ? 'Replace photo' : label)}</button>
        {preview && !uploading ? <button type="button" className="btn-link" style={{ fontSize: 12, textAlign: 'left', padding: 0 }} onClick={() => { setPreview(null); onChange && onChange(null); }}>Remove</button> : null}
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-muted-soft)' }}>JPG or PNG, up to 5MB.</p>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
      </div>
    </div>
  );
}

/* ============ Notification helpers ============ */
// Canonical unread filter — shared by the header bell (components.jsx)
// and the Notifications page below. Must stay in lockstep.
window.ROSY_NOTIF_PREF_DEFAULTS = {
  gig_application: true, gig_confirmed: true, gig_rejected: true,
  payment_sent: true, payment_disputed: true, dispute_filed: true,
  new_message: true, rating_received: false,
  welcome: true, dev_issue: true, weekly_digest: false,
  gig_24h_reminder: true,
};
window.rosyNotifPrefs = function rosyNotifPrefs() {
  try { return { ...window.ROSY_NOTIF_PREF_DEFAULTS, ...(JSON.parse(localStorage.getItem('rosy.notif.prefs') || '{}')) }; }
  catch (e) { return window.ROSY_NOTIF_PREF_DEFAULTS; }
};
window.rosyNotifsForUser = function rosyNotifsForUser(arr, currentUser) {
  const meId = currentUser?.id;
  const prefs = window.rosyNotifPrefs();
  return (arr || []).filter(n => {
    if (prefs[n.type] === false) return false;
    if (!meId) return false;
    const owner = n.user_id || n._userId;
    return !owner || owner === meId;
  });
};
window.rosyUnreadForUser = function rosyUnreadForUser(arr, currentUser) {
  return window.rosyNotifsForUser(arr, currentUser)
    .filter(n => n.unread || n.read === false).length;
};

/* ============ Notification Center (full page) ============ */
function PageNotificationCenter({ setRoute, role, currentUser }) {
  const toast = useToast();
  // Scope to the signed-in user's notifications (shared filter — keeps page in sync with header bell).
  const meId = currentUser?.id;
  const scopeFn = (arr) => window.rosyNotifsForUser(arr, currentUser);
  const [items, setItems] = X_us(scopeFn(X_D.NOTIFICATIONS || []));
  X_ue(() => {
    const sync = () => setItems(scopeFn([...(X_D.NOTIFICATIONS || [])]));
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, [meId]);
  // Locally archived ids — hidden from the list. Persisted to localStorage per
  // user so refreshes don't undo the archive. (Server-side `archived_at` could
  // come later; for now this is a UI-only soft-hide.)
  const archiveKey = meId ? `rosy.notif.archived.${meId}` : null;
  const [archived, setArchived] = X_us(() => {
    if (!archiveKey) return {};
    try { return JSON.parse(localStorage.getItem(archiveKey) || '{}'); } catch (e) { return {}; }
  });
  X_ue(() => { if (archiveKey) try { localStorage.setItem(archiveKey, JSON.stringify(archived)); } catch (e) {} }, [archived, archiveKey]);
  const archive = (id) => {
    setArchived(a => ({ ...a, [id]: true }));
    // Sidebar bell + count read the same localStorage key — nudge them.
    window.dispatchEvent(new CustomEvent('rosy:data-changed'));
  };
  // Auto-mark all unread as read once the user lands here. Sidebar badge is
  // driven by unread count, so without this the badge stays at N forever
  // because viewing the page doesn't write read=true to the DB.
  X_ue(() => {
    if (!meId) return;
    if (window.RosyMutate?.notifications?.markAllRead) {
      window.RosyMutate.notifications.markAllRead(meId).catch(() => {});
    }
  }, [meId]);
  const [tab, setTab] = X_us('all');
  const [search, setSearch] = X_us('');
  const [typeFilter, setTypeFilter] = X_us('all');
  // Single source of truth: rr_profiles.email_notifications, edited in Settings → Notifications.
  // We just read it here. Types stored false are hidden from this page too.
  const prefs = (() => {
    const stored = currentUser?.emailNotifications || currentUser?.email_notifications || {};
    return {
      gig_application:  stored.gig_application  !== false,
      gig_confirmed:    stored.gig_confirmed    !== false,
      gig_rejected:     stored.gig_rejected     !== false,
      new_message:      stored.new_message      !== false,
      payment_sent:     stored.payment_sent     !== false,
      payment_disputed: stored.payment_disputed !== false,
      rating_received:  stored.rating_received  === true,
      weekly_digest:    stored.weekly_digest    === true,
      welcome:          true,  // always shown — these are intro nudges
      dev_issue:        true,
    };
  })();

  const typeOptions = [
    ['all',              'All types'],
    ['gig_application',  'Applications'],
    ['gig_confirmed',    'Confirmations'],
    ['gig_rejected',     'Rejections'],
    ['payment_sent',     'Payments'],
    ['payment_disputed', 'Disputes'],
    ['new_message',      'Messages'],
    ['rating_received',  'Ratings'],
    ['welcome',          'Welcome'],
    ['dev_issue',        'Dev issues'],
  ];

  const filtered = items.filter(n => {
    if (archived[n.id]) return false;
    if (prefs[n.type] === false) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (tab === 'unread' && !n.unread) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (![n.title, n.body, n.type].some(s => (s || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
  // Visible set = everything not archived AND not muted by the user's prefs.
  // Use this for both tab counts so "All (N)" matches what actually renders.
  const visible = items.filter(n => !archived[n.id] && prefs[n.type] !== false);
  const visibleCount = visible.length;
  const unreadCount = visible.filter(n => n.unread).length;

  const open = (n) => {
    setItems(arr => arr.map(x => x.id === n.id ? { ...x, unread: false } : x));
    if (window.RosyMutate?.notifications) window.RosyMutate.notifications.markRead(n.id).catch(() => {});
    // Special-case: welcome notif kicks off the product tour rather than navigating
    if (n.type === 'welcome' || n.link === '#tour') {
      window.dispatchEvent(new CustomEvent('rosy:start-tour'));
      return;
    }
    // Parse routes shaped like #events/<id>, #app/events/<id>, #payments/<id>,
    // #my-gigs, etc. Falls back to dashboard for unknown shapes.
    const linkRaw = (n.link || '').replace(/^#/, '');
    const stripped = linkRaw.replace(/^app\//, '');
    const slashIdx = stripped.indexOf('/');
    const head = slashIdx >= 0 ? stripped.slice(0, slashIdx) : stripped;
    const tail = slashIdx >= 0 ? stripped.slice(slashIdx + 1) : '';
    if (head === 'events' && tail) return setRoute('events:' + tail);
    if (head === 'gigs' && tail)   return setRoute('gigs:' + tail);
    if (head === 'payments' && tail) return setRoute('payments:' + tail);
    const map = { 'admin': 'dashboard', 'vendor': 'dashboard', 'worker': 'dashboard', 'disputes': 'disputes', 'my-gigs': 'my-gigs', 'inbox': 'inbox', 'profile': 'settings', 'payments': 'payments', 'events': 'events', 'gigs': 'gigs', 'dashboard': 'dashboard', 'notifications': 'notifications' };
    setRoute(map[head] || 'dashboard');
  };

  const markAll = () => {
    setItems(arr => arr.map(n => ({ ...n, unread: false })));
    if (window.RosyMutate?.notifications) window.RosyMutate.notifications.markAllRead().catch(() => {});
    toast.push({ kind: 'success', title: 'All notifications marked read' });
  };

  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Notifications</h2></div>
      <div className="card notif-filter-row" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
          <X_I.Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input className="input" placeholder="Search notifications…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 38, width: '100%' }} />
        </div>
        <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ height: 38, flex: '0 0 180px', width: 180 }}>
          {typeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <div className="tabs" style={{ flex: '0 0 auto' }}>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All ({visibleCount})</button>
          <button className={tab === 'unread' ? 'on' : ''} onClick={() => setTab('unread')}>Unread ({unreadCount})</button>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ flex: '0 0 auto' }} disabled={!unreadCount} onClick={markAll}>Mark all read</button>
      </div>
      <div className="card card-flush">
        {filtered.length === 0 ? <Empty icon={X_I.Bell} title="You're all caught up" body="No new notifications." /> :
         filtered.map(n => {
          const IconMap = { gig_application: X_I.CalendarCheck, gig_confirmed: X_I.CheckCircle2, gig_rejected: X_I.XCircle, payment_sent: X_I.DollarSign, payment_disputed: X_I.AlertTriangle, new_message: X_I.MessageSquare, rating_received: X_I.Star };
          const colorMap = { gig_application: 'var(--rosy-teal-dark)', gig_confirmed: 'var(--color-success)', gig_rejected: 'var(--rosy-coral)', payment_sent: 'var(--color-success)', payment_disputed: 'var(--color-warning)', new_message: 'var(--rosy-teal-dark)', rating_received: '#D97706' };
          const bgMap = { gig_application: 'var(--rosy-teal-soft)', gig_confirmed: 'var(--color-success-bg)', gig_rejected: 'var(--rosy-coral-soft)', payment_sent: 'var(--color-success-bg)', payment_disputed: 'var(--color-warning-bg)', new_message: 'var(--rosy-teal-soft)', rating_received: '#FEF3C7' };
          const I = IconMap[n.type] || X_I.Bell;
          return (
            <div key={n.id}
              style={{ display: 'flex', gap: 16, padding: '18px 24px', borderBottom: '1px solid var(--color-hairline)', background: n.unread ? 'var(--color-canvas)' : 'transparent', alignItems: 'flex-start' }}>
              <div onClick={() => open(n)} style={{ width: 44, height: 44, borderRadius: 9999, background: bgMap[n.type] || 'var(--color-surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorMap[n.type] || 'var(--color-ink)', flex: 'none', cursor: 'pointer' }}>
                <I size={20} />
              </div>
              <div onClick={() => open(n)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{n.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>{n.body}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted-soft)' }}>{n.time}</p>
              </div>
              {n.unread ? <span style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--rosy-teal)', marginTop: 8, flex: 'none' }} /> : null}
              <button type="button" className="row-action-btn" aria-label="Archive notification" title="Archive"
                onClick={(e) => { e.stopPropagation(); archive(n.id); toast.push({ kind: 'success', title: 'Notification archived' }); }}
                style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: 'var(--color-muted)', marginTop: 8 }}>
                <X_I.Archive size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {/* Preferences section moved to Settings → Notifications (single source of truth). */}
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
    location: 'Chicago, IL',
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
    // Sort by rating desc, with random tiebreak so re-roll produces different teams when ratings tie
    const sorted = [...workers].sort((a, b) => {
      const dr = (b.rating || 0) - (a.rating || 0);
      return dr !== 0 ? dr : Math.random() - 0.5;
    });
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
            <div className="field"><label className="field-label">Date</label><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={config.date} onChange={e => update('date', e.target.value)} /></div>
            <div className="field"><label className="field-label">Duration (hours)</label><input className="input" type="number" min={1} value={config.duration} onChange={e => update('duration', Math.max(1, parseInt(e.target.value) || 1))} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Location</label><input className="input" value={config.location} onChange={e => update('location', e.target.value)} /></div>
            <div className="field"><label className="field-label">Search radius (mi)</label><input className="input" type="number" min={1} value={config.radius} onChange={e => update('radius', Math.max(1, parseInt(e.target.value) || 1))} /></div>
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
          <div className="field"><label className="field-label">Budget cap (optional)</label><input className="input" type="number" min={0} value={config.budget} onChange={e => update('budget', +e.target.value)} /></div>
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
  // Real recent events for this vendor (or all if admin) from rr_events.
  const buildRecent = () => {
    const events = window.RosyData?.EVENTS || [];
    const gigs   = window.RosyData?.GIGS || [];
    const mine   = currentUser?.role === 'admin' ? events : events.filter(e => e.vendorId === currentUser?.id);
    return mine.slice(0, 5).map(e => ({
      event: e.name || 'Untitled event',
      date: e.date || '',
      team: gigs.filter(g => g.eventId === e.id).length,
      status: e.status === 'confirmed' ? 'Confirmed' : e.status === 'completed' ? 'Completed' : 'Partial',
      cost: gigs.filter(g => g.eventId === e.id).reduce((s, g) => s + (g.rate || 0) * (g.hours || 4), 0) || 0,
    }));
  };
  const [recent, setRecent] = X_us(buildRecent());
  X_ue(() => {
    const sync = () => setRecent(buildRecent());
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, [currentUser?.id]);
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
            </div>
          </div>
          <div style={{ width: 220, flex: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                // Top 4 real workers by rating, then by gig count. No hardcoded IDs.
                const workers = (window.RosyData?.USERS || []).filter(u => u.role === 'worker' && u.status !== 'inactive');
                const picks = workers.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.gigs || 0) - (a.gigs || 0)).slice(0, 4);
                return picks;
              })().map((u, i) => {
                if (!u) return null;
                return (
                  <div key={u.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.7)', padding: '8px 12px', borderRadius: 12 }}>
                    <Avatar name={u.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{u.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-muted)' }}>★ {u.rating || '—'} · {u.gigs || 0} gigs</p>
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
            {recent.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--color-muted)', fontSize: 13.5 }}>No recent builds yet. Tap <strong>Build my team</strong> above to create your first.</td></tr>
            ) : recent.map((r, i) => (
              <tr key={r.event + i}>
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
          footer={<><button className="btn btn-ghost" onClick={() => setDemoOpen(false)}>Close</button><button className="btn btn-coral" onClick={async () => {
            setDemoOpen(false);
            try {
              await window.RosySendEmail?.({
                slug: 'trust-report',
                to: 'product@rosyrecruits.com',
                subject: 'Notify-me request: Build my team demo',
                html: `<p><strong>${currentUser?.name || currentUser?.email || 'Unknown user'}</strong> (${currentUser?.email || 'no email'}) requested the Build-my-team demo video.</p>`,
                vars: {},
              });
              toast.push({ kind: 'success', title: "We'll email you the demo link" });
            } catch (e) { toast.push({ kind: 'warning', title: "Couldn't sign you up", body: 'Try again in a moment.' }); }
          }}>Email me</button></>}>
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
    { tone: 'ochre',    icon: 'CreditCard',  h: 'Stripe handles the money.',     p: 'Approve hours. Stripe Connect releases worker pay within 48 hours. No 1099s, no chasing.', art: 'vendor-5', nav: 'payments' },
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
    <div className="modal-backdrop" onClick={onClose} style={{ background: 'rgba(10, 10, 10, 0.55)' }}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, overflow: 'hidden' }}>
        <div style={{ height: 240, background: tones[slide.tone] || tones.coral, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 110, height: 110, borderRadius: 9999, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={56} style={{ color: 'var(--color-ink)' }} />
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close tour" style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.85)', border: 0 }}><X_I.X size={16} /></button>
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

/* ============ Help & Support page ============
   In-app FAQ list + Contact us modal. Contact us sends a message to every
   admin user (writes rr_messages rows) and creates a rr_notifications row
   per admin so they see the alert. */
function PageHelpSupport({ currentUser }) {
  const [contactOpen, setContactOpen] = X_us(false);
  const [message, setMessage] = X_us('');
  const [sending, setSending] = X_us(false);
  const toast = useToast();
  // Show FAQs tagged with the current user's role audience. Admins see
  // everything that's tagged for any audience (so they can preview).
  const role = currentUser?.role || 'vendor';
  const faqs = (window.RosyData?.FAQS || [])
    .filter(f => f.active !== false && f.is_visible !== false)
    .filter(f => {
      if (role === 'admin') return true;
      const aud = f.audiences || [];
      // Untagged legacy rows are treated as marketing-only; non-admin users
      // skip them unless they're explicitly tagged for their role.
      if (aud.length === 0) return false;
      return aud.includes(role);
    })
    .sort((a, b) => {
      // Honour the per-audience drag order from the admin FAQ Order tab.
      const ao = (a.audience_orders || {})[role];
      const bo = (b.audience_orders || {})[role];
      const an = ao != null ? ao : (a.sort_order ?? 0);
      const bn = bo != null ? bo : (b.sort_order ?? 0);
      return an - bn;
    });
  const [expandedId, setExpandedId] = X_us(null);

  const sendContact = async () => {
    if (sending) return;
    const trimmed = (message || '').trim();
    if (trimmed.length < 10) { toast.push({ kind: 'warning', title: 'Message is too short', body: 'Give the support team at least a sentence to go on.' }); return; }
    if (!currentUser?.id) { toast.push({ kind: 'warning', title: 'Sign in to send a message' }); return; }
    setSending(true);
    try {
      const admins = (window.RosyData?.USERS || []).filter(u => u.role === 'admin' && u.id !== currentUser.id);
      if (admins.length === 0) {
        toast.push({ kind: 'warning', title: 'No admins to message right now', body: 'Try again in a moment.' });
        setSending(false);
        return;
      }
      const fromName = currentUser.name || currentUser.first || currentUser.email || 'a user';
      const subject = `Help & support request from ${fromName}`;
      // Write a message + notification per admin so each gets their own row
      // (existing pattern — RLS keeps each user's inbox scoped to themselves).
      const sb = window.sb;
      if (sb) {
        await Promise.all(admins.map(async (a) => {
          try {
            await sb.from('rr_messages').insert({
              from_user_id: currentUser.id,
              to_user_id: a.id,
              subject,
              body: trimmed,
              read: false,
            });
          } catch (e) { console.warn('contact message insert failed:', e); }
          try {
            await sb.from('rr_notifications').insert({
              user_id: a.id,
              type: 'support_request',
              title: 'New support request',
              body: `${fromName}: ${trimmed.slice(0, 120)}${trimmed.length > 120 ? '…' : ''}`,
              link: '#app/inbox',
              read: false,
            });
          } catch (e) { console.warn('contact notif insert failed:', e); }
        }));
      }
      toast.push({ kind: 'success', title: 'Message sent', body: `We'll get back to you soon. (Routed to ${admins.length} admin${admins.length === 1 ? '' : 's'}.)` });
      setMessage('');
      setContactOpen(false);
    } catch (e) {
      console.warn('contact send failed:', e);
      toast.push({ kind: 'error', title: "Couldn't send your message", body: e.message || 'Try again in a moment.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Help &amp; support</h2>
        <button className="btn btn-coral" onClick={() => setContactOpen(true)}><X_I.MessageSquare size={14} />Contact us</button>
      </div>
      <p style={{ margin: '4px 0 24px', color: 'var(--color-muted)', fontSize: 14.5 }}>Browse the frequently asked questions below. Can't find what you need? Tap <strong>Contact us</strong> and a Rosy admin will get back to you.</p>

      {faqs.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: 'var(--color-surface-soft)', color: 'var(--color-muted)', marginBottom: 14 }}>
            <X_I.HelpCircle size={26} />
          </div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>No FAQs yet</h3>
          <p style={{ margin: '8px 0 18px', color: 'var(--color-muted)', fontSize: 14 }}>Reach out and we'll help directly.</p>
          <button className="btn btn-coral" onClick={() => setContactOpen(true)}><X_I.MessageSquare size={14} />Contact us</button>
        </div>
      ) : (
        <div className="card card-flush">
          {faqs.map(f => {
            const open = expandedId === f.id;
            return (
              <div key={f.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                <button type="button"
                  onClick={() => setExpandedId(open ? null : f.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '18px 20px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{f.question}</span>
                  {open ? <X_I.ChevronDown size={16} /> : <X_I.ChevronRight size={16} />}
                </button>
                {open ? (
                  <div style={{ padding: '0 20px 20px', color: 'var(--color-body)', fontSize: 14.5, lineHeight: 1.6 }}>{f.answer}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={contactOpen} onClose={() => { if (!sending) setContactOpen(false); }} title="Contact support" size="md"
        footer={
          <>
            <button className="btn btn-ghost" disabled={sending} onClick={() => setContactOpen(false)}>Cancel</button>
            <button className="btn btn-coral" disabled={sending || !message.trim()} onClick={sendContact}>{sending ? 'Sending…' : 'Send message'}</button>
          </>
        }>
        <div className="col" style={{ gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>Your message goes straight to Rosy admins. We respond inside the app — check your inbox.</p>
          <div className="field">
            <label className="field-label">Message</label>
            <textarea className="textarea" rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's going on? More detail helps us answer faster." />
            <p className="field-hint" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{message.length} characters</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { PageHelpSupport });

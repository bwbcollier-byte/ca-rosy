/* Shared components for Rosy Recruits */

const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;
const Ic = window.Icons;
const D  = window.RosyData;

/* ---------- Toast system ---------- */
const ToastCtx = createContext({ push: () => {} });
const useToast = () => useContext(ToastCtx);

function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, title: '', body: '', kind: 'success', duration: 3500, ...toast };
    setToasts(ts => [...ts, t]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.duration);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => {
          const I = t.kind === 'success' ? Ic.CheckCircle2 : t.kind === 'error' ? Ic.XCircle : t.kind === 'warning' ? Ic.AlertTriangle : Ic.AlertCircle;
          const color = t.kind === 'success' ? 'var(--color-success)' : t.kind === 'error' ? 'var(--color-error)' : t.kind === 'warning' ? 'var(--color-warning)' : 'var(--rosy-teal)';
          return (
            <div key={t.id} className={`toast ${t.kind}`} role="status">
              <I size={20} style={{ color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="title">{t.title}</p>
                {t.body ? <p className="body">{t.body}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Avatar ---------- */
function Avatar({ user, name, size = 'md', src }) {
  const cls = size === 'sm' ? 'avatar sm' : size === 'lg' ? 'avatar lg' : size === 'xl' ? 'avatar xl' : 'avatar';
  const seed = name || (user && user.name) || 'user';
  const initials = seed.split(' ').slice(0,2).map(s => s[0]).join('').toUpperCase();
  // Prefer explicit src → user prop's photo → lookup user by name in live RosyData
  // → DiceBear placeholder. Real uploaded photos win over cartoons.
  let resolvedSrc = src;
  if (!resolvedSrc && user) resolvedSrc = user.photo || user.avatar_url || user.avatarUrl;
  if (!resolvedSrc && name) {
    const u = (window.RosyData?.USERS || []).find(x => x.name === name);
    if (u) resolvedSrc = u.photo || u.avatar_url || u.avatarUrl;
  }
  const url = resolvedSrc || D.IMAGES.avatar(seed);
  return (
    <span className={cls} title={seed}>
      <img src={url} alt={initials} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </span>
  );
}

/* ---------- Badge ---------- */
function Badge({ kind, children, icon }) {
  const map = {
    Available: 'badge-available', Open: 'badge-open', Paid: 'badge-paid',
    Late: 'badge-late', Pending: 'badge-pending', Confirmed: 'badge-confirmed',
    Completed: 'badge-completed', Cancelled: 'badge-cancelled', Rejected: 'badge-rejected',
    Active: 'badge-active', Inactive: 'badge-inactive', Disputed: 'badge-disputed',
    'Not Due': 'badge-not-due', Draft: 'badge-draft',
    Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high',
  };
  const cls = map[kind] || 'badge-pending';
  const label = children || kind;
  const dotKinds = ['Available', 'Active', 'Inactive'];
  return (
    <span className={`badge ${cls}`}>
      {dotKinds.includes(kind) ? <span className="dot" /> : null}
      {icon ? icon : null}
      {label}
    </span>
  );
}

/* ---------- GigChip ---------- */
function GigChip({ type }) {
  const cls = type.toLowerCase();
  return <span className={`gig-chip ${cls}`}><span className="dot" />{type}</span>;
}

/* ---------- Stat card ---------- */
function StatCard({ icon: Icon, label, value, delta, dateStrip, prefix = '', showStrip = true, animate = true, primary = false, period, sublabel }) {
  const [display, setDisplay] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) { setDisplay(value); return; }
    if (typeof value !== 'number') { setDisplay(value); return; }
    // Skip animation for small numbers (≤ 3) — the rounding would otherwise show 0 for too long.
    if (value <= 3) { setDisplay(value); return; }
    let start = performance.now();
    const dur = 600;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(p >= 1 ? value : Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);

  const formatted = typeof value === 'number' ? `${prefix}${display.toLocaleString()}` : value;
  return (
    <div className={`stat-card ${showStrip ? '' : 'no-strip'} ${primary ? 'primary' : ''}`}>
      <div className="stat-top">
        <div className="stat-label">
          <span className="stat-label-text">
            {Icon ? <Icon size={16} /> : null}
            {label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-muted-soft)' }}>{period || 'Last 30 Days'}</span>
        </div>
        <div className="stat-value-row">
          <div className="stat-value">{formatted}</div>
          {delta != null ? (
            <span className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}>
              {Math.abs(delta)}%
              {delta >= 0 ? <Ic.ArrowUp size={11} /> : <Ic.ArrowDown size={11} />}
            </span>
          ) : null}
        </div>
        {sublabel ? <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4 }}>{sublabel}</div> : null}
      </div>
      {showStrip !== false ? <div className="stat-date-strip">{dateStrip || (() => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 30); const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); return `${fmt(s)} – ${fmt(e)}`; })()}</div> : null}
    </div>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, size = 'md', children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${size}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {title ? (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Ic.X size={18} /></button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Slideover ---------- */
function Slideover({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="slideover-backdrop" onClick={onClose}>
      <div className="slideover" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Ic.X size={18} /></button>
        </div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Confirm dialog ---------- */
function ConfirmDialog({ open, onClose, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-coral'}`} onClick={() => { onConfirm && onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>
    }>
      <p style={{ margin: 0, color: 'var(--color-body)' }}>{message}</p>
    </Modal>
  );
}

/* ---------- Empty state ---------- */
function Empty({ icon: Icon = Ic.Sparkles, title, body, cta }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={24} /></div>
      <h4>{title}</h4>
      {body ? <p>{body}</p> : null}
      {cta ? <div style={{ marginTop: 12 }}>{cta}</div> : null}
    </div>
  );
}

/* ---------- Sidebar nav ---------- */
function Sidebar({ role, route, setRoute, onSignOut, open = false, onClose, currentUser, sidebarStyle = 'pill', dark = false, brandColor = 'coral' }) {
  // Re-render when live data changes so badge counts stay accurate.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('rosy:data-changed', bump);
    return () => window.removeEventListener('rosy:data-changed', bump);
  }, []);

  // Per-user, per-route "last visited" timestamps (localStorage). Badge counts
  // = items that arrived after that timestamp. Clicking the nav item resets it,
  // making the badge disappear.
  const meKey = currentUser?.id || 'anon';
  const lastVisitedKey = `rosy.lastVisited.${meKey}`;
  const readVisits = () => { try { return JSON.parse(localStorage.getItem(lastVisitedKey) || '{}'); } catch (e) { return {}; } };
  const writeVisits = (v) => { try { localStorage.setItem(lastVisitedKey, JSON.stringify(v)); } catch (e) {} };
  const visits = readVisits();
  const markVisited = (id) => { const v = readVisits(); v[id] = new Date().toISOString(); writeVisits(v); setTick(t => t + 1); };
  const sinceCount = (routeId, arr, getDate) => {
    const since = visits[routeId];
    if (!since) return arr.length; // never visited → everything is "new"
    const t = new Date(since).getTime();
    return arr.filter(x => { const d = getDate(x); return d && new Date(d).getTime() > t; }).length;
  };

  const D = window.RosyData || {};
  const notifs = (D.NOTIFICATIONS || []).filter(n => !n.user_id || n.user_id === currentUser?.id);
  const msgs   = D.MESSAGES || [];
  const myMsgs = msgs.filter(c => !currentUser?.id || (c.participants || []).includes(currentUser.id) || c.startedBy === currentUser.id || c.with === currentUser.id);

  // Compute counts per route id
  const counts = {
    notifications: notifs.filter(n => n.unread).length,                       // unread always (independent of visits)
    inbox: myMsgs.reduce((s, c) => s + (c.unread || 0), 0),                   // total unread messages in your convs
    'gig-posts': sinceCount('gig-posts', (D.GIGS || []).filter(g => g.status === 'open'), g => g.date || g.created_at),
    events:      sinceCount('events',    (D.EVENTS || []), e => e.created_at || e.date),
    gigs:        sinceCount('gigs',      (D.GIGS || []),   g => g.created_at || g.date),
    disputes:    (D.TRANSACTIONS || []).filter(t => t.status === 'Disputed' || t.status === 'Late').length,
  };

  // Hide badge when the route is the one you're already viewing.
  const badgeFor = (id) => (route === id ? 0 : (counts[id] || 0));

  const closeAfter = (id, fn) => () => { if (id) markVisited(id); fn(); onClose && onClose(); };

  const NAV = {
    admin: [
      { section: 'OVERVIEW', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'users',     label: 'Users',     icon: Ic.Users },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gigs',      label: 'Gigs',      icon: Ic.Briefcase },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell },
      ]},
      { section: 'DATABASE', items: [
        { id: 'workers',  label: 'Workers',  icon: Ic.UserCircle2 },
        { id: 'vendors',  label: 'Vendors',  icon: Ic.Building2 },
        { id: 'venues',   label: 'Venues',   icon: Ic.MapPin },
        { id: 'payments', label: 'Payments', icon: Ic.CreditCard },
        { id: 'disputes', label: 'Disputes', icon: Ic.AlertTriangle },
        { id: 'inbox',    label: 'Inbox',    icon: Ic.MessageSquare },
      ]},
      { section: 'CONTENT', items: [
        { id: 'site-content', label: 'Site Content',     icon: Ic.FileText },
        { id: 'faqs',         label: 'FAQs',              icon: Ic.HelpCircle },
        { id: 'emails',       label: 'Email Templates',  icon: Ic.Mail },
        { id: 'gallery',      label: 'Gallery',          icon: Ic.Image },
      ]},
      { section: 'PLATFORM', items: [
        { id: 'analytics', label: 'Analytics', icon: Ic.BarChart3 },
        { id: 'broadcast', label: 'Send broadcast', icon: Ic.Send },
        { id: 'notif-rules', label: 'Notification rules', icon: Ic.Sliders },
        { id: 'admin-team', label: 'Admin team', icon: Ic.ShieldCheck },
        { id: 'audit',     label: 'Audit Log', icon: Ic.ScrollText },
        { id: 'changelog', label: 'Change log', icon: Ic.History },
        { id: 'platform',  label: 'Platform Settings', icon: Ic.Sliders },
      ]},
    ],
    vendor: [
      { section: '', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gigs',      label: 'Gigs',      icon: Ic.Briefcase },
        { id: 'build-team', label: 'Build my team', icon: Ic.Sparkles },
        { id: 'payments',  label: 'Payments',  icon: Ic.CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell },
        { id: 'inbox',     label: 'Inbox',     icon: Ic.MessageSquare },
      ]},
    ],
    worker: [
      { section: '', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gig-posts', label: 'Gig Posts', icon: Ic.ClipboardList },
        { id: 'my-gigs',   label: 'My Gigs',   icon: Ic.CheckSquare },
        { id: 'payments',  label: 'Payments',  icon: Ic.CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell },
        { id: 'inbox',     label: 'Inbox',     icon: Ic.MessageSquare },
      ]},
    ],
  };

  // Mark the current route as visited whenever it changes so the user is "caught up".
  useEffect(() => { if (route) markVisited(route); }, [route]);

  const sections = NAV[role] || NAV.admin;
  const styleClass = sidebarStyle === 'bar' ? 'style-bar' : sidebarStyle === 'subtle' ? 'style-subtle' : '';

  return (
    <>
      {open ? <div className="sidebar-backdrop" onClick={onClose} /> : null}
      <aside className={`sidebar ${styleClass} ${dark ? 'dark' : ''} ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <RoseLogo />
          <div className="sidebar-logo-text">Rosy<span className="accent"> Recruits</span></div>
        </div>
        {sections.map((sec, i) => (
          <React.Fragment key={i}>
            {sec.section ? <div className="sidebar-divider">{sec.section}</div> : null}
            {sec.items.map(item => {
              const b = badgeFor(item.id);
              return (
                <button key={item.id}
                  className={`nav-item ${route === item.id ? 'active' : ''}`}
                  onClick={closeAfter(item.id, () => setRoute(item.id))}>
                  <item.icon className="nav-icon" />
                  <span>{item.label}</span>
                  {b > 0 ? <span className="nav-badge">{b > 99 ? '99+' : b}</span> : null}
                </button>
              );
            })}
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        <div className="divider" style={{ margin: '12px 0 8px' }} />
        <button className="nav-item" onClick={closeAfter('settings', () => setRoute('settings'))}>
          <Ic.Settings className="nav-icon" /><span>Settings</span>
        </button>
        <button className="nav-item" onClick={closeAfter(null, () => onSignOut && onSignOut())}>
          <Ic.LogOut className="nav-icon" /><span>Log Out</span>
        </button>
      </aside>
    </>
  );
}

/* ---------- Logo ---------- */
function RoseLogo({ size = 28 }) {
  return (
    <img src="project/assets/logo.avif" alt="Rosy Recruits" width={size} height={size}
      style={{ flex: 'none', objectFit: 'contain', display: 'block' }} />
  );
}

/* ---------- App header ---------- */
function AppHeader({ title, role, setRole, onSignOut, onBell, currentUser, setRoute, breadcrumbs, onBurger, sessionUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  // Re-render this header when notifications mutate so the bell dot stays in sync.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('rosy:data-changed', bump);
    return () => window.removeEventListener('rosy:data-changed', bump);
  }, []);
  const safeUser = currentUser || { name: 'Guest', first: 'Guest' };
  // Single source of truth for unread count — keeps bell and Notifications page in sync.
  const myUnread = (window.rosyUnreadForUser
    ? window.rosyUnreadForUser(window.RosyData?.NOTIFICATIONS || [], currentUser)
    : 0);
  // Role switcher rules:
  //   - signed-in admin    → show as a "View as" tool (admins can preview vendor/worker)
  //   - signed-in non-admin → hide entirely (your role is fixed)
  //   - anonymous demo     → show (this is the demo entry point)
  const showRoleSwitch = !sessionUser || sessionUser.role === 'admin';
  return (
    <header className="app-header">
      {onBurger ? (
        <button className="app-burger" aria-label="Open menu" onClick={onBurger}>
          <Ic.Menu size={20} />
        </button>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {(() => {
            const roleMeta = {
              admin:  { label: 'Admin portal',  bg: 'rgba(26,188,176,0.12)',  fg: '#0F8278' },
              vendor: { label: 'Vendor portal', bg: 'rgba(244,124,93,0.12)',  fg: '#B84A2E' },
              worker: { label: 'Worker portal', bg: 'rgba(196,158,80,0.16)',  fg: '#8A6A1F' },
            }[role] || null;
            if (!roleMeta) return null;
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: roleMeta.bg, color: roleMeta.fg, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: roleMeta.fg }} />
                {roleMeta.label}
              </span>
            );
          })()}
        </div>
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <div className="header-spacer" />
      {showRoleSwitch ? <RoleSwitch role={role} setRole={setRole} viewAs={!!sessionUser} /> : null}
      {role === 'admin' ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setDevOpen(true)} title="Report a development issue" style={{ marginRight: 4 }}>
          <Ic.AlertTriangle size={14} />Report dev issue
        </button>
      ) : null}
      {role === 'admin' && window.DevNotificationModal ? <window.DevNotificationModal open={devOpen} onClose={() => setDevOpen(false)} reportedBy={currentUser} /> : null}
      <button className="icon-btn" aria-label={`Notifications${myUnread ? ' — ' + myUnread + ' unread' : ''}`} onClick={onBell}>
        <Ic.Bell size={18} />
        {myUnread > 0 ? <span className="bell-dot" /> : null}
      </button>
      <div style={{ position: 'relative' }}>
        <button className="header-avatar" onClick={() => setMenuOpen(o => !o)}>
          <Avatar name={safeUser.name} src={safeUser.photo || safeUser.avatar_url || safeUser.avatarUrl} size="sm" />
          <span className="name">{safeUser.first}</span>
          <Ic.ChevronDown size={14} />
        </button>
        {menuOpen ? (
          <div style={{ position: 'absolute', top: 50, right: 0, width: 220, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 12, boxShadow: 'var(--shadow-modal)', padding: 6, zIndex: 50 }}>
            {[
              ['Account settings', () => setRoute && setRoute('settings')],
              ['Take the tour',    () => window.dispatchEvent(new CustomEvent('rosy:start-tour'))],
              ['Help & support',   () => { setRoute && setRoute('settings'); window.location.hash = 'marketing/contact'; }],
              ['Log out',          () => onSignOut()],
            ].map(([label, fn]) => (
              <button key={label} className="nav-item" style={{ fontSize: 13 }} onClick={() => { setMenuOpen(false); fn && fn(); }}>{label}</button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function RoleSwitch({ role, setRole, viewAs = false }) {
  const ROLES = [
    { id: 'admin',  label: viewAs ? 'Admin' : 'Admin' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'worker', label: 'Worker' },
  ];
  return (
    <div style={{ display: 'inline-flex', background: 'var(--color-surface-soft)', padding: 3, borderRadius: 9999, gap: 4 }}>
      {ROLES.map(r => (
        <button key={r.id}
          onClick={() => setRole(r.id)}
          style={{
            border: 0, padding: '6px 12px',
            background: role === r.id ? 'var(--color-canvas)' : 'transparent',
            color: role === r.id ? 'var(--color-ink)' : 'var(--color-muted)',
            boxShadow: role === r.id ? 'var(--shadow-soft)' : 'none',
            borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Notification dropdown ---------- */
function NotificationPanel({ open, onClose, setRoute, role = 'admin', currentUser }) {
  const [tab, setTab] = useState('all');
  // Scope to current user. Admins still only see their own bell — they have the Audit Log + broadcast tools for cross-user visibility.
  const scoped = (D.NOTIFICATIONS || []).filter(n => {
    if (!currentUser?.id) return false;
    const owner = n.user_id || n._userId;
    return !owner || owner === currentUser.id;
  });
  const list = scoped.filter(n => tab === 'all' || n.unread);
  if (!open) return null;
  const openNotif = (n) => {
    // Mark read in DB + locally before navigating.
    if (n.unread) {
      n.unread = false; n.read = true;
      if (window.RosyMutate?.notifications) window.RosyMutate.notifications.markRead(n.id).catch(() => {});
      window.dispatchEvent(new CustomEvent('rosy:data-changed'));
    }
    onClose && onClose();
    const linkRaw = (n.link || '').replace(/^#/, '');
    // Parse routes shaped like:
    //   #events/<id>  → events:<id>
    //   #app/events/<id> → events:<id>
    //   #payments/<id> → payments:<id>
    //   #inbox / #my-gigs / etc → bare route id
    const stripped = linkRaw.replace(/^app\//, '');
    const slashIdx = stripped.indexOf('/');
    const head = slashIdx >= 0 ? stripped.slice(0, slashIdx) : stripped;
    const tail = slashIdx >= 0 ? stripped.slice(slashIdx + 1) : '';
    const workerOnly = role === 'worker';
    // Routes that support deep-linking to a specific row:
    if (head === 'events' && tail) return setRoute && setRoute('events:' + tail);
    if (head === 'gigs' && tail)   return setRoute && setRoute('gigs:' + tail);
    if (head === 'payments' && tail) return setRoute && setRoute('payments:' + tail);
    // Bare-route mapping:
    const map = {
      'disputes': role === 'admin' ? 'disputes' : 'dashboard',
      'my-gigs':  workerOnly ? 'my-gigs' : 'dashboard',
      'inbox':    'inbox',
      'profile':  'settings',
      'payments': 'payments',
      'events':   'events',
      'gigs':     'gigs',
      'notifications': 'notifications',
      'dashboard': 'dashboard',
    };
    setRoute && setRoute(map[head] || 'notifications');
  };
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 72, right: 32, width: 400, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 16, boxShadow: 'var(--shadow-modal)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18 }}>Notifications</h4>
          <button className="btn-link" style={{ fontSize: 12 }} onClick={() => { onClose && onClose(); setRoute && setRoute('notifications'); }}>View all</button>
        </div>
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6 }}>
          <button onClick={() => setTab('all')} aria-pressed={tab==='all'} className={`pill`} style={{ background: tab==='all' ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: tab==='all' ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }}>All</button>
          <button onClick={() => setTab('unread')} aria-pressed={tab==='unread'} className={`pill`} style={{ background: tab==='unread' ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: tab==='unread' ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }}>Unread</button>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {list.length === 0 ? <Empty title="You're all caught up!" body="No new notifications." /> :
           list.map(n => {
             const IconMap = { gig_application: Ic.CalendarCheck, gig_confirmed: Ic.CheckCircle2, gig_rejected: Ic.XCircle, payment_sent: Ic.DollarSign, payment_disputed: Ic.AlertTriangle, new_message: Ic.MessageSquare, rating_received: Ic.Star };
             const I = IconMap[n.type] || Ic.Bell;
             return (
               <div key={n.id} onClick={() => openNotif(n)} style={{ display: 'flex', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer', position: 'relative' }}>
                 <div style={{ width: 34, height: 34, borderRadius: 9999, background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rosy-teal-dark)', flex: 'none' }}>
                   <I size={16} />
                 </div>
                 <div style={{ flex: 1, minWidth: 0 }}>
                   <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{n.title}</p>
                   <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>{n.body}</p>
                   <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted-soft)' }}>{n.time}</p>
                 </div>
                 {n.unread ? <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--rosy-teal)', alignSelf: 'center', flex: 'none' }} /> : null}
               </div>
             );
           })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Pagination ---------- */
function Pagination({ page, setPage, total, perPage = 10, label = 'rows' }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  // Only show prev/next nav when there's more than one page worth of data.
  const showNav = pages > 1;
  const scrollTop = () => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    try { document.querySelector('.content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  };
  const onPrev = () => { setPage(p => Math.max(1, p - 1)); scrollTop(); };
  const onNext = () => { setPage(p => Math.min(pages, p + 1)); scrollTop(); };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--color-hairline)', alignItems: 'center', fontSize: 12.5, color: 'var(--color-muted)' }}>
      <span>{total === 0 ? `No ${label}` : `Showing ${from}–${to} of ${total} ${label}`}</span>
      {showNav ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" disabled={safePage <= 1} onClick={onPrev}><Ic.ChevronLeft size={14} />Previous</button>
          <span>Page {safePage} of {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={safePage >= pages} onClick={onNext}>Next<Ic.ChevronRight size={14} /></button>
        </div>
      ) : null}
    </div>
  );
}

function usePaged(items, perPage = 10, resetKey) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  // Reset to page 1 when the filter/search signature changes
  useEffect(() => { setPage(1); }, [resetKey]);
  // Also clamp when the current page falls outside the new range
  useEffect(() => { if (page > pages) setPage(pages); }, [pages, page]);
  const slice = useMemo(() => items.slice((page - 1) * perPage, page * perPage), [items, page, perPage]);
  return { page, setPage, pages, slice, total, perPage };
}

/* ---------- Bulk action bar ---------- */
function BulkActionBar({ count, actions = [], onClear }) {
  if (!count) return null;
  return (
    <div role="region" aria-label="Bulk actions"
      style={{ position: 'sticky', bottom: 16, zIndex: 50, margin: '16px auto 0', maxWidth: 720,
        background: 'var(--color-ink)', color: '#fff', borderRadius: 14, boxShadow: 'var(--shadow-modal)',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 13.5 }}>
      <span style={{ fontWeight: 600 }}>{count} selected</span>
      <span style={{ flex: 1 }} />
      {actions.map((a, i) => (
        <button key={i} onClick={a.disabled ? undefined : a.onClick} disabled={!!a.disabled}
          aria-disabled={!!a.disabled}
          className={a.danger ? 'btn btn-danger btn-sm' : 'btn btn-coral btn-sm'}
          title={a.disabled ? 'Not available for this selection' : undefined}
          style={a.danger ? undefined : { background: 'var(--rosy-coral)', color: '#fff', opacity: a.disabled ? 0.45 : 1, cursor: a.disabled ? 'not-allowed' : 'pointer' }}>
          {a.icon ? <a.icon size={14} /> : null}{a.label}
        </button>
      ))}
      <button onClick={onClear} aria-label="Clear selection"
        style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', padding: 6, display: 'flex' }}>
        <Ic.X size={16} />
      </button>
    </div>
  );
}

/* ---------- Breadcrumbs ---------- */
function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  const truncate = { maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4, minWidth: 0 }}>
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {it.onClick && !isLast ? (
              <button onClick={it.onClick} className="breadcrumb-link"
                style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-muted)', cursor: 'pointer', fontSize: 'inherit', ...truncate }}
                title={typeof it.label === 'string' ? it.label : undefined}>
                {it.label}
              </button>
            ) : (
              <span style={{ color: isLast ? 'var(--color-ink)' : 'var(--color-muted)', fontWeight: isLast ? 500 : 400, ...truncate }}
                title={typeof it.label === 'string' ? it.label : undefined}>
                {it.label}
              </span>
            )}
            {!isLast ? <Ic.ChevronRight size={11} style={{ color: 'var(--color-muted-soft)', flex: 'none' }} /> : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ---------- Event/entity image with placeholder fallback ---------- */
function EventImage({ src, name = '', size = 44, radius = 10, className = '', style = {} }) {
  const [failed, setFailed] = useState(false);
  const hasSrc = !!src && !failed;
  const seed = (name || '').charCodeAt(0) || 0;
  const palettes = [
    ['#FDBA9C', '#F47C5D'], ['#F8C9B0', '#E59E72'], ['#FBD6C2', '#D88A6A'],
    ['#F0BDA5', '#C97554'], ['#FAD0BC', '#E48761'], ['#F4C2A3', '#CC7349'],
  ];
  const [a, b] = palettes[seed % palettes.length];
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const baseStyle = { width: size, height: size, borderRadius: radius, flex: 'none', ...style };
  if (hasSrc) {
    return <img src={src} alt={name} onError={() => setFailed(true)}
      className={className} style={{ ...baseStyle, objectFit: 'cover', display: 'block' }} />;
  }
  const fontSize = typeof size === 'number' ? Math.max(12, size * 0.42) : 56;
  return (
    <div className={className} aria-label={name || 'No image'} role="img"
      style={{ ...baseStyle, background: `linear-gradient(135deg, ${a}, ${b})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize, letterSpacing: '-0.02em' }}>
      {initial}
    </div>
  );
}

/* ---------- Sort menu ---------- */
function SortMenu({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  const current = options.find(o => o[0] === value)?.[1] || 'Sort';
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}><Ic.ArrowUpDown size={14} />{current}<Ic.ChevronDown size={12} /></button>
      {open ? (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 12, boxShadow: 'var(--shadow-modal)', padding: 6, minWidth: 180, zIndex: 100 }}>
          {options.map(([id, label]) => (
            <button key={id} onClick={() => { onChange(id); setOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 0, background: value === id ? 'var(--color-surface-soft)' : 'transparent', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: value === id ? 600 : 500 }}>
              {value === id ? <Ic.CheckCircle size={14} style={{ color: 'var(--rosy-teal)' }} /> : <span style={{ width: 14 }} />}
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Helpers ---------- */
function fmtDate(iso, opt) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  if (opt === 'mdy-dots') return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}.${d.getFullYear()}`;
  if (opt === 'month') return d.toLocaleString('en-US', { month: 'long' });
  if (opt === 'day-month') return { day: d.getDate(), month: d.toLocaleString('en-US', { month: 'short' }) };
  return d.toLocaleDateString();
}
function fmtMoney(n) {
  const v = Number(n);
  if (!isFinite(v)) return '$0';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}
function getGreeting(name) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const cap = (s) => (s || '').replace(/\b\w/g, c => c.toUpperCase());
  const safe = (name && name !== 'Guest') ? cap(name) : 'there';
  return `${greet}, ${safe}`;
}

/* ---------- ViewToggle (table | cards) — reusable across list pages ---------- */
function ViewToggle({ value, onChange }) {
  const opt = (id, label, Icon) => (
    <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id} aria-label={`${label} view`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', height: 36, border: '1.5px solid', borderColor: value === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: value === id ? 'var(--color-ink)' : 'transparent', color: value === id ? '#fff' : 'inherit', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
      <Icon size={13} />{label}
    </button>
  );
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {opt('table', 'Table', Ic.List)}
      {opt('cards', 'Cards', Ic.LayoutGrid)}
    </div>
  );
}

Object.assign(window, {
  ToastHost, useToast, Avatar, Badge, GigChip, StatCard, Modal, Slideover, ConfirmDialog, Empty,
  Sidebar, AppHeader, NotificationPanel, RoseLogo, RoleSwitch, SortMenu, ViewToggle,
  Pagination, usePaged, BulkActionBar, Breadcrumbs, EventImage,
  fmtDate, fmtMoney, getGreeting,
});

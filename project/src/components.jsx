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
  const url = src || D.IMAGES.avatar(seed);
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
function StatCard({ icon: Icon, label, value, delta, dateStrip, prefix = '', showStrip = true, animate = true, primary = false }) {
  const [display, setDisplay] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) { setDisplay(value); return; }
    if (typeof value !== 'number') { setDisplay(value); return; }
    let start = performance.now();
    const dur = 600;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
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
          <span style={{ fontSize: 11, color: 'var(--color-muted-soft)' }}>Last 30 Days</span>
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
      </div>
      <div className="stat-date-strip">{dateStrip || 'May 1st 2026 – June 1st 2026'}</div>
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
          <button className="icon-btn" onClick={onClose}><Ic.X size={18} /></button>
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
function Sidebar({ role, route, setRoute, sidebarStyle = 'pill', dark = false, brandColor = 'coral' }) {
  const NAV = {
    admin: [
      { section: 'OVERVIEW', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'users',     label: 'Users',     icon: Ic.Users },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gigs',      label: 'Gigs',      icon: Ic.Briefcase },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell, badge: 3 },
      ]},
      { section: 'DATABASE', items: [
        { id: 'workers',  label: 'Workers',  icon: Ic.UserCircle2 },
        { id: 'vendors',  label: 'Vendors',  icon: Ic.Building2 },
        { id: 'venues',   label: 'Venues',   icon: Ic.MapPin },
        { id: 'payments', label: 'Payments', icon: Ic.CreditCard },
        { id: 'disputes', label: 'Disputes', icon: Ic.AlertTriangle, badge: 2 },
        { id: 'inbox',    label: 'Inbox',    icon: Ic.MessageSquare, badge: 3 },
      ]},
      { section: 'CONTENT', items: [
        { id: 'site-content', label: 'Site Content',     icon: Ic.FileText },
        { id: 'emails',       label: 'Email Templates',  icon: Ic.Mail },
        { id: 'gallery',      label: 'Gallery',          icon: Ic.Image },
      ]},
      { section: 'PLATFORM', items: [
        { id: 'analytics', label: 'Analytics', icon: Ic.BarChart3 },
        { id: 'broadcast', label: 'Send broadcast', icon: Ic.Send },
        { id: 'notif-rules', label: 'Notification rules', icon: Ic.Sliders },
        { id: 'admin-team', label: 'Admin team', icon: Ic.ShieldCheck },
        { id: 'audit',     label: 'Audit Log', icon: Ic.ScrollText },
        { id: 'platform',  label: 'Platform Settings', icon: Ic.Sliders },
      ]},
    ],
    vendor: [
      { section: '', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gigs',      label: 'Gigs',      icon: Ic.Briefcase },
        { id: 'build-team', label: 'Build my team', icon: Ic.Sparkles },
        { id: 'workers',   label: 'Workers',   icon: Ic.UserCircle2 },
        { id: 'payments',  label: 'Payments',  icon: Ic.CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell, badge: 3 },
        { id: 'inbox',     label: 'Inbox',     icon: Ic.MessageSquare, badge: 3 },
      ]},
    ],
    worker: [
      { section: '', items: [
        { id: 'dashboard', label: 'Dashboard', icon: Ic.LayoutDashboard },
        { id: 'events',    label: 'Events',    icon: Ic.Calendar },
        { id: 'gig-posts', label: 'Gig Posts', icon: Ic.ClipboardList, badge: 7 },
        { id: 'my-gigs',   label: 'My Gigs',   icon: Ic.CheckSquare },
        { id: 'workers',   label: 'Workers',   icon: Ic.UserCircle2 },
        { id: 'payments',  label: 'Payments',  icon: Ic.CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Ic.Bell, badge: 2 },
        { id: 'inbox',     label: 'Inbox',     icon: Ic.MessageSquare, badge: 1 },
      ]},
    ],
  };

  const sections = NAV[role] || NAV.admin;
  const styleClass = sidebarStyle === 'bar' ? 'style-bar' : sidebarStyle === 'subtle' ? 'style-subtle' : '';

  return (
    <aside className={`sidebar ${styleClass} ${dark ? 'dark' : ''}`}>
      <div className="sidebar-logo">
        <RoseLogo />
        <div className="sidebar-logo-text">Rosy<span className="accent"> Recruits</span></div>
      </div>
      {sections.map((sec, i) => (
        <React.Fragment key={i}>
          {sec.section ? <div className="sidebar-divider">{sec.section}</div> : null}
          {sec.items.map(item => (
            <button key={item.id}
              className={`nav-item ${route === item.id ? 'active' : ''}`}
              onClick={() => setRoute(item.id)}>
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </React.Fragment>
      ))}
      <div style={{ flex: 1 }} />
      <div className="divider" style={{ margin: '12px 0 8px' }} />
      <button className="nav-item" onClick={() => setRoute('settings')}>
        <Ic.Settings className="nav-icon" /><span>Settings</span>
      </button>
      <button className="nav-item" onClick={() => setRoute('logout')}>
        <Ic.LogOut className="nav-icon" /><span>Log Out</span>
      </button>
    </aside>
  );
}

/* ---------- Logo ---------- */
function RoseLogo({ size = 28 }) {
  return (
    <img src="assets/logo.avif" alt="Rosy Recruits" width={size} height={size}
      style={{ flex: 'none', objectFit: 'contain', display: 'block' }} />
  );
}

/* ---------- App header ---------- */
function AppHeader({ title, role, setRole, onSignOut, onBell, currentUser, setRoute }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="app-header">
      <h1>{title}</h1>
      <div className="header-spacer" />
      <RoleSwitch role={role} setRole={setRole} />
      <button className="icon-btn" aria-label="Notifications" onClick={onBell}>
        <Ic.Bell size={18} />
        <span className="bell-dot" />
      </button>
      <div style={{ position: 'relative' }}>
        <button className="header-avatar" onClick={() => setMenuOpen(o => !o)}>
          <Avatar name={currentUser.name} size="sm" />
          <span className="name">{currentUser.first}</span>
          <Ic.ChevronDown size={14} />
        </button>
        {menuOpen ? (
          <div style={{ position: 'absolute', top: 50, right: 0, width: 220, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 12, boxShadow: 'var(--shadow-modal)', padding: 6, zIndex: 50 }}>
            {[
              ['View profile',     () => setRoute && setRoute('settings')],
              ['Account settings', () => setRoute && setRoute('settings')],
              ['Take the tour',    () => window.dispatchEvent(new CustomEvent('rosy:start-tour'))],
              ['Help & support',   () => setRoute && setRoute('notifications')],
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

function RoleSwitch({ role, setRole }) {
  const ROLES = [
    { id: 'admin',  label: 'Admin' },
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
function NotificationPanel({ open, onClose, setRoute }) {
  const [tab, setTab] = useState('all');
  const list = D.NOTIFICATIONS.filter(n => tab === 'all' || n.unread);
  if (!open) return null;
  const openNotif = (n) => {
    onClose && onClose();
    const target = (n.link || '').replace('#', '').split('/').pop() || 'dashboard';
    const map = { 'e1': 'events:e1', 'disputes': 'disputes', 'my-gigs': 'my-gigs', 'inbox': 'inbox', 'profile': 'settings', 'payments': 'payments' };
    setRoute && setRoute(map[target] || 'notifications');
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
          <button onClick={() => setTab('all')} className={`pill`} style={{ background: tab==='all' ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: tab==='all' ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }}>All</button>
          <button onClick={() => setTab('unread')} className={`pill`} style={{ background: tab==='unread' ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: tab==='unread' ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }}>Unread</button>
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
  const d = new Date(iso);
  if (opt === 'mdy-dots') return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}.${d.getFullYear()}`;
  if (opt === 'month') return d.toLocaleString('en-US', { month: 'long' });
  if (opt === 'day-month') return { day: d.getDate(), month: d.toLocaleString('en-US', { month: 'short' }) };
  return d.toLocaleDateString();
}
function fmtMoney(n) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`; }
function getGreeting(name) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  return name ? `${greet}, ${name}` : `${greet},`;
}

Object.assign(window, {
  ToastHost, useToast, Avatar, Badge, GigChip, StatCard, Modal, Slideover, ConfirmDialog, Empty,
  Sidebar, AppHeader, NotificationPanel, RoseLogo, RoleSwitch, SortMenu,
  fmtDate, fmtMoney, getGreeting,
});

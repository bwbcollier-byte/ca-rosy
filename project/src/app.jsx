/* Main App — role switcher, hash router, screen mounting */

const { useState: A_us, useEffect: A_ue } = React;
const AI = window.Icons;
const AD = window.RosyData;

function App() {
  // Default first view: marketing (unless URL hash explicitly targets another mode)
  const initial = (() => {
    const h = window.location.hash.replace(/^#/, '');
    if (h.startsWith('marketing')) return 'marketing';
    if (h.startsWith('auth') || h.startsWith('login') || h.startsWith('signup')) return 'auth';
    if (h.startsWith('onboarding')) return 'onboarding';
    if (h.startsWith('app')) return 'app';
    return 'marketing';
  })();
  const initialMarketingSub = (() => {
    const h = window.location.hash.replace(/^#/, '');
    const m = h.match(/^marketing\/(.+)/);
    return m ? m[1] : 'home';
  })();
  const [mode, setMode] = A_us(initial);
  const [authMode, setAuthMode] = A_us('login');
  const [marketingSub, setMarketingSub] = A_us(initialMarketingSub);

  // App-mode state
  const [role, setRole] = A_us('admin');
  const [route, setRoute] = A_us('dashboard');
  const [notifOpen, setNotifOpen] = A_us(false);
  const [tourOpen, setTourOpen] = A_us(false);
  // Auth session — non-null when a user is signed in via Supabase Auth
  const [session, setSession] = A_us(null);
  A_ue(() => {
    if (!window.sb) return;
    window.sb.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = window.sb.auth.onAuthStateChange((_evt, sess) => setSession(sess));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);
  const [tweaks, setTweak] = useTweaks();
  const [tweaksOpen, setTweaksOpen] = A_us(false);
  const [sidebarOpen, setSidebarOpen] = A_us(false);
  // Realtime tick: bumped whenever supabase_client mutates window.RosyData,
  // forces a top-down re-render so screens read the new data.
  const [, setDataTick] = A_us(0);
  A_ue(() => {
    const bump = () => setDataTick(t => t + 1);
    window.addEventListener('rosy:data-changed', bump);
    return () => window.removeEventListener('rosy:data-changed', bump);
  }, []);
  A_ue(() => { setSidebarOpen(false); }, [route]);

  // Sync the role with the signed-in user's role. Hoisted ABOVE the early
  // returns below so the hook count stays constant across mode changes
  // (React's rules-of-hooks).
  const sessionUserId = session?.user?.id;
  A_ue(() => {
    if (!sessionUserId) return;
    const u = (window.RosyData?.USERS || []).find(x => x.id === sessionUserId);
    if (u && u.role && u.role !== role) setRole(u.role);
  }, [sessionUserId]);

  // Hash router for app routes
  A_ue(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (!h) return;
      const [m, r, sub] = h.split('/');
      if (['marketing','auth','onboarding','app'].includes(m)) setMode(m);
      if (m === 'marketing' && r) setMarketingSub(r);
      else if (m === 'marketing' && !r) setMarketingSub('home');
      if (m === 'app' && r) setRoute(sub ? `${r}:${sub}` : r);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  A_ue(() => {
    if (mode === 'app') window.location.hash = `app/${route}`;
    else if (mode === 'marketing') window.location.hash = marketingSub === 'home' ? 'marketing' : `marketing/${marketingSub}`;
    else window.location.hash = mode;
  }, [mode, route, marketingSub]);

  // Walkthrough trigger via custom event (header dropdown "Take the tour")
  A_ue(() => {
    const fn = () => setTourOpen(true);
    window.addEventListener('rosy:start-tour', fn);
    return () => window.removeEventListener('rosy:start-tour', fn);
  }, []);

  // ---------- Mode switches ----------
  if (mode === 'marketing') {
    return (
      <ToastHost>
        <MarketingPage
          goToApp={() => setMode('app')}
          goToAuth={(m) => { setAuthMode(m || 'login'); setMode('auth'); }}
          subRoute={marketingSub}
          setSubRoute={setMarketingSub} />
      </ToastHost>
    );
  }
  if (mode === 'auth') {
    // Skip onboarding for already-onboarded users (i.e. existing accounts).
    const goToApp = async () => {
      try {
        if (window.sb) {
          const { data: sess } = await window.sb.auth.getSession();
          const uid = sess?.session?.user?.id;
          if (uid) {
            const profile = AD.USERS.find(u => u.id === uid);
            if (profile) { setMode('app'); return; }
            const { data } = await window.sb.from('rr_profiles').select('onboarding_complete').eq('id', uid).maybeSingle();
            if (data?.onboarding_complete) { setMode('app'); return; }
          }
        }
      } catch (e) { console.warn('onboarding gate check failed:', e); }
      setMode('onboarding');
    };
    return (
      <ToastHost>
        <AuthPage mode={authMode} setMode={setAuthMode} goToApp={goToApp} />
      </ToastHost>
    );
  }
  if (mode === 'onboarding') {
    return (
      <ToastHost>
        <OnboardingPage onComplete={() => {
          // Drop a personal welcome notification so the bell badge lights up immediately.
          try {
            const me = sessionUser || currentUser;
            const list = window.RosyData.NOTIFICATIONS = window.RosyData.NOTIFICATIONS || [];
            list.unshift({
              id:     'welcome_' + Date.now(),
              type:   'welcome',
              title:  `Welcome to Rosy${me?.first ? ', ' + me.first : ''}!`,
              body:   `Your ${me?.role || 'account'} is ready. Take a 60-second tour to see what's possible.`,
              time:   'Just now',
              link:   '#tour',
              unread: true,
              user_id: me?.id,
            });
            window.dispatchEvent(new CustomEvent('rosy:data-changed'));
          } catch (e) { console.warn('welcome notif failed:', e); }
          setMode('app');
          setTourOpen(true);
        }} />
      </ToastHost>
    );
  }

  // ---------- App mode ----------
  // If signed in, the session user trumps the demo role-switcher.
  const sessionUser = session?.user?.id ? AD.USERS.find(u => u.id === session.user.id) : null;
  const currentUser = sessionUser || (
    role === 'admin'  ? (AD.USERS.find(u => u.id === 'u2') || AD.USERS.find(u => u.role === 'admin'))
  : role === 'vendor' ? (AD.USERS.find(u => u.id === 'u1') || AD.USERS.find(u => u.role === 'vendor'))
  :                     (AD.USERS.find(u => u.id === 'u3') || AD.USERS.find(u => u.role === 'worker'))
  );
  // header title from route
  const titleMap = {
    dashboard: 'Dashboard', users: 'Users', events: 'Events', gigs: 'Gigs',
    'gig-posts': 'Gig Posts', 'my-gigs': 'My Gigs', workers: 'Workers', vendors: 'Vendors',
    venues: 'Venues', payments: 'Payments', disputes: 'Disputes', inbox: 'Inbox',
    settings: 'Settings', audit: 'Audit log', analytics: 'Analytics',
    'site-content': 'Site content', emails: 'Email templates', gallery: 'Gallery',
    platform: 'Platform settings', notifications: 'Notifications', 'build-team': 'Build my team',
    'admin-team': 'Admin team', broadcast: 'Send broadcast', 'notif-rules': 'Notification rules',
  };
  const baseRoute = route.split(':')[0];
  const subId = route.split(':')[1];
  const title = titleMap[baseRoute] || 'Rosy Recruits';

  const breadcrumbs = (() => {
    if (baseRoute === 'dashboard') return [];
    const root = { label: 'Dashboard', onClick: () => setRoute('dashboard') };
    const section = { label: title, onClick: subId ? () => setRoute(baseRoute) : undefined };
    if (!subId) return [root, section];
    let leaf = subId;
    if (baseRoute === 'events') {
      const ev = AD.EVENTS.find(e => e.id === subId);
      if (ev) leaf = ev.name;
    } else if (baseRoute === 'users' || baseRoute === 'workers' || baseRoute === 'vendors') {
      const u = AD.USERS.find(x => x.id === subId);
      if (u) leaf = u.name;
    } else if (baseRoute === 'payments') {
      const t = AD.TRANSACTIONS.find(x => x.id === subId);
      if (t) leaf = t.invoice;
    }
    return [root, section, { label: leaf }];
  })();

  const handleSignOut = async () => {
    try { if (window.sb) await window.sb.auth.signOut(); } catch (e) { console.warn('signOut error:', e); }
    setSession(null);
    setRole('admin');     // reset to default demo role for next sign-in
    setRoute('dashboard');
    setMode('marketing');
  };

  return (
    <ToastHost>
      <div className={`app-shell`}>
        <Sidebar role={role} route={baseRoute} setRoute={setRoute}
          onSignOut={handleSignOut}
          open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          sidebarStyle={tweaks.sidebarStyle} dark={tweaks.sidebarDark} />
        <div className="main">
          <AppHeader title={title} role={role} setRole={(r) => { setRole(r); setRoute('dashboard'); }}
            onSignOut={handleSignOut} onBell={() => setNotifOpen(true)} currentUser={currentUser} setRoute={setRoute}
            breadcrumbs={breadcrumbs} sessionUser={sessionUser}
            onBurger={() => setSidebarOpen(true)} />
          <ScreenRouter role={role} route={route} baseRoute={baseRoute} setRoute={setRoute}
            currentUser={currentUser} tweaks={tweaks} />
        </div>
        <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} setRoute={setRoute} role={role} />
        {tourOpen ? <Walkthrough role={role} onClose={() => setTourOpen(false)} setRoute={setRoute} /> : null}
        <button className="tweaks-fab" aria-label="Open tweaks" onClick={() => setTweaksOpen(true)}
          style={{ position: 'fixed', right: 24, bottom: 24, width: 48, height: 48, borderRadius: 9999, border: 0, background: 'var(--color-ink)', color: '#fff', cursor: 'pointer', boxShadow: 'var(--shadow-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <window.Icons.Settings size={20} />
        </button>
        {tweaksOpen ? (
          <div onClick={() => setTweaksOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 360, maxWidth: '100%', height: '100%', background: 'var(--color-canvas)', overflowY: 'auto' }}>
              <TweaksPanel tweaks={tweaks} set={setTweak} onClose={() => setTweaksOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </ToastHost>
  );
}

// Per-route role guards. Anything not listed here is open to all roles.
const ROUTE_ROLES = {
  'users':         ['admin'],
  'workers':       ['admin'],
  'vendors':       ['admin'],
  'disputes':      ['admin'],
  'audit':         ['admin'],
  'analytics':     ['admin'],
  'site-content':  ['admin'],
  'emails':        ['admin'],
  'gallery':       ['admin'],
  'platform':      ['admin'],
  'admin-team':    ['admin'],
  'broadcast':     ['admin'],
  'notif-rules':   ['admin'],
  'gigs':          ['admin', 'vendor'],
  'venues':        ['admin', 'vendor'],
  'build-team':    ['admin', 'vendor'],
  'gig-posts':     ['worker'],
  'my-gigs':       ['worker'],
};

function Forbidden({ setRoute }) {
  return (
    <div className="content">
      <Empty icon={window.Icons.ShieldAlert || window.Icons.AlertTriangle}
        title="You don't have access to this page"
        body="Try one of the items in the sidebar instead."
        cta={<button className="btn btn-coral" onClick={() => setRoute('dashboard')}>Back to dashboard</button>} />
    </div>
  );
}

function ScreenRouter({ role, route, baseRoute, setRoute, currentUser, tweaks }) {
  // Route-level role guard — block direct URL access to off-role screens.
  const allowed = ROUTE_ROLES[baseRoute];
  if (allowed && !allowed.includes(role)) return <Forbidden setRoute={setRoute} />;

  // event detail
  if (route.startsWith('events:')) {
    const id = route.split(':')[1];
    return <PageEventDetail eventId={id} role={role} currentUser={currentUser} setRoute={setRoute} />;
  }

  // dashboard
  if (baseRoute === 'dashboard') {
    if (role === 'admin')  return <DashboardAdmin user={currentUser}  setRoute={setRoute} statStrip={tweaks.statStrip} statAnim={tweaks.statAnim} />;
    if (role === 'vendor') return <DashboardVendor user={currentUser} setRoute={setRoute} statStrip={tweaks.statStrip} statAnim={tweaks.statAnim} />;
    return <DashboardWorker user={currentUser} setRoute={setRoute} statStrip={tweaks.statStrip} statAnim={tweaks.statAnim} />;
  }

  // events
  if (baseRoute === 'events') {
    if (role === 'worker') return <PageEventsWorker setRoute={setRoute} />;
    return <PageEventsVendor user={currentUser} role={role} setRoute={setRoute} viewMode={tweaks.eventsView} />;
  }

  // gigs (vendor + admin)
  if (baseRoute === 'gigs') return <PageGigsVendor user={currentUser} role={role} setRoute={setRoute} />;
  // worker variants
  if (baseRoute === 'gig-posts') return <PageGigPostsWorker setRoute={setRoute} currentUser={currentUser} />;
  if (baseRoute === 'my-gigs')   return <PageMyGigsWorker currentUser={currentUser} />;

  // directories
  const parts = route.split(':');
  const subId = parts[1];
  const subAction = parts[2];
  if (baseRoute === 'users')   return <PageDirectory title="Users"   filter={u => u.role !== 'admin'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'workers') return <PageDirectory title="Workers" filter={u => u.role === 'worker'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'vendors') return <PageDirectory title="Vendors" filter={u => u.role === 'vendor'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'venues')  return <PageVenues />;

  if (baseRoute === 'payments') return <PagePayments role={role} currentUser={currentUser} setRoute={setRoute} openId={subId} />;
  if (baseRoute === 'disputes') return <PageDisputes />;
  if (baseRoute === 'inbox')    return <PageInbox currentUser={currentUser} />;
  if (baseRoute === 'notifications') return <PageNotificationCenter setRoute={setRoute} role={role} currentUser={currentUser} />;
  if (baseRoute === 'build-team')    return <PageBuildTeam currentUser={currentUser} />;
  if (baseRoute === 'admin-team')    return <PageAdminAssistants />;
  if (baseRoute === 'broadcast')     return <PageBroadcast />;
  if (baseRoute === 'notif-rules')   return <PageNotificationRules />;
  if (baseRoute === 'settings') return <PageSettings role={role} currentUser={currentUser} />;
  if (baseRoute === 'audit')    return <PageAudit />;
  if (baseRoute === 'analytics')return <PageAnalytics />;
  if (baseRoute === 'site-content') return <PageSiteContent />;
  if (baseRoute === 'emails')   return <PageEmails />;
  if (baseRoute === 'gallery')  return <PageGallery />;
  if (baseRoute === 'platform') return <PagePlatformSettings />;

  return <div className="content"><Empty title={`No ${baseRoute} screen yet`} body="Try a different sidebar item." /></div>;
}

// Hydrate from Supabase, mount React, then open the realtime channel so other
// tabs / direct DB writes propagate to the UI without a refresh.
// Mount the UI no later than 3s even if Supabase is slow / unreachable —
// the seed data already loaded in data.jsx is always available as fallback.
(async () => {
  try {
    if (typeof window.bootRosyFromSupabase === 'function') {
      await Promise.race([
        window.bootRosyFromSupabase(),
        new Promise(r => setTimeout(() => { console.warn('[boot] Supabase hydration > 3s, mounting on seed.'); r(null); }, 3000)),
      ]);
    }
  } catch (e) { console.warn('Supabase hydration error:', e); }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  if (typeof window.subscribeRealtime === 'function') {
    try { window.subscribeRealtime(); } catch (e) { console.warn('Realtime subscribe error:', e); }
  }
})();

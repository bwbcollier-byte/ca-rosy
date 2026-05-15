/* Main App — role switcher, hash router, screen mounting */

const { useState: A_us, useEffect: A_ue } = React;
const AI = window.Icons;
const AD = window.RosyData;

function App() {
  // Top-level mode: marketing | auth | onboarding | app
  const initial = (() => {
    const h = window.location.hash.replace(/^#/, '');
    if (h.startsWith('marketing')) return 'marketing';
    if (h.startsWith('auth') || h.startsWith('login') || h.startsWith('signup')) return 'auth';
    if (h.startsWith('onboarding')) return 'onboarding';
    return 'app';
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
  const [tweaksOpen, setTweaksOpen] = A_us(true);
  const [tourOpen, setTourOpen] = A_us(false);
  const [tweaks, setTweak] = useTweaks();

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

  // Tweaks edit mode bridge
  A_ue(() => {
    const onMsg = (e) => {
      if (e.data && e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data && e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

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
    return (
      <ToastHost>
        <AuthPage mode={authMode} setMode={setAuthMode} goToApp={() => setMode('onboarding')} />
      </ToastHost>
    );
  }
  if (mode === 'onboarding') {
    return (
      <ToastHost>
        <OnboardingPage onComplete={() => { setMode('app'); setTourOpen(true); }} />
      </ToastHost>
    );
  }

  // ---------- App mode ----------
  const currentUser = role === 'admin' ? AD.USERS.find(u => u.id === 'u2')
                    : role === 'vendor' ? AD.USERS.find(u => u.id === 'u1')
                    : AD.USERS.find(u => u.id === 'u3');

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
  const title = titleMap[baseRoute] || 'Rosy Recruits';

  const handleSignOut = () => { setMode('marketing'); };

  return (
    <ToastHost>
      <div className={`app-shell`}>
        <Sidebar role={role} route={baseRoute} setRoute={setRoute}
          sidebarStyle={tweaks.sidebarStyle} dark={tweaks.sidebarDark} />
        <div className="main">
          <AppHeader title={title} role={role} setRole={(r) => { setRole(r); setRoute('dashboard'); }}
            onSignOut={handleSignOut} onBell={() => setRoute('notifications')} currentUser={currentUser} setRoute={setRoute} />
          <ScreenRouter role={role} route={route} baseRoute={baseRoute} setRoute={setRoute}
            currentUser={currentUser} tweaks={tweaks} />
        </div>
        <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} setRoute={setRoute} />
        {tourOpen ? <Walkthrough role={role} onClose={() => setTourOpen(false)} setRoute={setRoute} /> : null}
        {tweaksOpen ? <TweaksPanel tweaks={tweaks} set={setTweak} onClose={() => { setTweaksOpen(false); window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); }} /> : null}
        <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 350, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('marketing')} style={{ background: 'var(--color-canvas)' }}><AI.Sparkles size={13} />Marketing site</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAuthMode('login'); setMode('auth'); }} style={{ background: 'var(--color-canvas)' }}>Auth pages</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('onboarding')} style={{ background: 'var(--color-canvas)' }}>Onboarding</button>
        </div>
      </div>
    </ToastHost>
  );
}

function ScreenRouter({ role, route, baseRoute, setRoute, currentUser, tweaks }) {
  // event detail
  if (route.startsWith('events:')) {
    const id = route.split(':')[1];
    return <PageEventDetail eventId={id} role={role} setRoute={setRoute} />;
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
    return <PageEventsVendor user={currentUser} setRoute={setRoute} viewMode={tweaks.eventsView} />;
  }

  // gigs (vendor + admin)
  if (baseRoute === 'gigs') return <PageGigsVendor setRoute={setRoute} />;
  // worker variants
  if (baseRoute === 'gig-posts') return <PageGigPostsWorker setRoute={setRoute} currentUser={currentUser} />;
  if (baseRoute === 'my-gigs')   return <PageMyGigsWorker currentUser={currentUser} />;

  // directories
  if (baseRoute === 'users')   return <PageDirectory title="Users"   filter={u => u.role !== 'admin'} role={role} />;
  if (baseRoute === 'workers') return <PageDirectory title="Workers" filter={u => u.role === 'worker'} role={role} />;
  if (baseRoute === 'vendors') return <PageDirectory title="Vendors" filter={u => u.role === 'vendor'} role={role} />;
  if (baseRoute === 'venues')  return <PageVenues />;

  if (baseRoute === 'payments') return <PagePayments role={role} currentUser={currentUser} />;
  if (baseRoute === 'disputes') return <PageDisputes />;
  if (baseRoute === 'inbox')    return <PageInbox />;
  if (baseRoute === 'notifications') return <PageNotificationCenter setRoute={setRoute} role={role} />;
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
  if (baseRoute === 'logout')   return <div className="content"><Empty icon={AI.LogOut} title="Logging you out…" body="Returning to the marketing site." /></div>;

  return <div className="content"><Empty title={`No ${baseRoute} screen yet`} body="Try a different sidebar item." /></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

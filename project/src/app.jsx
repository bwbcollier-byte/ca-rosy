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
  const [tweaks] = useTweaks();

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

  const handleSignOut = () => { setMode('marketing'); };

  return (
    <ToastHost>
      <div className={`app-shell`}>
        <Sidebar role={role} route={baseRoute} setRoute={setRoute}
          sidebarStyle={tweaks.sidebarStyle} dark={tweaks.sidebarDark} />
        <div className="main">
          <AppHeader title={title} role={role} setRole={(r) => { setRole(r); setRoute('dashboard'); }}
            onSignOut={handleSignOut} onBell={() => setRoute('notifications')} currentUser={currentUser} setRoute={setRoute}
            breadcrumbs={breadcrumbs} />
          <ScreenRouter role={role} route={route} baseRoute={baseRoute} setRoute={setRoute}
            currentUser={currentUser} tweaks={tweaks} />
        </div>
        <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} setRoute={setRoute} />
        {tourOpen ? <Walkthrough role={role} onClose={() => setTourOpen(false)} setRoute={setRoute} /> : null}
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
  const parts = route.split(':');
  const subId = parts[1];
  const subAction = parts[2];
  if (baseRoute === 'users')   return <PageDirectory title="Users"   filter={u => u.role !== 'admin'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'workers') return <PageDirectory title="Workers" filter={u => u.role === 'worker'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'vendors') return <PageDirectory title="Vendors" filter={u => u.role === 'vendor'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} />;
  if (baseRoute === 'venues')  return <PageVenues />;

  if (baseRoute === 'payments') return <PagePayments role={role} currentUser={currentUser} setRoute={setRoute} openId={subId} />;
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

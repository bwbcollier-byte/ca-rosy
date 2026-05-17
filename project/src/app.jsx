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
  // Profile from rr_profiles for the signed-in user (verified, role, etc).
  // Set by routeForSession so we don't depend on RosyData.USERS being fresh.
  const [profileFromDb, setProfileFromDb] = A_us(null);
  A_ue(() => {
    if (!window.sb) return;
    // Decide where a signed-in user should land: dashboard if onboarded,
    // onboarding form otherwise. Called on both initial getSession() and on
    // future onAuthStateChange (covers OAuth return flow).
    const routeForSession = async (sess, source) => {
      console.log('[rosy-route]', source, 'session:', !!sess, 'uid:', sess?.user?.id, 'hash:', window.location.hash);
      if (!sess?.user?.id) return;
      const uid = sess.user.id;
      const h = window.location.hash.replace(/^#/, '');
      const explicitApp = h.startsWith('app/') || h === 'app';
      const explicitOnb = h.startsWith('onboarding');
      try {
        let { data, error } = await window.sb.from('rr_profiles').select('onboarding_complete, role, verified').eq('id', uid).maybeSingle();
        console.log('[rosy-route] profile lookup:', { data, error });
        // First-time OAuth user: no row exists yet. Insert one so the
        // verification gate has somewhere to read from.
        if (!data) {
          const email = sess.user.email || null;
          const meta = sess.user.user_metadata || {};
          const firstName = meta.given_name || meta.first_name || (meta.full_name || '').split(' ')[0] || null;
          const lastName  = meta.family_name || meta.last_name || (meta.full_name || '').split(' ').slice(1).join(' ') || null;
          const avatar    = meta.avatar_url || meta.picture || null;
          try {
            await window.sb.from('rr_profiles').insert({
              id: uid, email, first_name: firstName, last_name: lastName,
              avatar_url: avatar, role: null, onboarding_complete: false, verified: false,
            });
            console.log('[rosy-route] inserted fresh profile row');
          } catch (e) { console.warn('[rosy-route] profile insert failed', e); }
          data = { onboarding_complete: false, role: null, verified: false };
        }
        setProfileFromDb({ ...data, id: uid, email: sess.user.email });
        const onboarded = !!(data?.onboarding_complete && data?.role);
        if (!onboarded) {
          console.log('[rosy-route] → onboarding (no role / not onboarded)');
          setMode('onboarding');
          if (!explicitOnb) window.location.hash = 'onboarding';
        } else {
          console.log('[rosy-route] → app (onboarded)');
          setMode('app');
          if (!explicitApp) window.location.hash = 'app/dashboard';
        }
      } catch (e) {
        console.warn('[rosy-route] failed:', e);
        setMode('app');
        if (!explicitApp) window.location.hash = 'app/dashboard';
      }
    };
    (async () => {
      const href = window.location.href;
      // Implicit-flow OAuth callback: URL fragment contains access_token after
      // our own #app/dashboard hash (double-hash). Supabase's detectSessionInUrl
      // can't parse that, so we manually rewrite the hash to JUST the token
      // section before the SDK reads it.
      const dblHashMatch = window.location.hash.match(/#?access_token=[^#]+/);
      if (dblHashMatch) {
        console.log('[rosy-route] rewriting double-hash for implicit OAuth callback');
        // Replace the entire hash with just the token fragment (without leading slash route).
        const tokenFrag = dblHashMatch[0].replace(/^#/, '');
        window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + tokenFrag);
      }
      // Only call exchangeCodeForSession for PKCE flow (?code= query param).
      const url = new URL(window.location.href);
      const hasPkceCode = url.searchParams.has('code');
      console.log('[rosy-route] boot. hasPkceCode:', hasPkceCode, 'href:', window.location.href);
      if (hasPkceCode && window.sb.auth.exchangeCodeForSession) {
        try {
          const { error } = await window.sb.auth.exchangeCodeForSession(window.location.href);
          if (error) console.warn('[rosy-route] exchange error:', error);
        } catch (e) { console.warn('[rosy-route] exchange failed', e); }
      }
      const { data } = await window.sb.auth.getSession();
      const sess = data?.session || null;
      console.log('[rosy-route] getSession result:', !!sess, sess?.user?.email);
      setSession(sess);
      if (sess) routeForSession(sess, 'getSession');
    })();
    const { data: sub } = window.sb.auth.onAuthStateChange((evt, sess) => {
      console.log('[rosy-route] onAuthStateChange evt:', evt, 'has session:', !!sess);
      setSession(sess);
      if (sess && (evt === 'SIGNED_IN' || evt === 'INITIAL_SESSION' || evt === 'TOKEN_REFRESHED')) routeForSession(sess, 'authStateChange:' + evt);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);
  const [tweaks] = useTweaks();
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
  const sessionUserFromData = sessionUserId ? (window.RosyData?.USERS || []).find(x => x.id === sessionUserId) : null;
  A_ue(() => {
    if (sessionUserFromData && sessionUserFromData.role && sessionUserFromData.role !== role) setRole(sessionUserFromData.role);
  }, [sessionUserId, sessionUserFromData?.role]);

  // Onboarding gate for OAuth (Google) sign-ins: when a fresh session lands us
  // straight on /app/dashboard, check whether the user has a completed profile.
  // If not, bounce them to /onboarding to pick role + finish their profile.
  A_ue(() => {
    if (!sessionUserId || !window.sb) return;
    let cancelled = false;
    (async () => {
      try {
        // ALWAYS check the DB. RosyData may have a stale row (e.g. role set by
        // a Supabase trigger before the user finished onboarding).
        const { data } = await window.sb.from('rr_profiles').select('id, onboarding_complete, role').eq('id', sessionUserId).maybeSingle();
        if (cancelled) return;
        console.log('[rosy-gate] db profile', data);
        if (!data || !data.onboarding_complete || !data.role) {
          console.log('[rosy-gate] forcing onboarding mode');
          setMode('onboarding');
          if (!window.location.hash.startsWith('#onboarding')) window.location.hash = 'onboarding';
        }
      } catch (e) { console.warn('post-auth onboarding gate failed:', e); }
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);
  // Hard-lock: a signed-in user's role can NEVER be changed by the demo role-switcher.
  // setRoleSafe is what the header passes; it silently ignores changes when signed in.
  const setRoleSafe = (newRole) => {
    if (sessionUserId) return;          // signed-in user: ignore
    setRole(newRole);
  };

  // Welcome popup state — sticky modal that survives until the user takes the tour.
  const [welcomeOpen, setWelcomeOpen] = A_us(false);

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
        <OnboardingPage onComplete={async (pickedRole) => {
          // Pin role from the onboarding pick so the user lands on THEIR dashboard, not admin.
          if (pickedRole) setRole(pickedRole);
          // Drop a personal welcome notification so the bell badge lights up immediately AND
          // a row lands in Supabase so a reload still has it.
          const me = sessionUserFromData || { first: '', role: pickedRole, id: sessionUserId };
          const meFirst = me?.first || (me?.name || '').split(' ')[0] || '';
          const niceRole = (me?.role || pickedRole || 'account').replace(/^./, c => c.toUpperCase());
          // Pull title/body from the shared notification template so the platform
          // has a single source of truth (admins can edit it later).
          const tpl = (window.RosyStores?.notificationTemplates || {})['welcome'] || {
            title: `Welcome to Rosy${meFirst ? ', ' + meFirst : ''}!`,
            body:  `Your ${niceRole.toLowerCase()} account is ready. Tap to take a 60-second tour.`,
          };
          const subVars = (s) => (s || '')
            .replace(/\{\{first_name\}\}/g, meFirst)
            .replace(/\{\{role\}\}/g, (me?.role || pickedRole || ''))
            .replace(/\{\{app_url\}\}/g, '');
          const title = subVars(tpl.title);
          const body  = subVars(tpl.body);
          try {
            const list = window.RosyData.NOTIFICATIONS = window.RosyData.NOTIFICATIONS || [];
            list.unshift({
              id: 'welcome_' + Date.now(), type: 'welcome', title, body,
              time: 'Just now', link: '#tour', unread: true, user_id: me?.id,
            });
            window.dispatchEvent(new CustomEvent('rosy:data-changed'));
            if (window.sb && me?.id) {
              await window.sb.from('rr_notifications').insert({
                user_id: me.id, type: 'welcome', title, body, link: '#tour', read: false,
              });
              // Persist profile completion + role + unverified status so the
              // verification gate fires immediately after onboarding.
              try {
                await window.sb.from('rr_profiles').upsert({
                  id: me.id, role: pickedRole, onboarding_complete: true, verified: false,
                }, { onConflict: 'id' });
                // Reflect in-memory too so the gate appears without waiting for hydration
                const u = (window.RosyData.USERS || []).find(x => x.id === me.id);
                if (u) { u.role = pickedRole; u.verified = false; window.dispatchEvent(new CustomEvent('rosy:data-changed')); }
              } catch (e) { console.warn('profile upsert failed:', e); }
            }
          } catch (e) { console.warn('welcome notif failed:', e); }
          setMode('app');
          setRoute('dashboard');
          setWelcomeOpen(true);
        }} />
      </ToastHost>
    );
  }

  // ---------- App mode ----------
  // If signed in, the session user trumps the demo role-switcher.
  // Look up against the LIVE RosyData (not the AD const captured at module
  // load) so brand-new signups get matched after re-hydration.
  let sessionUser = session?.user?.id ? (window.RosyData?.USERS || []).find(u => u.id === session.user.id) : null;
  // Fallback: if RosyData hasn't picked up this user yet (just signed up),
  // synthesise a minimal user object from the DB profile we fetched.
  if (!sessionUser && session?.user?.id && profileFromDb?.id === session.user.id) {
    const fn = profileFromDb.first_name || (session.user.user_metadata?.given_name) || (session.user.email || '').split('@')[0];
    sessionUser = {
      id: session.user.id, email: session.user.email, name: fn,
      first: fn, role: profileFromDb.role || null,
      verified: profileFromDb.verified === true,
      onboarding_complete: !!profileFromDb.onboarding_complete,
      photo: session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url || null,
    };
  }
  const currentUser = sessionUser || (
    role === 'admin'  ? (AD.USERS.find(u => u.id === 'u2') || AD.USERS.find(u => u.role === 'admin'))
  : role === 'vendor' ? (AD.USERS.find(u => u.id === 'u1') || AD.USERS.find(u => u.role === 'vendor'))
  :                     (AD.USERS.find(u => u.id === 'u3') || AD.USERS.find(u => u.role === 'worker'))
  );

  // Hard block: when there's an active session and the URL points at the
  // app, we MUST NOT render the dashboard until we've verified the user's
  // onboarding state. Three sub-cases:
  //   (a) profileFromDb hasn't loaded yet  → loading splash
  //   (b) profile says not onboarded       → onboarding screen
  //   (c) profile says onboarded           → fall through to normal app render
  if (mode === 'app' && sessionUserId) {
    if (!profileFromDb || profileFromDb.id !== sessionUserId) {
      return (
        <ToastHost>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 18, color: 'var(--color-muted)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9999, border: '3px solid var(--color-hairline)', borderTopColor: 'var(--rosy-coral)', animation: 'spin 0.9s linear infinite' }} />
            <p style={{ margin: 0, fontSize: 13.5 }}>Loading your account…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </ToastHost>
      );
    }
    if (!profileFromDb.role || !profileFromDb.onboarding_complete) {
      return (
        <ToastHost>
          <OnboardingPage onComplete={async (pickedRole) => {
            if (pickedRole) setRole(pickedRole);
            try {
              if (window.sb && sessionUserId) {
                await window.sb.from('rr_profiles').upsert({
                  id: sessionUserId, role: pickedRole, onboarding_complete: true, verified: false,
                }, { onConflict: 'id' });
                setProfileFromDb(p => ({ ...(p || {}), role: pickedRole, onboarding_complete: true, verified: false, id: sessionUserId }));
              }
            } catch (e) { console.warn(e); }
            setMode('app');
            setRoute('dashboard');
            window.location.hash = 'app/dashboard';
          }} />
        </ToastHost>
      );
    }
  }
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

  // Verification gate — signed-in non-admins with verified === false see only a pending-approval popup.
  const needsVerification = !!sessionUser && sessionUser.role !== 'admin' && sessionUser.verified !== true;

  return (
    <ToastHost>
      <div className={`app-shell`}>
        <Sidebar role={role} route={baseRoute} setRoute={setRoute}
          onSignOut={handleSignOut} currentUser={currentUser}
          open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          sidebarStyle={tweaks.sidebarStyle} dark={tweaks.sidebarDark} />
        <div className="main">
          <AppHeader title={title} role={role} setRole={(r) => { setRoleSafe(r); setRoute('dashboard'); }}
            onSignOut={handleSignOut} onBell={() => setNotifOpen(true)} currentUser={currentUser} setRoute={setRoute}
            breadcrumbs={breadcrumbs} sessionUser={sessionUser}
            onBurger={() => setSidebarOpen(true)} />
          <ScreenRouter role={role} route={route} baseRoute={baseRoute} setRoute={setRoute}
            currentUser={currentUser} tweaks={tweaks} />
          {role === 'admin' ? <DevNoteButton route={route} currentUser={currentUser} /> : null}
        </div>
        {needsVerification ? (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
               onKeyDown={(e) => e.preventDefault()}>
            <div style={{ width: '100%', maxWidth: 520, background: 'var(--color-canvas)', borderRadius: 24, padding: '36px 36px 32px', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <img src="project/assets/logo.avif" alt="Rosy Recruits" width={72} height={72} style={{ objectFit: 'contain' }} />
              </div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, textAlign: 'center', color: 'var(--color-ink)' }}>Rosy Recruits Application Pending</h2>
              <div style={{ marginTop: 22, background: 'var(--color-surface-soft)', borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: 'none', color: 'var(--rosy-teal, #1ABCB0)', marginTop: 2 }}>
                  <window.Icons.Sparkles size={20} />
                </div>
                <div style={{ flex: 1, fontSize: 14.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
                  <p style={{ margin: 0 }}>We've received your application and are reviewing it now.</p>
                  <p style={{ margin: '14px 0 0' }}>We'll send you an email when we've reached a decision.</p>
                  <p style={{ margin: '14px 0 0' }}>Or you can check back soon!</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} setRoute={setRoute} role={role} />
        {tourOpen ? <Walkthrough role={role} onClose={() => { setTourOpen(false); setWelcomeOpen(false); }} setRoute={setRoute} /> : null}
        {welcomeOpen && !tourOpen ? (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: '100%', maxWidth: 480, background: 'var(--color-canvas)', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--rosy-coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 16 }}>
                <window.Icons.Sparkles size={28} />
              </div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24 }}>Welcome to Rosy{currentUser?.first ? ', ' + currentUser.first : ''}!</h2>
              <p style={{ margin: '12px 0 24px', color: 'var(--color-muted)', fontSize: 14.5 }}>Your {currentUser?.role || 'account'} is ready. Take a quick 60-second tour to see what's possible — we'll show you everything.</p>
              <button className="btn btn-coral btn-lg" style={{ width: '100%' }} onClick={() => setTourOpen(true)}>Take the tour</button>
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
  if (allowed && !allowed.includes(role)) {
    // Worker / vendor only routes — silently bounce to the user's own dashboard rather than Forbidden screen.
    // Admin-only routes stay Forbidden so the user sees that they truly can't access it.
    const adminOnly = allowed.length === 1 && allowed[0] === 'admin';
    if (!adminOnly) { setTimeout(() => setRoute('dashboard'), 0); return null; }
    return <Forbidden setRoute={setRoute} />;
  }

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
    if (role === 'worker') return <PageEventsWorker setRoute={setRoute} currentUser={currentUser} />;
    return <PageEventsVendor user={currentUser} role={role} setRoute={setRoute} viewMode={tweaks.eventsView} />;
  }

  // gigs (vendor + admin)
  if (baseRoute === 'gigs') return <PageGigsVendor user={currentUser} role={role} setRoute={setRoute} />;
  // worker variants
  if (baseRoute === 'gig-posts') return <PageGigPostsWorker setRoute={setRoute} currentUser={currentUser} />;
  if (baseRoute === 'my-gigs')   return <PageMyGigsWorker currentUser={currentUser} setRoute={setRoute} />;

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

/* ---------- Admin dev-note floating button (every page) ---------- */
function DevNoteButton({ route, currentUser }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [savedFlash, setSavedFlash] = React.useState(false);
  const storeKey = 'rosy.devNotes';
  const readNotes = () => { try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch (e) { return []; } };
  const save = () => {
    const entry = { id: 'dn_' + Date.now(), route, author: currentUser?.name || 'admin', body: text.trim(), createdAt: new Date().toISOString() };
    if (!entry.body) { setOpen(false); return; }
    const all = readNotes();
    all.unshift(entry);
    try { localStorage.setItem(storeKey, JSON.stringify(all.slice(0, 500))); } catch (e) {}
    setText(''); setOpen(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Leave a dev note for this page"
        style={{ position: 'fixed', bottom: 20, right: 20, width: 44, height: 44, borderRadius: 9999, border: 0, background: 'var(--color-ink)', color: '#fff', boxShadow: 'var(--shadow-modal)', cursor: 'pointer', zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <window.Icons.StickyNote size={18} />
      </button>
      {savedFlash ? (
        <div style={{ position: 'fixed', bottom: 74, right: 20, background: 'var(--color-ink)', color: '#fff', padding: '8px 12px', borderRadius: 9999, fontSize: 12, zIndex: 350 }}>Saved</div>
      ) : null}
      {open ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setOpen(false)}>
          <div style={{ width: '100%', maxWidth: 520, background: 'var(--color-canvas)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-modal)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Dev note for /{route}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-muted)' }}>Captured for future upgrades. Stored locally and visible only to admins.</p>
            <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs improving here? Bugs, copy, layout, ideas…" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button className="btn-link" onClick={() => { const all = readNotes(); const json = JSON.stringify(all, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'rosy-dev-notes.json'; a.click(); URL.revokeObjectURL(url); }}>Export all ({readNotes().length})</button>
              <button className="btn btn-coral" onClick={save} disabled={!text.trim()}>Save note</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Hydrate from Supabase, mount React, then open the realtime channel so other
// tabs / direct DB writes propagate to the UI without a refresh.
// Mount the UI no later than 3s even if Supabase is slow / unreachable —
// the seed data already loaded in data.jsx is always available as fallback.
(async () => {
  try {
    if (typeof window.bootRosyFromSupabase === 'function') {
      let timeoutId;
      const timeoutPromise = new Promise(r => {
        timeoutId = setTimeout(() => { console.warn('[boot] Supabase hydration > 3s, mounting on seed.'); r(null); }, 3000);
      });
      await Promise.race([
        window.bootRosyFromSupabase().finally(() => clearTimeout(timeoutId)),
        timeoutPromise,
      ]);
    }
  } catch (e) { console.warn('Supabase hydration error:', e); }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  if (typeof window.subscribeRealtime === 'function') {
    try { window.subscribeRealtime(); } catch (e) { console.warn('Realtime subscribe error:', e); }
  }
})();

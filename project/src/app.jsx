/* Main App — role switcher, hash router, screen mounting */

const { useState: A_us, useEffect: A_ue } = React;

// Error boundary — catches any uncaught render error and shows a friendly recovery
// screen instead of white-screening the whole app. Logs to console + sends a
// best-effort report to /api/dev-issue so we hear about it.
class RosyErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    try { console.error('[rosy-boundary]', error, info?.componentStack); } catch (e) {}
    try {
      fetch('/api/dev-issue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Render crash: ' + (error?.message || 'unknown'),
          severity: 'high',
          description: (error?.stack || '') + '\n\nComponent stack:\n' + (info?.componentStack || ''),
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          reporter: 'render-error',
        }),
      }).catch(() => {});
    } catch (e) {}
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--color-canvas)', fontFamily: '-apple-system, Segoe UI, Helvetica, Arial, sans-serif' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌹</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, margin: '0 0 12px', color: '#1F1B16' }}>Something went sideways.</h1>
            <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.55, color: '#6E665D' }}>The page hit an unexpected error. We've sent a report. Try reloading — your data is safe.</p>
            <button onClick={() => window.location.reload()} style={{ background: '#F05A56', color: '#fff', border: 0, padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Reload page</button>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: '#9C948A' }}>Or <a href="#marketing" style={{ color: '#1D5F66' }}>go home</a>.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const AI = window.Icons;
const AD = window.RosyData;

/* Splash shown when mode='app' but profileFromDb isn't ready yet. Retries the
   profile fetch every ~1.5s in the background and surfaces a Reload button
   after 4s so users don't get stuck on an infinite spinner. */
function AccountLoadingSplash({ sessionUserId, session, setProfileFromDb }) {
  const [showStuck, setShowStuck] = A_us(false);
  A_ue(() => { const t = setTimeout(() => setShowStuck(true), 4000); return () => clearTimeout(t); }, []);
  A_ue(() => {
    if (!sessionUserId || !window.sb) return;
    let cancelled = false;
    let attempts = 0;
    const tryFetch = async () => {
      attempts += 1;
      try {
        const { data } = await window.sb.from('rr_profiles').select('onboarding_complete, role, verified, first_name, last_name').eq('id', sessionUserId).maybeSingle();
        if (cancelled) return;
        if (data) {
          setProfileFromDb({ ...data, id: sessionUserId, email: session?.user?.email });
        } else if (attempts < 6) {
          setTimeout(tryFetch, 1500);
        }
      } catch (e) {
        console.warn('[AccountLoadingSplash] retry fetch failed:', e);
        if (!cancelled && attempts < 6) setTimeout(tryFetch, 1500);
      }
    };
    tryFetch();
    return () => { cancelled = true; };
  }, [sessionUserId]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 18, color: 'var(--color-muted)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9999, border: '3px solid var(--color-hairline)', borderTopColor: 'var(--rosy-coral)', animation: 'spin 0.9s linear infinite' }} />
      <p style={{ margin: 0, fontSize: 13.5 }}>Loading your account…</p>
      {showStuck ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted-soft)', textAlign: 'center', maxWidth: 320 }}>This is taking longer than usual. Network slow?</p>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Reload</button>
        </div>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  // Default first view: marketing (unless URL hash explicitly targets another mode)
  const initial = (() => {
    const h = window.location.hash.replace(/^#/, '');
    // Password recovery link from Supabase carries `type=recovery` in the
    // fragment alongside the access_token. Must be checked BEFORE the marketing
    // fallback or the user lands on the marketing page with a stale auth state.
    // Our own one-time reset token (?reset_token=…) — always lands on the
    // reset form regardless of any other hash, because Supabase's redirect
    // allowlist strips custom paths.
    try { if (new URL(window.location.href).searchParams.has('reset_token')) return 'auth'; } catch (e) {}
    if (/type=recovery/.test(window.location.hash)) return 'auth';
    if (h === 'logout' || h === 'app/logout') return 'logout';
    if (h.startsWith('marketing')) return 'marketing';
    if (h.startsWith('auth') || h.startsWith('login') || h.startsWith('signup')) return 'auth';
    if (h.startsWith('onboarding')) return 'onboarding';
    if (h.startsWith('app')) return 'app';
    return 'marketing';
  })();
  const initialAuthMode = (() => {
    try { if (new URL(window.location.href).searchParams.has('reset_token')) return 'reset'; } catch (e) {}
    return /type=recovery/.test(window.location.hash) ? 'reset' : 'login';
  })();
  const initialMarketingSub = (() => {
    const h = window.location.hash.replace(/^#/, '');
    const m = h.match(/^marketing\/(.+)/);
    return m ? m[1] : 'home';
  })();
  const [mode, setMode] = A_us(initial);
  const [authMode, setAuthMode] = A_us(initialAuthMode);
  const [marketingSub, setMarketingSub] = A_us(initialMarketingSub);

  // App-mode state
  const [role, setRole] = A_us('admin');
  // Initialize from the URL hash so a hard refresh on /#app/events:abc keeps
  // the user on the events detail page instead of bouncing back to dashboard.
  // Previously this was hardcoded to 'dashboard' and the hashchange listener
  // didn't fire on initial mount.
  const initialRoute = (() => {
    try {
      const h = window.location.hash.replace(/^#/, '');
      const parts = h.split('/');
      if (parts[0] === 'app' && parts[1]) {
        return parts[2] ? `${parts[1]}:${parts[2]}` : parts[1];
      }
    } catch (e) {}
    return 'dashboard';
  })();
  const [route, setRoute] = A_us(initialRoute);
  const [notifOpen, setNotifOpen] = A_us(false);
  const [tourOpen, setTourOpen] = A_us(false);
  // Auth session — non-null when a user is signed in via Supabase Auth
  const [session, setSession] = A_us(null);
  // True once Supabase's initial getSession() has resolved. Used to gate the
  // app render so the dashboard can't flash before we know whether the user
  // is actually signed in.
  const [authChecked, setAuthChecked] = A_us(false);
  // Profile from rr_profiles for the signed-in user (verified, role, etc).
  // Set by routeForSession so we don't depend on RosyData.USERS being fresh.
  const [profileFromDb, setProfileFromDb] = A_us(null);
  // Set true while handleSignOut is running so other routing effects skip.
  const signingOutRef = React.useRef(false);
  A_ue(() => {
    if (!window.sb) return;
    // Decide where a signed-in user should land: dashboard if onboarded,
    // onboarding form otherwise. Called on both initial getSession() and on
    // future onAuthStateChange (covers OAuth return flow).
    const routeForSession = async (sess, source) => {
      console.log('[rosy-route]', source, 'session:', !!sess, 'uid:', sess?.user?.id, 'hash:', window.location.hash);
      if (!sess?.user?.id) return;
      // Dedupe: Supabase fires SIGNED_IN + INITIAL_SESSION in quick succession
      // on signup/login. Each call awaits a profile fetch — doubling that
      // burns 0.5-1.5s of perceived latency. Skip if we routed the same uid
      // in the last 3 seconds.
      const dedupKey = '__rosyLastRoute_' + sess.user.id;
      const last = window[dedupKey] || 0;
      if (Date.now() - last < 3000 && source !== 'getSession') {
        console.log('[rosy-route] skip — duplicate within 3s');
        return;
      }
      window[dedupKey] = Date.now();
      // Skip routing during logout — handleSignOut owns the transition.
      if (signingOutRef.current || window.location.hash === '#logout' || window.location.hash === '#app/logout') {
        console.log('[rosy-route] skip — logout in progress');
        return;
      }
      const uid = sess.user.id;
      const h = window.location.hash.replace(/^#/, '');
      const explicitApp = h.startsWith('app/') || h === 'app';
      const explicitOnb = h.startsWith('onboarding');
      const explicitMarketing = h.startsWith('marketing');
      const explicitAuth = h.startsWith('auth') || h.startsWith('login') || h.startsWith('signup');
      // If the user explicitly navigated to marketing or auth, honor it — don't
      // force-redirect to onboarding/app even when they have an incomplete profile.
      if (explicitMarketing) { setMode('marketing'); return; }
      if (explicitAuth) { setMode('auth'); return; }
      // Recovery session — Supabase auto-signs the user in when they click the
      // link, but we must keep them on the reset form until they set a new
      // password. Don't bounce them into the app.
      const hasResetToken = (() => { try { return new URL(window.location.href).searchParams.has('reset_token'); } catch (e) { return false; } })();
      if (hasResetToken || /type=recovery/.test(window.location.hash)) {
        setMode('auth');
        setAuthMode('reset');
        return;
      }
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
      // Password recovery flow: Supabase's generate_link returns a URL whose
      // fragment carries `type=recovery` + the access_token. Detect that BEFORE
      // the SDK consumes it so we can route the user to the reset form. We
      // leave the fragment in place — the SDK still needs it to establish the
      // recovery session.
      const isRecoveryLink = /type=recovery/.test(window.location.hash);
      if (isRecoveryLink) {
        console.log('[rosy-route] password recovery link detected — routing to reset form');
        setMode('auth');
        setAuthMode('reset');
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
      setAuthChecked(true);
      if (sess) routeForSession(sess, 'getSession');
    })();
    const { data: sub } = window.sb.auth.onAuthStateChange((evt, sess) => {
      console.log('[rosy-route] onAuthStateChange evt:', evt, 'has session:', !!sess);
      // Supabase fires PASSWORD_RECOVERY when the user opens a recovery link;
      // pin them on the auth shell in reset mode regardless of what mode they
      // were on. They must set a new password before going anywhere else.
      if (evt === 'PASSWORD_RECOVERY') {
        setMode('auth');
        setAuthMode('reset');
      }
      setSession(sess);
      // Stamp lastLogin on actual SIGNED_IN. Sidebar badges fall back to this
      // timestamp to count "new since login". Also seed it once on
      // INITIAL_SESSION so existing tabs get a starting anchor instead of
      // showing the lifetime count.
      if (sess?.user?.id) {
        try {
          const key = `rosy.lastLogin.${sess.user.id}`;
          if (evt === 'SIGNED_IN' || !localStorage.getItem(key)) {
            localStorage.setItem(key, new Date().toISOString());
          }
        } catch (e) {}
      }
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
  // Stash the current user id on RosyData so realtime helpers in supabase_client
  // can pick the right table (base rr_profiles for self, safe view for others).
  if (window.RosyData) window.RosyData.__currentUserId = sessionUserId || null;
  const sessionUserFromData = sessionUserId ? (window.RosyData?.USERS || []).find(x => x.id === sessionUserId) : null;
  A_ue(() => {
    if (sessionUserFromData && sessionUserFromData.role && sessionUserFromData.role !== role) setRole(sessionUserFromData.role);
  }, [sessionUserId, sessionUserFromData?.role]);

  // Live subscription to MY rr_profiles row. Without this, an admin flipping
  // `verified=true` on the user updates the DB but the user's already-loaded
  // `profileFromDb` stays stale — they stay stuck behind the "Application
  // received!" gate until they refresh. The 9-table realtime subscription in
  // supabase_client.jsx refreshes RosyData.USERS but not the gate's state.
  A_ue(() => {
    if (!sessionUserId || !window.sb) return;
    const channel = window.sb
      .channel(`rr_profiles_self_${sessionUserId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rr_profiles', filter: `id=eq.${sessionUserId}` },
        (payload) => {
          if (!payload?.new) return;
          setProfileFromDb(p => ({ ...(p || {}), ...payload.new }));
        })
      .subscribe();
    return () => { try { window.sb.removeChannel(channel); } catch (e) {} };
  }, [sessionUserId]);

  // Onboarding gate for OAuth (Google) sign-ins: when a fresh session lands us
  // straight on /app/dashboard, check whether the user has a completed profile.
  // If not, bounce them to /onboarding to pick role + finish their profile.
  A_ue(() => {
    if (!sessionUserId || !window.sb) return;
    if (signingOutRef.current) return;
    if (window.location.hash === '#logout' || window.location.hash === '#app/logout') return;
    // Honor explicit marketing/auth navigation — a signed-in but not-onboarded
    // user is still allowed to view marketing pages or the auth screen.
    if (window.location.hash.startsWith('#marketing') || window.location.hash.startsWith('#auth') || window.location.hash.startsWith('#login') || window.location.hash.startsWith('#signup')) return;
    let cancelled = false;
    (async () => {
      try {
        // ALWAYS check the DB. RosyData may have a stale row (e.g. role set by
        // a Supabase trigger before the user finished onboarding).
        const { data } = await window.sb.from('rr_profiles').select('id, onboarding_complete, role').eq('id', sessionUserId).maybeSingle();
        if (cancelled || signingOutRef.current) return;
        console.log('[rosy-gate] db profile', data);
        if (!data || !data.onboarding_complete || !data.role) {
          // Re-check hash here in case user navigated to marketing while the
          // DB fetch was in flight.
          if (window.location.hash.startsWith('#marketing') || window.location.hash.startsWith('#auth')) return;
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
  // Shown after Stripe Connect onboarding returns the user to /#app/dashboard?stripe=connected.
  const [stripeConnectedOpen, setStripeConnectedOpen] = A_us(false);

  // Hash router for app routes
  A_ue(() => {
    const onHash = () => {
      // Strip any ?query=string from the hash before parsing so Stripe Connect
      // return URLs like /#app/dashboard?stripe=connected don't break the
      // route parser (it would otherwise treat "dashboard?stripe=connected"
      // as an unknown route).
      const fullHash = window.location.hash.replace(/^#/, '');
      const queryIdx = fullHash.indexOf('?');
      const h = queryIdx >= 0 ? fullHash.slice(0, queryIdx) : fullHash;
      const search = queryIdx >= 0 ? new URLSearchParams(fullHash.slice(queryIdx + 1)) : null;
      if (!h) return;
      const [m, r, sub] = h.split('/');
      if (['marketing','auth','onboarding','app','logout'].includes(m)) setMode(m);
      if (m === 'marketing' && r) setMarketingSub(r);
      else if (m === 'marketing' && !r) setMarketingSub('home');
      if (m === 'app' && r) setRoute(sub ? `${r}:${sub}` : r);
      // Stripe Connect return — show the celebration modal + clean the URL so
      // a refresh doesn't loop back. New-event prompt fires from the modal.
      if (search?.get('stripe') === 'connected') {
        setStripeConnectedOpen(true);
        try { window.history.replaceState(null, '', window.location.pathname + '#' + h); } catch (e) {}
      }
    };
    onHash(); // Run once on mount so a fresh page-load (not just hashchange) parses queries.
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

  // ============================================================
  // LOGOUT — hoisted ABOVE every early return so the splash can't orphan.
  // Runs when mode === 'logout' or route === 'logout'. Hard escape at 3s.
  // ============================================================
  A_ue(() => {
    const isLogout = mode === 'logout' || (mode === 'app' && route === 'logout');
    if (!isLogout) return;
    signingOutRef.current = true;
    console.log('[logout] starting');
    let escapeFired = false;
    const escape = setTimeout(() => {
      escapeFired = true;
      console.warn('[logout] hard escape — forcing reload to marketing');
      try {
        Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}
      window.location.replace(window.location.pathname + '#marketing');
      setTimeout(() => window.location.reload(), 50);
    }, 2500);
    (async () => {
      const timed = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r({ timedOut: true }), ms))]);
      try {
        if (window.sb) {
          const result = await timed(window.sb.auth.signOut(), 1200);
          if (result && result.timedOut) console.warn('[logout] signOut timed out — proceeding with local clear');
        }
      } catch (e) { console.warn('[logout] signOut error:', e); }
      if (escapeFired) return;
      // Local clear regardless of signOut outcome.
      try {
        Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}
      clearTimeout(escape);
      setSession(null);
      setProfileFromDb(null);
      setRole('admin');
      setRoute('dashboard');
      setMarketingSub('home');
      try { window.location.hash = 'marketing'; } catch (e) {}
      setMode('marketing');
      setTimeout(() => { signingOutRef.current = false; }, 100);
      console.log('[logout] complete');
    })();
    return () => { clearTimeout(escape); };
  }, [mode, route]);

  // ---------- Mode switches ----------
  if (mode === 'marketing') {
    return (
      <ToastHost>
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
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
    // `justSignedUp` shortcuts straight to onboarding — we know a brand-new
    // account hasn't onboarded yet and the two DB lookups (~500ms-2s combined)
    // add nothing but lag. Login flow keeps the full check.
    const goToApp = async ({ justSignedUp = false } = {}) => {
      if (justSignedUp) { setMode('onboarding'); return; }
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
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        <AuthPage mode={authMode} setMode={setAuthMode} goToApp={goToApp} />
      </ToastHost>
    );
  }
  if (mode === 'onboarding') {
    return (
      <ToastHost>
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        <OnboardingPage onComplete={async (pickedRole, formData) => {
          // Pin role from the onboarding pick so the user lands on THEIR dashboard, not admin.
          if (pickedRole) setRole(pickedRole);
          // Optimistically mark the profile complete. verified stays false —
          // admin reviews + approves before the user can use the app.
          setProfileFromDb(p => ({ ...(p || {}), role: pickedRole, onboarding_complete: true, verified: false, id: sessionUserId }));
          // FLIP THE SCREEN IMMEDIATELY — DB writes happen in background below so the
          // Continue button doesn't sit at "Saving…" while large data-URL photo + signature
          // bytes upload to Supabase + Postmark sends the welcome email.
          setMode('app');
          setRoute('dashboard');
          setWelcomeOpen(true);
          const me = sessionUserFromData || { first: formData?.first || '', role: pickedRole, id: sessionUserId };
          const meFirst = (formData?.first) || me?.first || (me?.name || '').split(' ')[0] || '';
          // Bound any single DB await to 8s — if Supabase stalls we don't trap the UI.
          const timed = (p, ms = 8000) => Promise.race([p, new Promise(r => setTimeout(() => r({ timedOut: true }), ms))]);
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
              // Fire-and-forget — none of this should block the UI from advancing.
              timed(window.sb.from('rr_notifications').insert({
                user_id: me.id, type: 'welcome', title, body, link: '#tour', read: false,
              }));
              // Persist profile completion + role + onboarding form data so the
              // verification gate fires immediately AND the user's name/photo/bio show up.
              try {
                // Parse "Street, City, State ZIP" address strings if we have a free-text address.
                const addr = (formData?.address || '').trim();
                // Prefer Google Places structured fields (set by AddressInput when the
                // user selects a suggestion). Fall back to a permissive comma-split for
                // free-typed addresses.
                let street = null, cityVal = null, stateVal = null, zipVal = null;
                if (formData?.addressParts) {
                  street   = formData.addressParts.street || null;
                  cityVal  = formData.addressParts.city   || null;
                  stateVal = formData.addressParts.state  || null;
                  zipVal   = formData.addressParts.zip    || null;
                } else if (addr) {
                  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
                  const tail = parts[parts.length - 1] || '';
                  const stZipMatch = tail.match(/^([A-Z]{2})\s+(\d{4,6})$/i) || tail.match(/^([A-Z]{2})$/i);
                  if (stZipMatch) {
                    stateVal = stZipMatch[1].toUpperCase();
                    zipVal = stZipMatch[2] || null;
                    if (parts.length >= 3) { street = parts.slice(0, -2).join(', '); cityVal = parts[parts.length - 2]; }
                    else if (parts.length === 2) { cityVal = parts[0]; }
                  } else if (parts.length === 1) {
                    cityVal = parts[0];
                  } else {
                    street = parts.slice(0, -1).join(', ');
                    cityVal = parts[parts.length - 1];
                  }
                }
                // rr_profiles row already exists (created by rr_handle_new_user trigger).
                // UPDATE rather than UPSERT — UPSERT fails the NOT-NULL check on email
                // before the conflict can redirect to the update path.
                const terms = formData?.terms || null;
                const profilePayload = {
                  // verified stays false on signup — admin reviews + flips it true.
                  role: pickedRole, onboarding_complete: true, verified: false,
                  first_name: formData?.first || null,
                  last_name:  formData?.last  || null,
                  phone:      formData?.phone || null,
                  title:      formData?.title || null,
                  bio:        formData?.bio   || null,
                  avatar_url: formData?.photo || null,
                  street, city: cityVal, state: stateVal, zip: zipVal,
                  geo_address: addr || null,
                  terms_accepted: !!terms,
                  terms_accepted_at: terms?.termsAcceptedAt || null,
                  vendor_signature_url: pickedRole === 'vendor' ? (terms?.signatureUrl || null) : null,
                  worker_signature_url: pickedRole === 'worker' ? (terms?.signatureUrl || null) : null,
                  w9_signature_url:     pickedRole === 'worker' ? (terms?.signatureUrl || null) : null,
                  w9_completed:         pickedRole === 'worker' ? !!terms?.w9 : false,
                  w9_data:              pickedRole === 'worker' ? (terms?.w9 || null) : null,
                };
                // Fire-and-forget — the UI has already advanced to /app/dashboard above.
                // We use timed() to keep the awaits bounded and report errors via console
                // without blocking on Supabase / network stalls.
                timed(window.sb.from('rr_profiles').update(profilePayload).eq('id', me.id)).then(r => { if (r?.error) console.warn('rr_profiles update failed:', r.error.message); else if (r?.timedOut) console.warn('rr_profiles update timed out'); });

                // Vendor-specific profile row.
                if (pickedRole === 'vendor') {
                  const vendorPayload = {
                    id: me.id,
                    company_name: formData?.company || null,
                    business_description: formData?.bio || null,
                    business_phone: formData?.phone || null,
                    business_address: addr || null,
                    logo_url: formData?.photo || null,
                    service_categories: Array.isArray(formData?.services) && formData.services.length ? formData.services : null,
                    show_business_hours: !!formData?.hours,
                    business_hours: formData?.hours && formData?.dayHours ? formData.dayHours : null,
                  };
                  timed(window.sb.from('rr_vendor_profiles').upsert(vendorPayload, { onConflict: 'id' })).then(r => { if (r?.error) console.warn('rr_vendor_profiles upsert failed:', r.error.message); else if (r?.timedOut) console.warn('rr_vendor_profiles upsert timed out'); });
                }
                if (pickedRole === 'worker') {
                  // Combine the home base + any temporary travel addresses the
                  // worker added during onboarding. Each travel row carries its
                  // own start/end date so vendor matching can use them later.
                  const homeAddr = addr ? [{
                    id: 'addr_home', label: 'Home',
                    address: addr,
                    city: cityVal || '', state: stateVal || '', country: formData?.addressParts?.country || '',
                    lat: formData?.addressLatLng?.lat ?? null,
                    lng: formData?.addressLatLng?.lng ?? null,
                    start_date: null, end_date: null, is_default: true,
                  }] : [];
                  const travel = Array.isArray(formData?.travelAddresses) ? formData.travelAddresses : [];
                  const travelRows = travel.filter(t => t.address?.trim()).map(t => ({
                    id: t.id || ('t_' + Math.random().toString(36).slice(2, 8)),
                    label: 'Travel',
                    address: t.address.trim(),
                    city:    t.addressParts?.city    || '',
                    state:   t.addressParts?.state   || '',
                    country: t.addressParts?.country || '',
                    lat:     t.addressLatLng?.lat ?? null,
                    lng:     t.addressLatLng?.lng ?? null,
                    start_date: t.start_date || null,
                    end_date:   t.end_date   || null,
                    is_default: false,
                  }));
                  const addresses = [...homeAddr, ...travelRows];
                  const workerPayload = {
                    id: me.id,
                    services: Array.isArray(formData?.services) && formData.services.length ? formData.services : null,
                    addresses: addresses.length ? addresses : null,
                  };
                  timed(window.sb.from('rr_worker_profiles').upsert(workerPayload, { onConflict: 'id' })).then(r => { if (r?.error) console.warn('rr_worker_profiles upsert failed:', r.error.message); else if (r?.timedOut) console.warn('rr_worker_profiles upsert timed out'); });
                }

                // Reflect in-memory too so the gate + admin view see the new data without waiting for hydration
                const u = (window.RosyData.USERS || []).find(x => x.id === me.id);
                if (u) {
                  u.role = pickedRole; u.verified = false;
                  if (formData?.first) u.first = formData.first;
                  if (formData?.last)  u.last  = formData.last;
                  if (formData?.first || formData?.last) u.name = `${formData.first || ''} ${formData.last || ''}`.trim();
                  if (formData?.photo) u.photo = formData.photo;
                  if (formData?.phone) u.phone = formData.phone;
                  if (formData?.bio)   u.bio   = formData.bio;
                  if (formData?.company) u.company = formData.company;
                  window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                }
              } catch (e) { console.warn('profile upsert failed:', e); }
              // Send Postmark welcome email — fire-and-forget so a slow Postmark call
              // can't block the user behind "Saving…".
              try {
                const slug = pickedRole === 'vendor' ? 'welcome-vendor' : 'welcome-worker';
                if (window.RosySendEmail) {
                  window.RosySendEmail({
                    slug,
                    to: me.email,
                    vars: { first_name: me.first || me.name || 'there', role: pickedRole },
                  }).catch(e => console.warn('welcome email failed:', e));
                }
              } catch (e) { console.warn('welcome email failed:', e); }
            }
          } catch (e) { console.warn('welcome notif failed:', e); }
        }} />
      </ToastHost>
    );
  }

  // Logout splash — brief "Signing you out…" while handleSignOut runs (#logout or #app/logout).
  if (mode === 'logout' || (mode === 'app' && route === 'logout')) {
    return (
      <ToastHost>
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 18, color: 'var(--color-muted)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9999, border: '3px solid var(--color-hairline)', borderTopColor: 'var(--rosy-coral)', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 13.5 }}>Signing you out…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
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

  // Hard block: never render the dashboard until we know who the user is.
  // Cases when mode === 'app':
  //   (a) initial Supabase getSession() hasn't resolved yet → loading splash
  //       (without this, a reload to #app/dashboard flashes the dashboard for
  //       any visitor — including signed-out ones — before the bounce fires)
  //   (b) auth check done + no session → redirect to marketing (user typed a
  //       protected URL while signed out)
  //   (c) profileFromDb hasn't loaded yet → loading splash
  //   (d) profile says not onboarded → onboarding screen
  //   (e) profile says onboarded → fall through to normal app render
  if (mode === 'app' && !authChecked) {
    return (
      <ToastHost>
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 18, color: 'var(--color-muted)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9999, border: '3px solid var(--color-hairline)', borderTopColor: 'var(--rosy-coral)', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 13.5 }}>Loading…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </ToastHost>
    );
  }
  if (mode === 'app' && authChecked && !sessionUserId) {
    // Signed-out user typed a protected URL. Bounce to marketing.
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#marketing') && !window.location.hash.startsWith('#auth')) {
      setTimeout(() => { window.location.hash = 'marketing'; }, 0);
    }
    return (
      <ToastHost>
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-muted)' }}>
          <p style={{ margin: 0, fontSize: 13.5 }}>Redirecting…</p>
        </div>
      </ToastHost>
    );
  }
  if (mode === 'app' && sessionUserId) {
    if (!profileFromDb || profileFromDb.id !== sessionUserId) {
      return (
        <ToastHost>
          {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
          <AccountLoadingSplash sessionUserId={sessionUserId} session={session} setProfileFromDb={setProfileFromDb} />
        </ToastHost>
      );
    }
    if (!profileFromDb.role || !profileFromDb.onboarding_complete) {
      return (
        <ToastHost>
          {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
        {window.DemoModeBanner ? <window.DemoModeBanner /> : null}
          <OnboardingPage onComplete={async (pickedRole, formData) => {
            if (pickedRole) setRole(pickedRole);
            // FLIP THE SCREEN IMMEDIATELY — DB writes happen in background.
            // verified stays false on signup — admin reviews + approves to release.
            setProfileFromDb(p => ({ ...(p || {}), role: pickedRole, onboarding_complete: true, verified: false, id: sessionUserId }));
            setMode('app');
            setRoute('dashboard');
            window.location.hash = 'app/dashboard';
            const timed = (p, ms = 8000) => Promise.race([p, new Promise(r => setTimeout(() => r({ timedOut: true }), ms))]);
            try {
              if (window.sb && sessionUserId) {
                const addr = (formData?.address || '').trim();
                // Prefer Google Places structured fields (set by AddressInput when the
                // user selects a suggestion). Fall back to a permissive comma-split for
                // free-typed addresses.
                let street = null, cityVal = null, stateVal = null, zipVal = null;
                if (formData?.addressParts) {
                  street   = formData.addressParts.street || null;
                  cityVal  = formData.addressParts.city   || null;
                  stateVal = formData.addressParts.state  || null;
                  zipVal   = formData.addressParts.zip    || null;
                } else if (addr) {
                  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
                  const tail = parts[parts.length - 1] || '';
                  const stZipMatch = tail.match(/^([A-Z]{2})\s+(\d{4,6})$/i) || tail.match(/^([A-Z]{2})$/i);
                  if (stZipMatch) {
                    stateVal = stZipMatch[1].toUpperCase();
                    zipVal = stZipMatch[2] || null;
                    if (parts.length >= 3) { street = parts.slice(0, -2).join(', '); cityVal = parts[parts.length - 2]; }
                    else if (parts.length === 2) { cityVal = parts[0]; }
                  } else if (parts.length === 1) {
                    cityVal = parts[0];
                  } else {
                    street = parts.slice(0, -1).join(', ');
                    cityVal = parts[parts.length - 1];
                  }
                }
                const terms = formData?.terms || null;
                timed(window.sb.from('rr_profiles').update({
                  // verified stays false on signup — admin reviews + flips it true.
                  role: pickedRole, onboarding_complete: true, verified: false,
                  first_name: formData?.first || null,
                  last_name:  formData?.last  || null,
                  phone:      formData?.phone || null,
                  title:      formData?.title || null,
                  bio:        formData?.bio   || null,
                  avatar_url: formData?.photo || null,
                  street, city: cityVal, state: stateVal, zip: zipVal,
                  geo_address: addr || null,
                  terms_accepted: !!terms,
                  terms_accepted_at: terms?.termsAcceptedAt || null,
                  vendor_signature_url: pickedRole === 'vendor' ? (terms?.signatureUrl || null) : null,
                  worker_signature_url: pickedRole === 'worker' ? (terms?.signatureUrl || null) : null,
                  w9_signature_url:     pickedRole === 'worker' ? (terms?.signatureUrl || null) : null,
                  w9_completed:         pickedRole === 'worker' ? !!terms?.w9 : false,
                  w9_data:              pickedRole === 'worker' ? (terms?.w9 || null) : null,
                }).eq('id', sessionUserId)).then(r => { if (r?.error) console.warn('rr_profiles update failed:', r.error.message); else if (r?.timedOut) console.warn('rr_profiles update timed out'); });
                if (pickedRole === 'vendor') {
                  timed(window.sb.from('rr_vendor_profiles').upsert({
                    id: sessionUserId,
                    company_name: formData?.company || null,
                    business_description: formData?.bio || null,
                    business_phone: formData?.phone || null,
                    business_address: addr || null,
                    logo_url: formData?.photo || null,
                    service_categories: Array.isArray(formData?.services) && formData.services.length ? formData.services : null,
                    show_business_hours: !!formData?.hours,
                    business_hours: formData?.hours && formData?.dayHours ? formData.dayHours : null,
                  }, { onConflict: 'id' })).then(r => { if (r?.error) console.warn('rr_vendor_profiles upsert failed:', r.error.message); else if (r?.timedOut) console.warn('rr_vendor_profiles upsert timed out'); });
                }
                if (pickedRole === 'worker') {
                  const homeAddr = addr ? [{
                    id: 'addr_home', label: 'Home',
                    address: addr,
                    city: cityVal || '', state: stateVal || '', country: formData?.addressParts?.country || '',
                    lat: formData?.addressLatLng?.lat ?? null,
                    lng: formData?.addressLatLng?.lng ?? null,
                    start_date: null, end_date: null, is_default: true,
                  }] : [];
                  const travel = Array.isArray(formData?.travelAddresses) ? formData.travelAddresses : [];
                  const travelRows = travel.filter(t => t.address?.trim()).map(t => ({
                    id: t.id || ('t_' + Math.random().toString(36).slice(2, 8)),
                    label: 'Travel',
                    address: t.address.trim(),
                    city:    t.addressParts?.city    || '',
                    state:   t.addressParts?.state   || '',
                    country: t.addressParts?.country || '',
                    lat:     t.addressLatLng?.lat ?? null,
                    lng:     t.addressLatLng?.lng ?? null,
                    start_date: t.start_date || null,
                    end_date:   t.end_date   || null,
                    is_default: false,
                  }));
                  const addresses = [...homeAddr, ...travelRows];
                  timed(window.sb.from('rr_worker_profiles').upsert({
                    id: sessionUserId,
                    services: Array.isArray(formData?.services) && formData.services.length ? formData.services : null,
                    addresses: addresses.length ? addresses : null,
                  }, { onConflict: 'id' })).then(r => { if (r?.error) console.warn('rr_worker_profiles upsert failed:', r.error.message); else if (r?.timedOut) console.warn('rr_worker_profiles upsert timed out'); });
                }
              }
            } catch (e) { console.warn(e); }
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
    changelog: 'Change log', help: 'Help & support',
  };
  const baseRoute = route.split(':')[0];
  const subId = route.split(':')[1];
  const title = titleMap[baseRoute] || 'Rosy Recruits';

  const breadcrumbs = (() => {
    if (baseRoute === 'dashboard') return [];
    const root = { label: 'Dashboard', onClick: () => setRoute('dashboard') };
    const section = { label: title, onClick: subId ? () => setRoute(baseRoute) : undefined };
    if (!subId) return [root, section];
    // Default to a truncated id so the breadcrumb doesn't show a full UUID
    // when the data hasn't hydrated yet.
    let leaf = subId && subId.length > 10 ? subId.slice(0, 8) + '…' : subId;
    if (baseRoute === 'events') {
      const ev = (window.RosyData?.EVENTS || []).find(e => e.id === subId);
      if (ev) leaf = ev.name;
    } else if (baseRoute === 'users' || baseRoute === 'workers' || baseRoute === 'vendors') {
      const u = (window.RosyData?.USERS || []).find(x => x.id === subId);
      if (u) leaf = u.name;
    } else if (baseRoute === 'payments') {
      const t = (window.RosyData?.TRANSACTIONS || []).find(x => x.id === subId);
      if (t) leaf = t.invoice;
    }
    return [root, section, { label: leaf }];
  })();

  const handleSignOut = async () => {
    signingOutRef.current = true;
    // Hard escape — if anything below hangs, force a full reload to marketing after 3s.
    const escape = setTimeout(() => {
      console.warn('[logout] hard escape — forcing reload to marketing');
      try {
        Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.') || k === 'rosy.auth' || k.startsWith('rosy.auth')).forEach(k => sessionStorage.removeItem(k));
      } catch (e) {}
      window.location.replace(window.location.pathname + '#marketing');
      setTimeout(() => window.location.reload(), 50);
    }, 3000);
    const minSplash = new Promise(r => setTimeout(r, 400));
    // Bound the signOut call — a stale JWT can hang the server roundtrip indefinitely.
    const timed = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r({ timedOut: true }), ms))]);
    try {
      if (window.sb) {
        const result = await timed(window.sb.auth.signOut(), 1500);
        if (result && result.timedOut) console.warn('signOut timed out — proceeding with local clear');
      }
    } catch (e) { console.warn('signOut error:', e); }
    await minSplash;
    clearTimeout(escape);
    // Hard-clear any Supabase tokens that survived the SDK call so a reload
    // can't re-hydrate the session and bounce us back to onboarding.
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.')).forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.startsWith('sb-') || k.startsWith('supabase.')).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { console.warn('storage clear failed:', e); }
    setSession(null);
    setProfileFromDb(null);
    setRole('admin');     // reset to default demo role for next sign-in
    setRoute('dashboard');
    setMarketingSub('home');
    // Write the hash BEFORE flipping mode so the hash-router doesn't echo #logout back.
    try { window.location.hash = 'marketing'; } catch (e) {}
    setMode('marketing');
    // Release the guard once the transition has settled.
    setTimeout(() => { signingOutRef.current = false; }, 100);
  };

  // URL-based logout is now handled by the hoisted effect above (before early returns).

  // Verification gate — signed-in non-admins with verified === false see only a
  // pending-approval popup. Admin reviews + flips verified=true to release.
  // Source-of-truth check: pull straight from profileFromDb (set on signup +
   // refreshed on every routeForSession). Previously this read from sessionUser,
   // which could fall back to a stale RosyData.USERS entry — for one user that
   // caused the welcome modal to say "Your admin is ready" instead of "worker"
   // and the gate to never fire. profileFromDb.role + verified come directly
   // from rr_profiles.
  const needsVerification = !!sessionUserId
    && !!profileFromDb
    && profileFromDb.id === sessionUserId
    && profileFromDb.role
    && profileFromDb.role !== 'admin'
    && profileFromDb.verified !== true;

  return (
    <ToastHost>
      <div className={`app-shell`} {...(needsVerification ? { inert: '' } : {})} aria-hidden={needsVerification ? 'true' : undefined}>
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
      </div>
      {/* Verification wall — rendered OUTSIDE the app-shell so its inert
          attribute doesn't disable the Log out button. */}
      {needsVerification ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
             onKeyDown={(e) => { if (e.key === 'Escape') e.preventDefault(); }}>
          <div style={{ width: '100%', maxWidth: 520, background: 'var(--color-canvas)', borderRadius: 24, padding: '36px 36px 32px', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <img src="project/assets/logo.avif" alt="Rosy Recruits" width={72} height={72} style={{ objectFit: 'contain' }} />
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, textAlign: 'center', color: 'var(--color-ink)' }}>Application received!</h2>
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
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Log out</button>
            </div>
          </div>
        </div>
      ) : null}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} setRoute={setRoute} role={role} currentUser={currentUser} />
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
            <button className="btn-link" style={{ marginTop: 12, fontSize: 13.5, background: 'transparent', border: 0, color: 'var(--color-muted)', cursor: 'pointer' }} onClick={() => setWelcomeOpen(false)}>Skip for now</button>
          </div>
        </div>
      ) : null}
      {/* Stripe Connect celebration — fires when Stripe returns the user to
          /#app/dashboard?stripe=connected. The hash router detects the query
          flag, opens this modal, and cleans the URL so refresh doesn't loop. */}
      {stripeConnectedOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--color-canvas)', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--color-success, #16a34a)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 16 }}>
              <window.Icons.CheckCircle2 size={32} />
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24 }}>You're connected to Stripe.</h2>
            <p style={{ margin: '12px 0 24px', color: 'var(--color-muted)', fontSize: 14.5 }}>
              {role === 'vendor' ? "Let's make your first event." : "Payouts will land in your bank within 1–2 business days of approved hours."}
            </p>
            {role === 'vendor' ? (
              <button className="btn btn-coral btn-lg" style={{ width: '100%' }} onClick={() => {
                setStripeConnectedOpen(false);
                // Flag picked up by the events page to auto-open the New Event slideover.
                window.__rosyOpenAddEvent = true;
                setRoute('events');
              }}>Create event</button>
            ) : (
              <button className="btn btn-coral btn-lg" style={{ width: '100%' }} onClick={() => { setStripeConnectedOpen(false); setRoute('gig-posts'); }}>Find gigs</button>
            )}
            <button className="btn-link" style={{ marginTop: 12, fontSize: 13.5, background: 'transparent', border: 0, color: 'var(--color-muted)', cursor: 'pointer' }} onClick={() => setStripeConnectedOpen(false)}>Maybe later</button>
          </div>
        </div>
      ) : null}
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
  'changelog':     ['admin'],
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
  if (baseRoute === 'users')   return <PageDirectory title="Users"   filter={u => u.role !== 'admin'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} currentUser={currentUser} />;
  if (baseRoute === 'workers') return <PageDirectory title="Workers" filter={u => u.role === 'worker'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} currentUser={currentUser} />;
  if (baseRoute === 'vendors') return <PageDirectory title="Vendors" filter={u => u.role === 'vendor'} role={role} setRoute={setRoute} openId={subId} openAction={subAction} currentUser={currentUser} />;
  if (baseRoute === 'venues')  return <PageVenues />;

  if (baseRoute === 'payments') return <PagePayments role={role} currentUser={currentUser} setRoute={setRoute} openId={subId} />;
  if (baseRoute === 'disputes') return <PageDisputes />;
  if (baseRoute === 'inbox')    return <PageInbox currentUser={currentUser} />;
  if (baseRoute === 'notifications') return <PageNotificationCenter setRoute={setRoute} role={role} currentUser={currentUser} />;
  if (baseRoute === 'build-team')    return <PageBuildTeam currentUser={currentUser} />;
  if (baseRoute === 'admin-team')    return <PageAdminAssistants />;
  if (baseRoute === 'broadcast')     return <PageBroadcast />;
  if (baseRoute === 'notif-rules')   return <PageNotificationRules />;
  if (baseRoute === 'settings') return <PageSettings role={role} currentUser={currentUser} initialTab={subId} setRoute={setRoute} />;
  if (baseRoute === 'audit')    return <PageAudit />;
  if (baseRoute === 'analytics')return <PageAnalytics />;
  if (baseRoute === 'faqs')         return window.PageFAQs ? <window.PageFAQs /> : null;
  if (baseRoute === 'help')         return window.PageHelpSupport ? <window.PageHelpSupport currentUser={currentUser} /> : null;
  if (baseRoute === 'site-content') return <PageSiteContent />;
  if (baseRoute === 'emails')   return <PageEmails />;
  if (baseRoute === 'gallery')  return <PageGallery />;
  if (baseRoute === 'platform') return <PagePlatformSettings />;
  if (baseRoute === 'changelog') return <PageChangeLog currentUser={currentUser} />;

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
  ReactDOM.createRoot(document.getElementById('root')).render(<RosyErrorBoundary><App /></RosyErrorBoundary>);
  if (typeof window.subscribeRealtime === 'function') {
    try { window.subscribeRealtime(); } catch (e) { console.warn('Realtime subscribe error:', e); }
  }
})();

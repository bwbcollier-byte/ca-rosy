/* Dashboards for admin, vendor, worker */

const SD_D = window.RosyData;
const SD_I = window.Icons;
const { useState: SD_us, useEffect: SD_ue } = React;

/* Re-render dashboards whenever the live data store mutates (Supabase hydrate / realtime). */
function useDataTick() {
  const [, setTick] = SD_us(0);
  SD_ue(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('rosy:data-changed', bump);
    return () => window.removeEventListener('rosy:data-changed', bump);
  }, []);
}

/* Dev-notification submit form — admin reports an issue and it lands in window.RosyData.NOTIFICATIONS
   (and a Supabase row if the rr_notifications table is reachable). */
function DevNotificationModal({ open, onClose, reportedBy }) {
  const toast = useToast();
  const [page, setPage] = SD_us('');
  const [severity, setSeverity] = SD_us('medium');
  const [desc, setDesc] = SD_us('');
  const [screenshot, setScreenshot] = SD_us(null); // dataURL
  const fileRef = React.useRef(null);
  SD_ue(() => { if (open) { setPage(window.location.hash || '#unknown'); setSeverity('medium'); setDesc(''); setScreenshot(null); } }, [open]);
  // Allow paste from clipboard while the modal is open
  SD_ue(() => {
    if (!open) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) {
            const r = new FileReader();
            r.onload = () => setScreenshot(r.result);
            r.readAsDataURL(blob);
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setScreenshot(r.result);
    r.readAsDataURL(f);
  };
  const submit = async () => {
    if (!desc.trim()) { toast.push({ kind: 'warning', title: 'Add a short description' }); return; }
    const sev = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢';
    const entry = {
      id:     'dev_' + Date.now(),
      type:   'dev_issue',
      title:  `${sev} Dev issue · ${page}`,
      body:   desc.trim() + (screenshot ? '\n\n[Screenshot attached]' : ''),
      time:   'Just now',
      link:   page.startsWith('#') ? page : '#' + page,
      unread: true,
      user_id: reportedBy?.id,
      screenshot,
    };
    window.RosyData.NOTIFICATIONS = window.RosyData.NOTIFICATIONS || [];
    window.RosyData.NOTIFICATIONS.unshift(entry);
    window.dispatchEvent(new CustomEvent('rosy:data-changed'));
    // Best-effort persist to Supabase
    try {
      if (window.sb && reportedBy?.id) {
        await window.sb.from('rr_notifications').insert({
          user_id: reportedBy.id,
          type:    'dev_issue',
          title:   entry.title,
          body:    entry.body,
          link:    entry.link,
          read:    false,
        });
      }
    } catch (e) { console.warn('dev notif persist failed:', e); }
    // Best-effort route to Airtable RI Developer Tasks
    // TODO: wire PAT from Vercel env (set window.__AIRTABLE_PAT in index.html or via env injection).
    try {
      const token = window.__AIRTABLE_PAT;
      if (token) {
        // Tasks table id in app6biS7yjV6XzFVG. Replace with actual ID if known —
        // table name also works in the Airtable REST API path.
        const TABLE_ID = window.__AIRTABLE_TASKS_TABLE_ID || 'Tasks';
        const priority = severity === 'high' ? '🔴 High' : severity === 'medium' ? '🟡 Medium' : '🟢 Low';
        await fetch(`https://api.airtable.com/v0/app6biS7yjV6XzFVG/${encodeURIComponent(TABLE_ID)}`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              Title: entry.title,
              Notes: entry.body + (screenshot ? `\n\nScreenshot (data URL truncated): ${String(screenshot).slice(0, 120)}…` : ''),
              Priority: priority,
            },
          }),
        });
      }
    } catch (e) { console.warn('Airtable dev-issue route failed:', e); }
    toast.push({ kind: 'success', title: 'Issue reported', body: 'Logged in your notifications. The team will review.' });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Report a development issue" size="md"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-coral" onClick={submit}>Send report</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label className="field-label">Page / route</label><input className="input" value={page} onChange={(e) => setPage(e.target.value)} placeholder="#app/dashboard" /></div>
        <div><label className="field-label">Severity</label>
          <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">Low — minor polish / copy</option>
            <option value="medium">Medium — bug, not blocking</option>
            <option value="high">High — blocks workflow / data loss</option>
          </select>
        </div>
        <div><label className="field-label">What's wrong?</label><textarea className="textarea" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What did you expect to happen? What actually happened? Steps to reproduce." /></div>
        <div>
          <label className="field-label">Screenshot <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
          {screenshot ? (
            <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
              <img src={screenshot} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, border: '1px solid var(--color-hairline)' }} />
              <button type="button" onClick={() => setScreenshot(null)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 0, width: 24, height: 24, borderRadius: 9999, cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Upload image</button>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>or paste from clipboard (Cmd-V)</span>
            </div>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>This creates a notification you'll see in your inbox bell. We use these to triage the next sprint.</p>
      </div>
    </Modal>
  );
}

function ordinal(n) { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function getDateStrip() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${months[first.getMonth()]} ${ordinal(first.getDate())} ${first.getFullYear()} – ${months[last.getMonth()]} ${ordinal(last.getDate())} ${last.getFullYear()}`;
}

/* Dashboard-level one-time PWA install prompt (dismissible, persists in localStorage).
   Shows on first dashboard load when Chrome's beforeinstallprompt has fired, OR on iOS.
   iOS users get a "Share -> Add to Home Screen" toast instead of the install dialog. */
function DashboardInstallPrompt() {
  const toast = useToast();
  const dismissed = (() => { try { return !!localStorage.getItem('rosy.installPromptDismissed'); } catch (e) { return false; } })();
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const [show, setShow] = SD_us(!dismissed && !installed && (!!window.__pwaInstallEvent || isIOS));
  SD_ue(() => {
    const onCan = () => { if (!dismissed && !installed) setShow(true); };
    window.addEventListener('rosy:pwa-installable', onCan);
    return () => window.removeEventListener('rosy:pwa-installable', onCan);
  }, []);
  const dismiss = () => { try { localStorage.setItem('rosy.installPromptDismissed', '1'); } catch (e) {} setShow(false); };
  const accept = async () => {
    if (window.__pwaInstallEvent) {
      try { window.__pwaInstallEvent.prompt(); await window.__pwaInstallEvent.userChoice; } catch (e) {}
      window.__pwaInstallEvent = null;
    } else if (isIOS) {
      toast.push({ kind: 'info', title: 'Install on iPhone', body: 'Tap Share → Add to Home Screen.' });
    }
    dismiss();
  };
  if (!show) return null;
  return (
    <div className="card" style={{ background: 'var(--rosy-teal-soft)', border: '1px solid var(--rosy-teal-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <SD_I.Download size={20} style={{ color: 'var(--rosy-teal-dark)', flex: 'none' }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Install Rosy Recruits on your home screen</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>{isIOS ? 'Tap Share → Add to Home Screen for one-tap access.' : 'One tap from your phone to open the app.'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
        <button className="btn btn-coral btn-sm" onClick={accept}>Install</button>
      </div>
    </div>
  );
}

function DashboardAdmin({ user, setRoute, statStrip, statAnim }) {
  useDataTick();
  const dateStrip = getDateStrip();
  return (
    <div className="content fade-up">
      <DashboardInstallPrompt />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="greeting">{getGreeting(user?.first)}</h1>
      </div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SD_I.Users}        label="All Workers"    value={3498} delta={6}   dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.UsersRound}   label="Total Workers"  value={1284} delta={4}   dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Building2}    label="All Vendors"    value={412}  delta={12}  dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.UserX}        label="Inactive Users" value={206}  delta={-22} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
      </div>
      <div className="grid-dash">
        <div className="col" style={{ gap: 20 }}>
          <UpcomingEventsCard setRoute={setRoute} />
          <RecentTransactionsCard setRoute={setRoute} />
        </div>
        <NewRecentUsersCard tabs setRoute={setRoute} />
      </div>
    </div>
  );
}

function DashboardVendor({ user, setRoute, statStrip, statAnim }) {
  useDataTick();
  const dateStrip = getDateStrip();
  // Read window.RosyData fresh on every render (Supabase hydrates after first paint)
  const D = window.RosyData || SD_D;
  // Install prompt rendered just below as part of the dashboard content
  const myEvents = user?.id ? (D.EVENTS || []).filter(e => e.vendorId === user.id) : (D.EVENTS || []);
  const openEvents = myEvents.filter(e => e.status === 'open');
  const myEventIds = new Set(myEvents.map(e => e.id));
  const myGigs = (D.GIGS || []).filter(g => myEventIds.has(g.eventId));
  const openGigs = myGigs.filter(g => g.status === 'open');
  const totalSpots = myGigs.reduce((s, g) => s + (g.spots || 0), 0);
  const filledSpots = myGigs.reduce((s, g) => s + (g.spotsFilled || 0), 0);
  const fillRate = totalSpots ? Math.round(filledSpots / totalSpots * 100) : 0;
  const myTx = (D.TRANSACTIONS || []).filter(t => t.payer === user?.company || (user?.name && t.payer.includes(user.name)));
  const monthSpend = myTx.filter(t => t.status === 'Paid').reduce((s, t) => s + t.amount, 0);
  return (
    <div className="content fade-up">
      <DashboardInstallPrompt />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="greeting">{getGreeting(user?.first)}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setRoute('build-team')}><SD_I.Sparkles size={14} />Build my team</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { window.__rosyOpenAddGig = true; setRoute('gigs'); }}><SD_I.Briefcase size={14} />Post a gig</button>
          <button className="btn btn-coral btn-sm" onClick={() => { window.__rosyOpenAddEvent = true; setRoute('events'); }}><SD_I.Plus size={14} />New event</button>
        </div>
      </div>
      <div className="grid-spotlight" style={{ marginBottom: 24 }}>
        <StatCard icon={SD_I.CalendarCheck} label="Open events"  value={openEvents.length} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} primary />
        <StatCard icon={SD_I.Briefcase}     label="Open gigs"    value={openGigs.length}    dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.UsersRound}    label="Crew filled"  value={`${fillRate}%`}     dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.DollarSign}    label="Paid this month" value={monthSpend} prefix="$" dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
      </div>
      <div className="grid-dash">
        <div className="col" style={{ gap: 20 }}>
          <UpcomingEventsCard setRoute={setRoute} vendorId={user?.id} />
          <RecentTransactionsCard vendorScope user={user} setRoute={setRoute} />
        </div>
        <NewRecentUsersCard title="Your team this week" setRoute={setRoute} role="vendor" />
      </div>
    </div>
  );
}

function DashboardWorker({ user, setRoute, statStrip, statAnim }) {
  useDataTick();
  const dateStrip = getDateStrip();
  const D = window.RosyData || SD_D;
  const today = new Date(); today.setHours(0,0,0,0);
  const next30 = new Date(today); next30.setDate(next30.getDate() + 30);
  const myGigs = user?.id ? (D.GIGS || []).filter(g => (g.assignedTo || []).includes(user.id)) : [];
  const upcomingGigs = myGigs.filter(g => { const d = new Date(g.date); return d >= today; });
  const next30Gigs = upcomingGigs.filter(g => { const d = new Date(g.date); return d <= next30; });
  const next30Hours = next30Gigs.reduce((s, g) => {
    const sh = parseInt((g.start || '0:0').split(':')[0]) || 0;
    const eh = parseInt((g.end   || '0:0').split(':')[0]) || 0;
    return s + Math.max(0, (eh - sh + 24) % 24);
  }, 0);
  const myTx = user?.name ? (D.TRANSACTIONS || []).filter(t => t.payee === user.name) : [];
  const lifetimeEarned = myTx.filter(t => t.status === 'Paid').reduce((s, t) => s + t.amount, 0);
  const pendingPay = myTx.filter(t => t.status === 'Pending').reduce((s, t) => s + t.amount, 0);
  const rating = user?.rating || (myTx.length ? 4.85 : '—');
  return (
    <div className="content fade-up">
      <DashboardInstallPrompt />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="greeting">{getGreeting(user?.first)}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setRoute('settings')}><SD_I.Calendar size={14} />Update availability</button>
          <button className="btn btn-coral btn-sm" onClick={() => setRoute('gig-posts')}><SD_I.Search size={14} />Find gigs</button>
        </div>
      </div>
      <div className="grid-spotlight" style={{ marginBottom: 24 }}>
        <StatCard icon={SD_I.DollarSign} label="Lifetime earned" value={lifetimeEarned} prefix="$" dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} primary />
        <StatCard icon={SD_I.Briefcase}  label="Upcoming gigs"   value={upcomingGigs.length} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Clock}      label="Hours next 30 days" value={next30Hours} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Star}       label="Rating"          value={typeof rating === 'number' ? rating.toFixed(2) : rating} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
      </div>
      {pendingPay > 0 ? (
        <div className="card" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div><p style={{ margin: 0, fontWeight: 600, color: 'var(--color-warning)' }}>${pendingPay.toLocaleString()} pending payout</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>Vendor approves hours, Stripe drops it in your bank within 48h.</p></div>
          <button className="btn btn-ghost btn-sm" onClick={() => setRoute('payments')}>View payments</button>
        </div>
      ) : null}
      <div className="grid-dash">
        <div className="col" style={{ gap: 20 }}>
          <UpcomingEventsCard setRoute={setRoute} workerId={user?.id} />
          <RecentTransactionsCard workerScope user={user} setRoute={setRoute} />
        </div>
        <FeaturedGigPostsCard setRoute={setRoute} />
      </div>
    </div>
  );
}

/* ------- Upcoming Events card ------- */
function UpcomingEventsCard({ setRoute, vendorId, workerId }) {
  let events = SD_D.EVENTS.filter(e => e.status !== 'draft' && e.status !== 'completed').slice(0, 3);
  if (vendorId) events = SD_D.EVENTS.filter(e => e.vendorId === vendorId).slice(0, 3);
  if (workerId) {
    const ids = SD_D.GIGS.filter(g => g.assignedTo.includes(workerId)).map(g => g.eventId);
    events = SD_D.EVENTS.filter(e => ids.includes(e.id) && e.status !== 'completed').slice(0, 3);
  }
  return (
    <div className="card card-flush">
      <div className="card-header">
        <h3 className="card-title"><SD_I.Calendar className="icon" />Upcoming Events</h3>
        <button className="btn-link" onClick={() => setRoute('events')}>All Events <SD_I.ChevronRight size={14} style={{ verticalAlign: 'middle' }} /></button>
      </div>
      <div>
        {events.length === 0 ? <Empty icon={SD_I.Calendar} title="No upcoming events" body="When events open, they'll appear here." /> :
         events.map(e => {
           const { day, month } = fmtDate(e.date, 'day-month');
           return (
             <div key={e.id} role="button" tabIndex={0} aria-label={`Open ${e.name}`}
               onClick={() => setRoute('events:' + e.id)}
               onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setRoute('events:' + e.id); } }}
               style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer', transition: 'background 120ms ease' }}
               onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--color-surface-soft)'}
               onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}>
               <div className="date-badge"><div className="day">{day}</div><div className="mon">{month}</div></div>
               <div style={{ flex: 1, minWidth: 0 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                   <h5 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 19, letterSpacing: '-0.01em' }}>{e.name}</h5>
                   <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{e.filledCount}/{e.gigCount} filled</span>
                 </div>
                 <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.desc}</p>
               </div>
               <SD_I.ChevronRight size={16} style={{ color: 'var(--color-muted-soft)', alignSelf: 'center', flex: 'none' }} />
             </div>
           );
         })}
      </div>
    </div>
  );
}

/* ------- Recent transactions card ------- */
function RecentTransactionsCard({ vendorScope, workerScope, setRoute }) {
  let allTxs = SD_D.TRANSACTIONS;
  if (vendorScope) allTxs = SD_D.TRANSACTIONS.filter(t => t.payer.includes('Bloom'));
  if (workerScope) allTxs = SD_D.TRANSACTIONS.filter(t => t.payee === 'Naomi Park' || t.payee === 'Multiple');
  const paged = usePaged(allTxs, 5);
  return (
    <div className="card card-flush">
      <div className="card-header">
        <h3 className="card-title"><SD_I.ShoppingCart className="icon" />Recent Transactions</h3>
        <button className="btn-link" onClick={() => setRoute && setRoute('payments')}>All Transactions <SD_I.ChevronRight size={14} style={{ verticalAlign: 'middle' }} /></button>
      </div>
      <table className="rosy-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.length === 0 ? (
            <tr><td colSpan={4}><Empty icon={SD_I.ShoppingCart} title="No recent transactions" /></td></tr>
          ) : paged.slice.map(t => (
            <tr key={t.id} tabIndex={0} role="button" aria-label={`Open transaction ${t.invoice}`}
                onClick={() => setRoute && setRoute('payments:' + t.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRoute && setRoute('payments:' + t.id); } }}
                style={{ cursor: 'pointer' }}>
              <td style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{t.invoice}</td>
              <td><Badge kind={t.status} /></td>
              <td className="t-mono-amount">{fmtMoney(t.amount)}</td>
              <td style={{ color: 'var(--color-muted)', fontSize: 13 }}>{fmtDate(t.date, 'mdy-dots')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="transactions" />
    </div>
  );
}

/* ------- New & recent users card ------- */
function NewRecentUsersCard({ tabs, title = 'New & Recent', setRoute, role = 'admin' }) {
  const [tab, setTab] = useState('users');
  const toast = useToast();
  const isAdmin = role === 'admin';
  const showWorkers = !tabs || tab === 'users';
  const seed = showWorkers ? SD_D.USERS.filter(u => u.role !== 'admin').slice(0, 6) : SD_D.USERS.filter(u => u.role === 'vendor').slice(0, 6);
  // Tab badge counts — items joined after the last time the user clicked that tab.
  const seenKey = (tabId) => `rosy.tabSeen.${tabId}.${role}`;
  const [seenAt, setSeenAt] = useState(() => ({
    users:    parseInt(localStorage.getItem(seenKey('users')) || '0', 10),
    co:       parseInt(localStorage.getItem(seenKey('co'))    || '0', 10),
  }));
  const countNewSince = (rows, ts) => rows.filter(u => {
    const t = u.joined ? new Date(u.joined).getTime() : 0;
    return t > ts;
  }).length;
  const usersBadge = countNewSince(SD_D.USERS.filter(u => u.role !== 'admin'), seenAt.users);
  const coBadge    = countNewSince(SD_D.USERS.filter(u => u.role === 'vendor'), seenAt.co);
  const markTabSeen = (tabId) => {
    const ts = Date.now();
    localStorage.setItem(seenKey(tabId), String(ts));
    setSeenAt(s => ({ ...s, [tabId]: ts }));
  };
  const [overrides, setOverrides] = useState({});
  const [deleted, setDeleted] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const list = seed.filter(u => !deleted[u.id]).map(u => overrides[u.id] ? { ...u, ...overrides[u.id] } : u);

  const toggleActive = async (u) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), status: next } }));
    // Reflect in the live RosyData store so the change survives navigation
    const liveUser = (window.RosyData?.USERS || []).find(x => x.id === u.id);
    if (liveUser) liveUser.status = next;
    window.dispatchEvent(new CustomEvent('rosy:data-changed'));
    // Persist to Supabase so a refresh keeps the change
    try {
      if (window.sb) {
        const { error } = await window.sb.from('rr_profiles').update({ status: next }).eq('id', u.id);
        if (error) throw error;
      }
    } catch (e) {
      console.warn('status update failed:', e);
      toast.push({ kind: 'error', title: 'Status save failed', body: e.message || 'Try again' });
      // Roll back local override on failure
      setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), status: u.status } }));
      if (liveUser) liveUser.status = u.status;
      window.dispatchEvent(new CustomEvent('rosy:data-changed'));
      return;
    }
    toast.push({ kind: next === 'active' ? 'success' : 'warning', title: `${u.first || u.name} marked ${next}` });
  };
  const confirmDelete = () => {
    const u = list.find(x => x.id === confirmId);
    setDeleted(d => ({ ...d, [confirmId]: true }));
    setConfirmId(null);
    toast.push({ kind: 'info', title: 'Hidden from list', body: `${u?.name || 'User'} hidden from your dashboard list (still active in Users).` });
  };

  return (
    <div className="card card-flush" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title"><SD_I.Users className="icon" />{title}</h3>
          <button className="btn-link" onClick={() => setRoute && setRoute('users')}>All Users</button>
        </div>
        {tabs ? (
          <div className="tabs">
            <button className={tab === 'users' ? 'on' : ''} onClick={() => { setTab('users'); markTabSeen('users'); }}>User Profiles{usersBadge > 0 ? <span style={{ marginLeft: 6, background: 'var(--rosy-coral)', color: '#fff', borderRadius: 9999, padding: '0 6px', fontSize: 10.5, fontWeight: 700 }}>{usersBadge}</span> : null}</button>
            <button className={tab === 'co' ? 'on' : ''} onClick={() => { setTab('co'); markTabSeen('co'); }}>Companies{coBadge > 0 ? <span style={{ marginLeft: 6, background: 'var(--rosy-coral)', color: '#fff', borderRadius: 9999, padding: '0 6px', fontSize: 10.5, fontWeight: 700 }}>{coBadge}</span> : null}</button>
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {list.length === 0 ? <Empty icon={SD_I.Users} title="No new users yet" /> :
         list.map(u => (
           <div key={u.id} role="button" tabIndex={0} aria-label={`Open ${u.name}`}
             onClick={() => setRoute && setRoute('users:' + u.id)}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRoute && setRoute('users:' + u.id); } }}
             style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer', transition: 'background 120ms ease' }}
             onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-soft)'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
             <Avatar name={u.name} size="md" />
             <div style={{ flex: 1, minWidth: 0 }}>
               <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
               <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{u.company}</p>
             </div>
             {isAdmin ? (
               <button onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
                 aria-label={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                 title={u.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                 style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}>
                 <Badge kind={u.status === 'active' ? 'Active' : 'Inactive'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge>
               </button>
             ) : <Badge kind={u.status === 'active' ? 'Active' : 'Inactive'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge>}
             {isAdmin ? (
               <>
                 <button onClick={(e) => { e.stopPropagation(); setConfirmId(u.id); }} className="row-action-btn danger" aria-label="Delete user"><SD_I.Trash2 size={14} /></button>
                 <button onClick={(e) => { e.stopPropagation(); setRoute && setRoute('users:' + u.id + ':edit'); }} className="row-action-btn" aria-label="Edit user"><SD_I.Pencil size={14} /></button>
               </>
             ) : (
               <button onClick={(e) => { e.stopPropagation(); setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${u.first || u.name.split(' ')[0]}` }); }} className="row-action-btn" aria-label={`Message ${u.name}`} title={`Message ${u.name}`}><SD_I.MessageSquare size={14} /></button>
             )}
           </div>
         ))}
      </div>
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} title="Remove this user from the list?" message="They'll be hidden from this card. The full user record is unchanged."
        confirmLabel="Remove" onConfirm={confirmDelete} />
    </div>
  );
}

/* ------- Featured gig posts card (worker) ------- */
function FeaturedGigPostsCard({ setRoute }) {
  const open = SD_D.GIGS.filter(g => g.status === 'open').slice(0, 4);
  return (
    <div className="card card-flush" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <h3 className="card-title"><SD_I.ClipboardList className="icon" />Featured gig posts</h3>
        <button className="btn-link" onClick={() => setRoute('gig-posts')}>Browse all</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {open.map(g => {
          const ev = SD_D.EVENTS.find(e => e.id === g.eventId);
          return (
            <div key={g.id} role="button" tabIndex={0} aria-label={`Open ${ev.name}`}
              onClick={() => setRoute('events:' + ev.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRoute('events:' + ev.id); } }}
              style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', transition: 'background 120ms ease' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-soft)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{ev.name}</p>
                <GigChip type={g.type} />
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>{fmtDate(g.date, 'mdy-dots')} · {g.start}–{g.end} · ${g.rate}/hr</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{g.spots - g.spotsFilled} spot{g.spots - g.spotsFilled === 1 ? '' : 's'} left</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { DashboardAdmin, DashboardVendor, DashboardWorker, DevNotificationModal });

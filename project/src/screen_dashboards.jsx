/* Dashboards for admin, vendor, worker */

const SD_D = window.RosyData;
const SD_I = window.Icons;

function DashboardAdmin({ user, setRoute, statStrip, statAnim }) {
  const dateStrip = 'May 1st 2026 – June 1st 2026';
  return (
    <div className="content fade-up">
      <h1 className="greeting">{getGreeting(user.first)}</h1>
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
  const dateStrip = 'May 1st 2026 – June 1st 2026';
  return (
    <div className="content fade-up">
      <h1 className="greeting">{getGreeting(user.first)}</h1>
      <div className="grid-spotlight" style={{ marginBottom: 24 }}>
        <StatCard icon={SD_I.UserPlus}   label="New Worker Applications" value={18} delta={28}  dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} primary />
        <StatCard icon={SD_I.CalendarCheck} label="Open Events"          value={6}  delta={20}  dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Briefcase}  label="All Gigs"                value={32} delta={9}   dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.ClipboardList} label="Open Gigs"            value={7}  delta={-3}  dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
      </div>
      <div className="grid-dash">
        <div className="col" style={{ gap: 20 }}>
          <UpcomingEventsCard setRoute={setRoute} vendorId="u1" />
          <RecentTransactionsCard vendorScope setRoute={setRoute} />
        </div>
        <NewRecentUsersCard title="Your team this week" setRoute={setRoute} />
      </div>
    </div>
  );
}

function DashboardWorker({ user, setRoute, statStrip, statAnim }) {
  const dateStrip = 'May 1st 2026 – June 1st 2026';
  return (
    <div className="content fade-up">
      <h1 className="greeting">{getGreeting(user.first)}</h1>
      <div className="grid-spotlight" style={{ marginBottom: 24 }}>
        <StatCard icon={SD_I.DollarSign}  label="Earnings"        value={3420} delta={14} prefix="$" dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} primary />
        <StatCard icon={SD_I.Briefcase}   label="Gigs This Month" value={9}    delta={20} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Clock}       label="Hours Worked"    value={84}   delta={11} dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
        <StatCard icon={SD_I.Star}        label="Avg Rating"      value="4.95" dateStrip={dateStrip} showStrip={statStrip} animate={statAnim} />
      </div>
      <div className="grid-dash">
        <div className="col" style={{ gap: 20 }}>
          <UpcomingEventsCard setRoute={setRoute} workerId="u3" />
          <RecentTransactionsCard workerScope setRoute={setRoute} />
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
function NewRecentUsersCard({ tabs, title = 'New & Recent', setRoute }) {
  const [tab, setTab] = useState('users');
  const toast = useToast();
  const showWorkers = !tabs || tab === 'users';
  const seed = showWorkers ? SD_D.USERS.filter(u => u.role !== 'admin').slice(0, 6) : SD_D.USERS.filter(u => u.role === 'vendor').slice(0, 6);
  const [overrides, setOverrides] = useState({});
  const [deleted, setDeleted] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const list = seed.filter(u => !deleted[u.id]).map(u => overrides[u.id] ? { ...u, ...overrides[u.id] } : u);

  const toggleActive = (u) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), status: next } }));
    toast.push({ kind: next === 'active' ? 'success' : 'warning', title: `${u.first} marked ${next}` });
  };
  const confirmDelete = () => {
    const u = list.find(x => x.id === confirmId);
    setDeleted(d => ({ ...d, [confirmId]: true }));
    setConfirmId(null);
    toast.push({ kind: 'warning', title: 'User removed', body: `${u?.name || 'User'} removed from this list.` });
  };

  return (
    <div className="card card-flush" style={{ alignSelf: 'flex-start' }}>
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title"><SD_I.Users className="icon" />{title}</h3>
          <button className="btn-link" onClick={() => setRoute && setRoute('users')}>All Users</button>
        </div>
        {tabs ? (
          <div className="tabs">
            <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>User Profiles</button>
            <button className={tab === 'co' ? 'on' : ''} onClick={() => setTab('co')}>Companies</button>
          </div>
        ) : null}
      </div>
      <div>
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
             <button onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
               aria-label={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
               title={u.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
               style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}>
               <Badge kind={u.status === 'active' ? 'Active' : 'Inactive'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge>
             </button>
             <button onClick={(e) => { e.stopPropagation(); setConfirmId(u.id); }} className="row-action-btn danger" aria-label="Delete user"><SD_I.Trash2 size={14} /></button>
             <button onClick={(e) => { e.stopPropagation(); setRoute && setRoute('users:' + u.id + ':edit'); }} className="row-action-btn" aria-label="Edit user"><SD_I.Pencil size={14} /></button>
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
    <div className="card card-flush" style={{ alignSelf: 'flex-start' }}>
      <div className="card-header">
        <h3 className="card-title"><SD_I.ClipboardList className="icon" />Featured gig posts</h3>
        <button className="btn-link" onClick={() => setRoute('gig-posts')}>Browse all</button>
      </div>
      <div>
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

Object.assign(window, { DashboardAdmin, DashboardVendor, DashboardWorker });

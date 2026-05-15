/* Gig screens: vendor grouped table, worker gig posts, worker my gigs */

const SG_D = window.RosyData;
const SG_I = window.Icons;
const { useState: SG_us } = React;

/* ============ Vendor: grouped Gigs table ============ */
function PageGigsVendor({ setRoute }) {
  const [open, setOpen] = SG_us(SG_D.EVENTS.reduce((acc, e) => ({ ...acc, [e.id]: true }), {}));
  const [addOpen, setAddOpen] = SG_us(false);
  const [search, setSearch] = SG_us('');
  const [statusFilter, setStatusFilter] = SG_us({ open: true, confirmed: true, completed: true });
  const [sortBy, setSortBy] = SG_us('date');
  const [filterOpen, setFilterOpen] = SG_us(false);
  const [selected, setSelected] = SG_us({});
  const toast = useToast();
  const events = SG_D.EVENTS.filter(e => e.status !== 'draft');

  const matchGig = (g) => {
    if (!statusFilter[g.status]) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ev = SG_D.EVENTS.find(e => e.id === g.eventId);
    return [g.type, g.description, ev?.name].some(s => (s || '').toLowerCase().includes(q));
  };

  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SG_I.CalendarCheck} label="All New Events" value={9}   delta={20}  />
        <StatCard icon={SG_I.Calendar}      label="Open Events"    value={6}   delta={20}  />
        <StatCard icon={SG_I.Briefcase}     label="All Gigs"       value={32}  delta={9}   />
        <StatCard icon={SG_I.ClipboardList} label="Open Gigs"      value={7}   delta={-3}  />
      </div>

      <div className="section-heading">
        <h2>Gigs by event</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SG_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search gigs..." style={{ paddingLeft: 36, width: 220, height: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date','By date'],['priority','By priority'],['fill','Least filled']]} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SG_I.Filter size={14} />Filters</button>
          <button className="btn btn-coral" onClick={() => setAddOpen(true)}><SG_I.Plus size={15} />Add Gig</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="rosy-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}><CheckBox checked={false} onChange={() => {}} /></th>
              <th>Gig type & information</th>
              <th>Date</th>
              <th>Available</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned to</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => {
              let gigs = SG_D.GIGS.filter(g => g.eventId === ev.id).filter(matchGig);
              if (sortBy === 'priority') {
                const order = { High: 0, Medium: 1, Low: 2 };
                gigs = [...gigs].sort((a, b) => order[a.priority] - order[b.priority]);
              } else if (sortBy === 'fill') {
                gigs = [...gigs].sort((a, b) => (a.spotsFilled / a.spots) - (b.spotsFilled / b.spots));
              } else {
                gigs = [...gigs].sort((a, b) => new Date(a.date) - new Date(b.date));
              }
              if (gigs.length === 0) return null;
              return (
                <React.Fragment key={ev.id}>
                  <tr className="group-row">
                    <td colSpan={7}>
                      <button onClick={() => setOpen(o => ({ ...o, [ev.id]: !o[ev.id] }))} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', color: 'inherit' }}>
                        {open[ev.id] ? <SG_I.ChevronDown size={14} /> : <SG_I.ChevronRight size={14} />}
                        {ev.name}
                        <span className="t-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12.5 }}>· {fmtDate(ev.date, 'mdy-dots')} · {gigs.filter(g=>g.status==='confirmed').length}/{gigs.length} confirmed</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-link" onClick={() => setRoute('events:' + ev.id)} style={{ fontSize: 12.5 }}>See details <SG_I.ChevronRight size={12} style={{ verticalAlign: 'middle' }} /></button>
                    </td>
                  </tr>
                  {open[ev.id] && gigs.map(g => (
                    <tr key={g.id}>
                      <td><CheckBox checked={!!selected[g.id]} onChange={(on) => setSelected(s => ({ ...s, [g.id]: on }))} /></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
                          <GigChip type={g.type} />
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</p>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{fmtDate(g.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{g.start}–{g.end}</span></td>
                      <td>{g.spotsFilled}/{g.spots}</td>
                      <td><Badge kind={g.status === 'confirmed' ? 'Confirmed' : g.status === 'completed' ? 'Completed' : 'Open'} /></td>
                      <td><Badge kind={g.priority} /></td>
                      <td>
                        <AssignedStack ids={g.assignedTo} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="row-action-btn" onClick={() => toast.push({ kind: 'info', title: 'Edit gig', body: 'Opening editor…' })}><SG_I.Pencil size={14} /></button>
                          <button className="row-action-btn danger" onClick={() => toast.push({ kind: 'warning', title: 'Gig removed' })}><SG_I.Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Gig" size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <WriteForMe context={{ kind: 'gig', fields: ['description'] }}
              placeholderQuestions={[
                { key: 'role', label: 'Which role?', placeholder: 'Lead, Design, Assist, Strike' },
                { key: 'eventKind', label: 'What kind of event?', placeholder: 'wedding install, gala, brand activation' },
                { key: 'notes', label: 'Anything specific?', type: 'textarea', placeholder: 'Heavy install, must lift 50 lbs, etc.' },
              ]}
              onFill={(d) => { /* Write into the description textarea via DOM */
                const ta = document.querySelector('.modal.md textarea.textarea');
                if (ta) { ta.value = d.description || d._raw || ''; ta.dispatchEvent(new Event('input', { bubbles: true })); }
              }} />
            <button className="btn btn-coral" onClick={() => { setAddOpen(false); toast.push({ kind: 'success', title: 'Gig created', body: 'Posted to the marketplace.' }); }}>Create Gig</button>
          </>
        }>
        <AddGigForm />
      </Modal>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter gigs" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setStatusFilter({ open: true, confirmed: true, completed: true })}>Reset</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
        <div className="col">
          {Object.keys(statusFilter).map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', cursor: 'pointer' }}>
              <span className={`checkbox ${statusFilter[k] ? 'checked' : ''}`} onClick={() => setStatusFilter(f => ({ ...f, [k]: !f[k] }))}>
                {statusFilter[k] ? <SG_I.CheckCircle size={12} /> : null}
              </span>
              <span style={{ textTransform: 'capitalize' }}>{k}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function AssignedStack({ ids }) {
  const users = ids.map(id => SG_D.USERS.find(u => u.id === id)).filter(Boolean);
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {users.slice(0, 3).map((u, i) => (
        <span key={u.id} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid var(--color-canvas)', borderRadius: 9999, position: 'relative', zIndex: 3 - i }}>
          <Avatar name={u.name} size="sm" />
        </span>
      ))}
      {users.length > 3 ? <span className="pill" style={{ marginLeft: 6, fontSize: 11 }}>+{users.length - 3}</span> : null}
    </div>
  );
}

function AddGigForm() {
  const [type, setType] = SG_us('Assist');
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="field"><label className="field-label">Event</label>
        <select className="select">
          {SG_D.EVENTS.map(e => <option key={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="field"><label className="field-label">Gig type</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Lead','Design','Assist','Strike'].map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              style={{ border: '1.5px solid', borderColor: type===t ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: type===t ? 'var(--color-ink)' : 'transparent', color: type===t ? '#fff' : 'inherit', padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Date</label><input className="input" type="date" defaultValue="2026-07-04" /></div>
        <div className="field"><label className="field-label">Spots</label><input className="input" type="number" defaultValue={3} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Start time</label><input className="input" type="time" defaultValue="09:00" /></div>
        <div className="field"><label className="field-label">End time</label><input className="input" type="time" defaultValue="15:00" /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Pay rate ($/hr)</label><input className="input" type="number" defaultValue={SG_D.GIG_TYPES[type]?.hourly || 22} /></div>
        <div className="field"><label className="field-label">Priority</label>
          <select className="select"><option>Medium</option><option>High</option><option>Low</option></select>
        </div>
      </div>
      <div className="field"><label className="field-label">Description</label><textarea className="textarea" defaultValue={SG_D.GIG_TYPES[type]?.blurb || ''} /></div>
    </div>
  );
}

/* ============ Worker: Gig posts ============ */
function PageGigPostsWorker({ setRoute, currentUser }) {
  const toast = useToast();
  const [applied, setApplied] = SG_us({});
  const [applyGig, setApplyGig] = SG_us(null);
  const [search, setSearch] = SG_us('');
  const [typeFilter, setTypeFilter] = SG_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [typeOpen, setTypeOpen] = SG_us(false);
  const events = SG_D.EVENTS.filter(e => e.status === 'open');
  const [open, setOpen] = SG_us(events.reduce((acc, e) => ({ ...acc, [e.id]: true }), {}));

  const matchGig = (g, ev) => {
    if (!typeFilter[g.type]) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const v = SG_D.VENUES.find(x => x.id === ev?.venueId);
    return [g.type, g.description, ev?.name, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Available gigs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SG_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search gigs..." style={{ paddingLeft: 36, width: 240 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setTypeOpen(true)}><SG_I.Filter size={14} />Filter by type ({Object.values(typeFilter).filter(Boolean).length}/4)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast.push({ kind: 'info', title: 'Location filter', body: 'Set in Settings → Notifications → Service area.' })}><SG_I.MapPin size={14} />Brooklyn, 25 mi</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="rosy-table">
          <thead>
            <tr>
              <th>Gig</th>
              <th>Date / time</th>
              <th>Location</th>
              <th>Rate</th>
              <th>Spots</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => {
              const gigs = SG_D.GIGS.filter(g => g.eventId === ev.id && g.status !== 'completed').filter(g => matchGig(g, ev));
              if (gigs.length === 0) return null;
              const v = SG_D.VENUES.find(x => x.id === ev.venueId);
              return (
                <React.Fragment key={ev.id}>
                  <tr className="group-row">
                    <td colSpan={5}>
                      <button onClick={() => setOpen(o => ({ ...o, [ev.id]: !o[ev.id] }))} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', color: 'inherit' }}>
                        {open[ev.id] ? <SG_I.ChevronDown size={14} /> : <SG_I.ChevronRight size={14} />}
                        {ev.name}
                        <span className="t-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12.5 }}>· {fmtDate(ev.date, 'mdy-dots')} · {v?.city}</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-link" onClick={() => setRoute('events:' + ev.id)} style={{ fontSize: 12.5 }}>See details <SG_I.ChevronRight size={12} style={{ verticalAlign: 'middle' }} /></button>
                    </td>
                  </tr>
                  {open[ev.id] && gigs.map(g => {
                    const full = g.spotsFilled >= g.spots;
                    const isApplied = applied[g.id];
                    const youApplied = g.assignedTo.includes(currentUser.id);
                    return (
                      <tr key={g.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
                            <GigChip type={g.type} />
                            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</p>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{fmtDate(g.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{g.start}–{g.end}</span></td>
                        <td style={{ fontSize: 13 }}>{v?.name}<br/><span className="t-muted" style={{ fontSize: 12 }}>{v?.city}</span></td>
                        <td className="t-mono-amount">${g.rate}/hr</td>
                        <td>{g.spotsFilled}/{g.spots}</td>
                        <td>
                          {youApplied ? <Badge kind="Confirmed">Confirmed</Badge>
                            : isApplied ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Badge kind="Pending">Applied</Badge>
                                <button className="btn-link" style={{ fontSize: 11.5 }} onClick={() => { setApplied(s => ({ ...s, [g.id]: false })); toast.push({ kind: 'warning', title: 'Application withdrawn' }); }}>Withdraw</button>
                              </div>
                            )
                            : full ? <Badge kind="Cancelled">Full</Badge>
                            : <button className="btn btn-coral btn-sm" onClick={() => setApplyGig(g)}>Apply</button>}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!applyGig} onClose={() => setApplyGig(null)} title="Apply for this gig" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setApplyGig(null)}>Cancel</button><button className="btn btn-coral" onClick={() => { setApplied(s => ({ ...s, [applyGig.id]: true })); setApplyGig(null); toast.push({ kind: 'success', title: 'Application sent', body: 'You\'ll hear back within 24 hours.' }); }}>Confirm application</button></>}>
        {applyGig ? (
          <div className="col" style={{ gap: 14 }}>
            <GigChip type={applyGig.type} />
            <KV label="Event" value={SG_D.EVENTS.find(e => e.id === applyGig.eventId)?.name} />
            <KV label="Date" value={`${fmtDate(applyGig.date, 'mdy-dots')} · ${applyGig.start}–${applyGig.end}`} />
            <KV label="Rate" value={`$${applyGig.rate}/hr`} />
            <KV label="What you'll do" value={applyGig.description} />
            <div style={{ background: 'var(--color-surface-soft)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--color-body)' }}>
              <strong>Heads up:</strong> by applying, you commit to the full call time if confirmed. Late cancellations affect your rating.
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title="Gig types" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setTypeFilter({ Lead: true, Design: true, Assist: true, Strike: true })}>Reset</button><button className="btn btn-coral" onClick={() => setTypeOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 8 }}>
          {Object.keys(typeFilter).map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', cursor: 'pointer' }}>
              <span className={`checkbox ${typeFilter[t] ? 'checked' : ''}`} onClick={() => setTypeFilter(f => ({ ...f, [t]: !f[t] }))}>
                {typeFilter[t] ? <SG_I.CheckCircle size={12} /> : null}
              </span>
              <GigChip type={t} />
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-muted)' }}>${SG_D.GIG_TYPES[t]?.hourly}/hr avg</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/* ============ Worker: My gigs ============ */
function PageMyGigsWorker({ currentUser }) {
  const toast = useToast();
  const [tab, setTab] = SG_us('upcoming');
  const today = new Date('2026-05-25');
  const allMy = SG_D.GIGS.filter(g => g.assignedTo.includes(currentUser.id));
  const my = allMy.filter(g => {
    const past = new Date(g.date) < today;
    if (tab === 'upcoming') return !past && g.status !== 'completed';
    if (tab === 'past')     return past || g.status === 'completed';
    if (tab === 'pending')  return g.status === 'completed';
    return true;
  });
  const [mark, setMark] = SG_us(null);
  const [rate, setRate] = SG_us(null);
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>My gigs</h2>
        <div className="tabs">
          {[['upcoming','Upcoming'],['past','Past'],['pending','Pending payment']].map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr><th>Event</th><th>Gig</th><th>Date / time</th><th>Location</th><th>Pay rate</th><th>Hours</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {my.length === 0 ? <tr><td colSpan={8}><Empty icon={SG_I.Briefcase} title="No gigs yet" body="Browse open gig posts to apply." /></td></tr> :
             my.map(g => {
               const ev = SG_D.EVENTS.find(e => e.id === g.eventId);
               const v = SG_D.VENUES.find(x => x.id === ev?.venueId);
               const past = new Date(g.date) < today;
               return (
                 <tr key={g.id}>
                   <td style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{ev?.name}</td>
                   <td><GigChip type={g.type} /></td>
                   <td style={{ fontSize: 13 }}>{fmtDate(g.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{g.start}–{g.end}</span></td>
                   <td style={{ fontSize: 13 }}>{v?.name}<br/><span className="t-muted" style={{ fontSize: 12 }}>{v?.city}</span></td>
                   <td className="t-mono-amount">${g.rate}/hr</td>
                   <td>{past ? '8.5' : '—'}</td>
                   <td><Badge kind={g.status === 'completed' ? 'Completed' : g.status === 'confirmed' ? 'Confirmed' : 'Open'} /></td>
                   <td>
                     {g.status === 'completed' ? <button className="btn btn-ghost btn-sm" onClick={() => setRate(g)}><SG_I.Star size={14} />Rate vendor</button>
                       : past ? <button className="btn btn-coral btn-sm" onClick={() => setMark(g)}>Mark complete</button>
                       : <button className="btn btn-ghost btn-sm" onClick={() => toast.push({ kind: 'info', title: `Directions to ${v?.name}`, body: 'Opening in Maps…' })}><SG_I.MapPin size={14} />Directions</button>}
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      <Modal open={!!mark} onClose={() => setMark(null)} title="Mark gig complete" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setMark(null)}>Cancel</button><button className="btn btn-coral" onClick={() => { setMark(null); toast.push({ kind: 'success', title: 'Submitted', body: 'Vendor has 24h to approve.' }); }}>Submit</button></>}>
        {mark ? (
          <div className="col" style={{ gap: 14 }}>
            <KV label="Event" value={SG_D.EVENTS.find(e => e.id === mark.eventId)?.name} />
            <KV label="Scheduled" value={`${mark.start} – ${mark.end}`} />
            <div className="field"><label className="field-label">Hours worked</label><input className="input" type="number" step="0.25" defaultValue={8.5} /></div>
            <div className="field"><label className="field-label">Notes to vendor (optional)</label><textarea className="textarea" placeholder="Optional context for the vendor — overtime, scope changes, etc." /></div>
            <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 10, padding: 12, fontSize: 13 }}>
              <strong>Heads up:</strong> the vendor has 24 hours to approve. After that, hours auto-approve.
            </div>
          </div>
        ) : null}
      </Modal>

      <RatingModal gig={rate} onClose={() => setRate(null)} />
    </div>
  );
}

function RatingModal({ gig, onClose }) {
  const [stars, setStars] = SG_us(0);
  const [hover, setHover] = SG_us(0);
  const toast = useToast();
  return (
    <Modal open={!!gig} onClose={onClose} title="Rate vendor" size="md"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Skip</button><button className="btn btn-coral" disabled={!stars} onClick={() => { onClose(); toast.push({ kind: 'success', title: 'Rating submitted', body: 'Thanks for keeping the community strong.' }); }}>Submit rating</button></>}>
      {gig ? (
        <div className="col" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <Avatar name={SG_D.USERS.find(u => u.id === SG_D.EVENTS.find(e => e.id === gig.eventId)?.vendorId)?.name} size="xl" />
          <p style={{ margin: 0, fontSize: 15, color: 'var(--color-muted)' }}>How was your experience working with {SG_D.USERS.find(u => u.id === SG_D.EVENTS.find(e => e.id === gig.eventId)?.vendorId)?.company}?</p>
          <div style={{ display: 'flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
            {[1,2,3,4,5].map(i => (
              <button key={i} onMouseEnter={() => setHover(i)} onClick={() => setStars(i)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: (hover || stars) >= i ? '#F59E0B' : 'var(--color-hairline-strong)' }}>
                <SG_I.Star size={40} style={{ fill: (hover || stars) >= i ? '#F59E0B' : 'transparent' }} />
              </button>
            ))}
          </div>
          <textarea className="textarea" placeholder="What stood out? (optional)" style={{ width: '100%' }} />
        </div>
      ) : null}
    </Modal>
  );
}

Object.assign(window, { PageGigsVendor, PageGigPostsWorker, PageMyGigsWorker });

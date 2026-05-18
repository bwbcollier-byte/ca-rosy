/* Gig screens: vendor grouped table, worker gig posts, worker my gigs */

const SG_D = window.RosyData;
const SG_I = window.Icons;
const { useState: SG_us, useEffect: SG_ue } = React;

/* ============ Vendor: grouped Gigs table ============ */
function PageGigsVendor({ user, role, setRoute }) {
  // Vendors only see gigs on their own events; admins see all.
  const isVendor = role === 'vendor' && user?.id;
  const ownEventIds = isVendor ? new Set(SG_D.EVENTS.filter(e => e.vendorId === user.id).map(e => e.id)) : null;
  const scopeGigsForRole = (arr) => isVendor ? arr.filter(g => ownEventIds.has(g.eventId)) : arr;
  const [gigs, setGigs] = SG_us(scopeGigsForRole(SG_D.GIGS));
  SG_ue(() => {
    const sync = () => setGigs(scopeGigsForRole([...SG_D.GIGS]));
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, [role, user?.id]);
  const [open, setOpen] = SG_us(SG_D.EVENTS.reduce((acc, e) => ({ ...acc, [e.id]: true }), {}));
  const [addOpen, setAddOpen] = SG_us(false);
  // Honor cross-page "open Add Gig modal on mount" intent
  SG_ue(() => { if (window.__rosyOpenAddGig) { window.__rosyOpenAddGig = false; setAddOpen(true); } }, []);
  const [addForm, setAddForm] = SG_us(null);
  const [search, setSearch] = SG_us('');
  const [statusFilter, setStatusFilter] = SG_us({ open: true, confirmed: true, completed: true });
  const [typeFilter, setTypeFilter] = SG_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [priorityFilter, setPriorityFilter] = SG_us({ High: true, Medium: true, Low: true });
  const [sortBy, setSortBy] = SG_us('date');
  const [filterOpen, setFilterOpen] = SG_us(false);
  const [selected, setSelected] = SG_us({});
  const [editGig, setEditGig] = SG_us(null);
  const [editForm, setEditForm] = SG_us(null);
  const [detailGig, setDetailGig] = SG_us(null);
  const toast = useToast();
  const events = SG_D.EVENTS.filter(e => e.status !== 'draft' && (!isVendor || ownEventIds.has(e.id)));

  React.useEffect(() => {
    const prefillId = window.__rosyAddGigEventId;
    if (prefillId && events.some(e => e.id === prefillId)) {
      window.__rosyAddGigEventId = null;
      setAddForm({
        eventId: prefillId,
        type: 'Assist',
        date: events.find(e => e.id === prefillId)?.date || '2026-07-04',
        spots: 3, start: '09:00', end: '15:00',
        rate: SG_D.GIG_TYPES['Assist']?.hourly || 22,
        priority: 'Medium',
        description: SG_D.GIG_TYPES['Assist']?.blurb || '',
      });
      setAddOpen(true);
    }
  }, []);

  const matchGig = (g) => {
    if (!statusFilter[g.status]) return false;
    if (!typeFilter[g.type]) return false;
    if (!priorityFilter[g.priority]) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ev = SG_D.EVENTS.find(e => e.id === g.eventId);
    return [g.type, g.description, ev?.name].some(s => (s || '').toLowerCase().includes(q));
  };

  const visibleGigs = gigs.filter(g => events.some(e => e.id === g.eventId)).filter(matchGig);
  const allVisibleSelected = visibleGigs.length > 0 && visibleGigs.every(g => selected[g.id]);
  const pickedIds = Object.keys(selected).filter(k => selected[k]);
  const pickedCount = pickedIds.length;

  const openAdd = () => {
    setAddForm({
      eventId: events[0]?.id || '',
      type: 'Assist',
      date: events[0]?.date || '2026-07-04',
      spots: 3,
      start: '09:00',
      end: '15:00',
      rate: SG_D.GIG_TYPES['Assist']?.hourly || 22,
      priority: 'Medium',
      description: SG_D.GIG_TYPES['Assist']?.blurb || '',
    });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!addForm?.eventId || !addForm?.type) {
      toast.push({ kind: 'warning', title: 'Pick an event and gig type' });
      return;
    }
    const ev = SG_D.EVENTS.find(e => e.id === addForm.eventId);
    if (!ev?.vendorId) {
      toast.push({ kind: 'warning', title: 'Sign in required', body: 'Sign in to post a gig under your studio.' });
      return;
    }
    const draft = {
      eventId: addForm.eventId, vendorId: ev.vendorId, type: addForm.type,
      description: addForm.description, date: addForm.date,
      start: addForm.start, end: addForm.end, rate: +addForm.rate,
      spots: +addForm.spots, spotsFilled: 0, status: 'open', priority: addForm.priority,
      title: `${addForm.type} crew`,
    };
    try {
      const live = await window.RosyMutate?.gigs?.create(draft);
      setGigs(gs => [(live || { id: 'g_' + Math.random().toString(36).slice(2,8), assignedTo: [], ...draft }), ...gs]);
    } catch (e) { console.warn(e); toast.push({ kind: 'error', title: 'Create failed', body: e.message }); return; }
    setAddOpen(false);
    toast.push({ kind: 'success', title: 'Gig created', body: 'Posted to the marketplace.' });
  };

  const submitEdit = async () => {
    if (!editForm) return;
    const id = editGig.id;
    const patch = { ...editForm, rate: +editForm.rate, spots: +editForm.spots };
    setGigs(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));
    try { await window.RosyMutate?.gigs?.update(id, patch); } catch (e) { console.warn(e); }
    setEditGig(null); setEditForm(null);
    toast.push({ kind: 'success', title: 'Gig updated' });
  };

  const bulkSetStatus = async (status) => {
    const ids = [...pickedIds];
    setGigs(gs => gs.map(g => ids.includes(g.id) ? { ...g, status } : g));
    try { await Promise.all(ids.map(id => window.RosyMutate?.gigs?.update(id, { status }))); } catch (e) { console.warn(e); }
    toast.push({ kind: 'success', title: `${pickedCount} marked ${status}` });
    setSelected({});
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
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date','By date'],['priority','By priority'],['fill','Least filled'],['rate','Highest rate'],['spots','Most spots']]} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SG_I.Filter size={14} />Filters{(() => { const off = Object.values(statusFilter).filter(v => !v).length + Object.values(typeFilter).filter(v => !v).length + Object.values(priorityFilter).filter(v => !v).length; return off > 0 ? ` (${off})` : ''; })()}</button>
          <button className="btn btn-coral" onClick={openAdd}><SG_I.Plus size={15} />Add Gig</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="rosy-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}><CheckBox checked={allVisibleSelected} onChange={(on) => { const next = {}; if (on) visibleGigs.forEach(g => { next[g.id] = true; }); setSelected(next); }} /></th>
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
              let evGigs = gigs.filter(g => g.eventId === ev.id).filter(matchGig);
              if (sortBy === 'priority') {
                const order = { High: 0, Medium: 1, Low: 2 };
                evGigs = [...evGigs].sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
              } else if (sortBy === 'rate') {
                evGigs = [...evGigs].sort((a, b) => (b.rate || 0) - (a.rate || 0));
              } else if (sortBy === 'spots') {
                evGigs = [...evGigs].sort((a, b) => (b.spots || 0) - (a.spots || 0));
              } else if (sortBy === 'fill') {
                evGigs = [...evGigs].sort((a, b) => (a.spots ? a.spotsFilled / a.spots : 0) - (b.spots ? b.spotsFilled / b.spots : 0));
              } else {
                evGigs = [...evGigs].sort((a, b) => new Date(a.date) - new Date(b.date));
              }
              if (evGigs.length === 0) return null;
              return (
                <React.Fragment key={ev.id}>
                  <tr className="group-row">
                    <td colSpan={7}>
                      <button onClick={() => setOpen(o => ({ ...o, [ev.id]: !o[ev.id] }))} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', color: 'inherit' }}>
                        {open[ev.id] ? <SG_I.ChevronDown size={14} /> : <SG_I.ChevronRight size={14} />}
                        {ev.name}
                        <span className="t-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12.5 }}>· {fmtDate(ev.date, 'mdy-dots')} · {evGigs.filter(g=>g.status==='confirmed').length}/{evGigs.length} confirmed</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-link" onClick={() => setRoute('events:' + ev.id)} style={{ fontSize: 12.5 }}>See details <SG_I.ChevronRight size={12} style={{ verticalAlign: 'middle' }} /></button>
                    </td>
                  </tr>
                  {open[ev.id] && evGigs.map(g => (
                    <tr key={g.id} tabIndex={0} role="button" aria-label={`View gig ${g.type}`}
                      onClick={(e) => { if (e.target.closest('button') || e.target.closest('[role="checkbox"]')) return; setDetailGig(g); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailGig(g); } }}
                      style={{ cursor: 'pointer' }}>
                      <td onClick={(e) => e.stopPropagation()}><CheckBox checked={!!selected[g.id]} onChange={(on) => setSelected(s => ({ ...s, [g.id]: on }))} /></td>
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
                        <AssignedStack ids={g.assignedTo} setRoute={setRoute} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="row-action-btn" aria-label="Edit gig" onClick={() => { setEditGig(g); setEditForm({ type: g.type, date: g.date, rate: g.rate, start: g.start, end: g.end, spots: g.spots }); }}><SG_I.Pencil size={14} /></button>
                          <button className="row-action-btn" aria-label={g.status === 'completed' ? 'Reopen gig' : 'Mark completed'} title={g.status === 'completed' ? 'Reopen' : 'Mark completed'} onClick={async () => {
                            const next = g.status === 'completed' ? 'open' : 'completed';
                            setGigs(gs => gs.map(x => x.id === g.id ? { ...x, status: next } : x));
                            try { await window.RosyMutate?.gigs?.update(g.id, { status: next }); } catch (e) { console.warn(e); }
                            toast.push({ kind: next === 'completed' ? 'success' : 'warning', title: `Gig ${next}` });
                          }}>{g.status === 'completed' ? <SG_I.CheckCircle2 size={14} /> : <SG_I.UserX size={14} />}</button>
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
              onFill={(d) => setAddForm(f => ({ ...f, description: d.description || d._raw || f.description }))} />
            <button className="btn btn-coral" onClick={submitAdd}>Create Gig</button>
          </>
        }>
        {addForm ? <AddGigForm value={addForm} onChange={setAddForm} events={events} /> : null}
      </Modal>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter gigs" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setStatusFilter({ open: true, confirmed: true, completed: true }); setTypeFilter({ Lead: true, Design: true, Assist: true, Strike: true }); setPriorityFilter({ High: true, Medium: true, Low: true }); }}>Reset all</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(statusFilter).map(k => (
                <button key={k} type="button" onClick={() => setStatusFilter(f => ({ ...f, [k]: !f[k] }))} style={{ border: '1.5px solid', borderColor: statusFilter[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: statusFilter[k] ? 'var(--color-ink)' : 'transparent', color: statusFilter[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Gig type</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(typeFilter).map(k => (
                <button key={k} type="button" onClick={() => setTypeFilter(f => ({ ...f, [k]: !f[k] }))} style={{ border: '1.5px solid', borderColor: typeFilter[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: typeFilter[k] ? 'var(--color-ink)' : 'transparent', color: typeFilter[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Priority</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(priorityFilter).map(k => (
                <button key={k} type="button" onClick={() => setPriorityFilter(f => ({ ...f, [k]: !f[k] }))} style={{ border: '1.5px solid', borderColor: priorityFilter[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: priorityFilter[k] ? 'var(--color-ink)' : 'transparent', color: priorityFilter[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {detailGig ? (() => {
        const g = detailGig;
        const ev = SG_D.EVENTS.find(e => e.id === g.eventId);
        const venue = ev ? SG_D.VENUES.find(v => v.id === ev.venueId) : null;
        const vendor = ev ? SG_D.USERS.find(u => u.id === ev.vendorId) : null;
        return (
          <Modal open={!!detailGig} onClose={() => setDetailGig(null)} title={`${g.type} gig`} size="md"
            footer={<><button className="btn btn-ghost" onClick={() => setDetailGig(null)}>Close</button><button className="btn btn-coral" onClick={() => { setDetailGig(null); setEditGig(g); setEditForm({ type: g.type, date: g.date, rate: g.rate, start: g.start, end: g.end, spots: g.spots }); }}><SG_I.Pencil size={14} />Edit gig</button></>}>
            <div className="col" style={{ gap: 16 }}>
              <div>
                <p className="t-eyebrow" style={{ marginBottom: 6 }}>Gig</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <GigChip type={g.type} />
                  <Badge kind={g.status === 'confirmed' ? 'Confirmed' : g.status === 'completed' ? 'Completed' : 'Open'} />
                  <Badge kind={g.priority} />
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-body)' }}>{g.description}</p>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div><p className="t-eyebrow">Date</p><p style={{ margin: 0, fontSize: 13.5 }}>{fmtDate(g.date, 'mdy-dots')}</p></div>
                <div><p className="t-eyebrow">Time</p><p style={{ margin: 0, fontSize: 13.5 }}>{g.start}–{g.end}</p></div>
                <div><p className="t-eyebrow">Rate</p><p style={{ margin: 0, fontSize: 13.5 }}>${g.rate}/hr</p></div>
                <div><p className="t-eyebrow">Spots</p><p style={{ margin: 0, fontSize: 13.5 }}>{g.spotsFilled}/{g.spots} filled</p></div>
              </div>
              <div className="divider" />
              <div>
                <p className="t-eyebrow" style={{ marginBottom: 6 }}>Parent event</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5 }}>{ev?.name || '—'}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>{ev ? fmtDate(ev.date, 'mdy-dots') : ''}{venue ? ` · ${venue.name}, ${venue.city}` : ''}{vendor ? ` · ${vendor.company || vendor.name}` : ''}</p>
              </div>
            </div>
          </Modal>
        );
      })() : null}

      {editGig && editForm ? (
        <Modal open={!!editGig} onClose={() => { setEditGig(null); setEditForm(null); }} title="Edit gig" size="md"
          footer={<><button className="btn btn-ghost" onClick={() => { setEditGig(null); setEditForm(null); }}>Cancel</button><button className="btn btn-coral" onClick={submitEdit}>Save changes</button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Type</label><input className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date</label><input className="input" type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Rate ($/hr)</label><input className="input" type="number" min={0} value={editForm.rate} onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Start</label><input className="input" type="time" value={editForm.start} onChange={e => setEditForm(f => ({ ...f, start: e.target.value }))} /></div>
              <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>End</label><input className="input" type="time" value={editForm.end} onChange={e => setEditForm(f => ({ ...f, end: e.target.value }))} /></div>
            </div>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Spots</label><input className="input" type="number" min={1} value={editForm.spots} onChange={e => setEditForm(f => ({ ...f, spots: e.target.value }))} /></div>
          </div>
        </Modal>
      ) : null}

      {pickedCount > 0 ? (
        <BulkActionBar count={pickedCount} onClear={() => setSelected({})}
          actions={[
            { label: 'Mark confirmed', onClick: () => bulkSetStatus('confirmed') },
            { label: 'Mark open', onClick: () => bulkSetStatus('open') },
            { label: 'Mark completed', onClick: () => bulkSetStatus('completed') },
          ]} />
      ) : null}
    </div>
  );
}

function AssignedStack({ ids, setRoute }) {
  const users = ids.map(id => SG_D.USERS.find(u => u.id === id)).filter(Boolean);
  const [openUser, setOpenUser] = SG_us(null);
  const toast = useToast();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        {users.slice(0, 3).map((u, i) => (
          <button key={u.id} type="button" onClick={() => setOpenUser(u)}
            style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid var(--color-canvas)', borderRadius: 9999, position: 'relative', zIndex: 3 - i, background: 'transparent', padding: 0, cursor: 'pointer' }}
            title={`Open ${u.name}'s profile`} aria-label={`Open ${u.name}'s profile`}>
            <Avatar name={u.name} size="sm" />
          </button>
        ))}
        {users.length > 3 ? <span className="pill" style={{ marginLeft: 6, fontSize: 11 }}>+{users.length - 3}</span> : null}
      </div>
      {openUser ? (
        <Modal open={!!openUser} onClose={() => setOpenUser(null)} title={openUser.name} size="md"
          footer={<>
            <button className="btn btn-ghost" onClick={() => setOpenUser(null)}>Close</button>
            <button className="btn btn-ghost-teal" onClick={() => { setOpenUser(null); setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${openUser.first || openUser.name.split(' ')[0]}` }); }}>
              <SG_I.MessageSquare size={14} />Message
            </button>
            <button className="btn btn-coral" onClick={() => { const id = openUser.id; setOpenUser(null); setRoute && setRoute('users:' + id); }}>
              View full profile
            </button>
          </>}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Avatar name={openUser.name} size="xl" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.01em' }}>{openUser.name}</p>
              <p style={{ margin: '4px 0 8px', color: 'var(--color-muted)', fontSize: 13.5 }}>
                <span style={{ textTransform: 'capitalize' }}>{openUser.role}</span>{openUser.title ? ` · ${openUser.title}` : ''}{openUser.city ? ` · ${openUser.city}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {openUser.rating ? <span className="pill" style={{ background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 600 }}>★ {openUser.rating}</span> : null}
                {openUser.gigs ? <span className="pill" style={{ background: 'var(--color-surface-card)', fontSize: 12 }}>{openUser.gigs} gigs</span> : null}
                <Badge kind={openUser.status === 'active' ? 'Active' : 'Inactive'}>{openUser.status === 'active' ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </div>
          <div className="divider" style={{ margin: '18px 0' }} />
          <div className="grid-2" style={{ gap: 10, fontSize: 13.5 }}>
            <div><span className="t-muted" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</span>{openUser.email || '—'}</div>
            <div><span className="t-muted" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Company</span>{openUser.company || '—'}</div>
            {openUser.phone ? <div><span className="t-muted" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phone</span>{openUser.phone}</div> : null}
            {openUser.joined ? <div><span className="t-muted" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joined</span>{fmtDate(openUser.joined, 'mdy-dots')}</div> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function AddGigForm({ value, onChange, events }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setType = (t) => onChange({ ...value, type: t, rate: SG_D.GIG_TYPES[t]?.hourly || value.rate, description: SG_D.GIG_TYPES[t]?.blurb || value.description });
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="field"><label className="field-label">Event</label>
        <select className="select" value={value.eventId} onChange={e => set({ eventId: e.target.value })}>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="field"><label className="field-label">Gig type</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Lead','Design','Assist','Strike'].map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              style={{ border: '1.5px solid', borderColor: value.type===t ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: value.type===t ? 'var(--color-ink)' : 'transparent', color: value.type===t ? '#fff' : 'inherit', padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Date</label><input className="input" type="date" value={value.date} onChange={e => set({ date: e.target.value })} /></div>
        <div className="field"><label className="field-label">Spots</label><input className="input" type="number" min={1} value={value.spots} onChange={e => set({ spots: e.target.value })} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Start time</label><input className="input" type="time" value={value.start} onChange={e => set({ start: e.target.value })} /></div>
        <div className="field"><label className="field-label">End time</label><input className="input" type="time" value={value.end} onChange={e => set({ end: e.target.value })} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Pay rate ($/hr)</label><input className="input" type="number" min={0} value={value.rate} onChange={e => set({ rate: e.target.value })} /></div>
        <div className="field"><label className="field-label">Priority</label>
          <select className="select" value={value.priority} onChange={e => set({ priority: e.target.value })}><option>Medium</option><option>High</option><option>Low</option></select>
        </div>
      </div>
      <div className="field"><label className="field-label">Description</label><textarea className="textarea" value={value.description} onChange={e => set({ description: e.target.value })} /></div>
    </div>
  );
}

/* ============ Worker: Gig posts ============ */
function PageGigPostsWorker({ setRoute, currentUser }) {
  const toast = useToast();
  // Seed local "applied" state from real APPLICATIONS so it survives reload
  const myApps = currentUser?.id ? (SG_D.APPLICATIONS || []).filter(a => a.workerId === currentUser.id && a.status !== 'withdrawn' && a.status !== 'rejected') : [];
  const seedApplied = Object.fromEntries(myApps.map(a => [a.gigId, true]));
  const [applied, setApplied] = SG_us(seedApplied);
  const [applyGig, setApplyGig] = SG_us(null);
  const [detailGig, setDetailGig] = SG_us(null);
  const [search, setSearch] = SG_us('');
  const [typeFilter, setTypeFilter] = SG_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [minRate, setMinRate] = SG_us(0);                      // $/hr floor
  const [dateFilter, setDateFilter] = SG_us('any');            // any | thisweek | thismonth
  const [sortBy, setSortBy] = SG_us('date');                   // date | rate | spots
  const [view, setView] = SG_us('cards');                      // cards | table
  const [filterOpen, setFilterOpen] = SG_us(false);
  const [locOpen, setLocOpen] = SG_us(false);
  const [city, setCity] = SG_us('Chicago');
  const [radius, setRadius] = SG_us(25);
  const events = SG_D.EVENTS.filter(e => e.status === 'open');
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setDate(monthEnd.getDate() + 30);

  const matchGig = (g, ev) => {
    if (!typeFilter[g.type]) return false;
    if (minRate > 0 && (g.rate || 0) < minRate) return false;
    if (dateFilter !== 'any') {
      const d = new Date(g.date);
      if (dateFilter === 'thisweek'  && d > weekEnd)  return false;
      if (dateFilter === 'thismonth' && d > monthEnd) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const v = SG_D.VENUES.find(x => x.id === ev?.venueId);
    return [g.type, g.description, ev?.name, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
  };
  // Flatten gigs with their event for cards/sort
  const allFlat = events.flatMap(ev => SG_D.GIGS.filter(g => g.eventId === ev.id && g.status !== 'completed' && matchGig(g, ev)).map(g => ({ g, ev })));
  const sorted = [...allFlat].sort((a, b) => {
    if (sortBy === 'rate')  return (b.g.rate  || 0) - (a.g.rate  || 0);
    if (sortBy === 'spots') return ((b.g.spots - b.g.spotsFilled) || 0) - ((a.g.spots - a.g.spotsFilled) || 0);
    return new Date(a.g.date) - new Date(b.g.date);
  });
  const stats = {
    open:    sorted.length,
    avgRate: sorted.length ? Math.round(sorted.reduce((s, x) => s + (x.g.rate || 0), 0) / sorted.length) : 0,
    nextDays: sorted.filter(x => { const d = new Date(x.g.date); return d <= weekEnd; }).length,
    topRate: sorted.reduce((m, x) => Math.max(m, x.g.rate || 0), 0),
  };
  const activeFilters = (Object.values(typeFilter).filter(v => !v).length > 0 ? 1 : 0) + (minRate > 0 ? 1 : 0) + (dateFilter !== 'any' ? 1 : 0);

  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SG_I.Briefcase}  label="Open near you"    value={stats.open} />
        <StatCard icon={SG_I.Calendar}   label="Next 7 days"      value={stats.nextDays} />
        <StatCard icon={SG_I.DollarSign} label="Avg rate"         value={stats.avgRate} prefix="$" />
        <StatCard icon={SG_I.Star}       label="Top rate"         value={stats.topRate} prefix="$" />
      </div>
      <div className="section-heading">
        <h2>Available gigs</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <SG_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search role, venue, city…" style={{ paddingLeft: 36, width: 260 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date','Soonest first'],['rate','Highest rate'],['spots','Most spots open']]} />
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SG_I.Filter size={14} />Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLocOpen(true)}><SG_I.MapPin size={14} />{city}, {radius} mi</button>
        </div>
      </div>

      {view === 'cards' ? (
        sorted.length === 0 ? (
          <Empty icon={SG_I.Briefcase} title="No matching gigs" body="Try widening filters or your service area." />
        ) : (
          <div className="grid-3">
            {sorted.map(({ g, ev }) => {
              const v = SG_D.VENUES.find(x => x.id === ev.venueId);
              const full = g.spotsFilled >= g.spots;
              const isApplied = applied[g.id];
              const youApplied = currentUser?.id ? g.assignedTo.includes(currentUser.id) : false;
              return (
                <div key={g.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }} onClick={() => setDetailGig({ g, ev })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <GigChip type={g.type} />
                    <span className="t-mono-amount" style={{ fontSize: 18, fontWeight: 600 }}>${g.rate}/hr</span>
                  </div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{ev.name}</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</p>
                  <div className="divider" style={{ margin: 0 }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--color-muted)' }}>
                    <span><SG_I.Calendar size={11} style={{ verticalAlign: 'middle' }} /> {fmtDate(g.date, 'mdy-dots')}</span>
                    <span><SG_I.Clock size={11} style={{ verticalAlign: 'middle' }} /> {g.start}–{g.end}</span>
                    <span><SG_I.MapPin size={11} style={{ verticalAlign: 'middle' }} /> {v?.city}</span>
                    <span>{g.spotsFilled}/{g.spots} spots</span>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <button className="btn-link" onClick={(e) => { e.stopPropagation(); setRoute('events:' + ev.id); }} style={{ fontSize: 12.5 }}>See event</button>
                    {youApplied ? <Badge kind="Confirmed">Confirmed</Badge>
                      : isApplied ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <Badge kind="Pending">Applied</Badge>
                            <button className="btn-link" style={{ fontSize: 11.5 }} onClick={async (e) => { e.stopPropagation(); setApplied(s => ({ ...s, [g.id]: false })); try { await window.RosyMutate?.applications?.withdraw({ gigId: g.id, workerId: currentUser?.id }); } catch (e) {} toast.push({ kind: 'warning', title: 'Application withdrawn' }); }}>Withdraw</button>
                          </div>
                        )
                      : full ? <Badge kind="Cancelled">Full</Badge>
                      : <button className="btn btn-coral btn-sm" onClick={(e) => { e.stopPropagation(); setApplyGig(g); }}>Apply</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
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
            {(() => {
              const totalVisible = events.reduce((sum, ev) => sum + SG_D.GIGS.filter(g => g.eventId === ev.id && g.status !== 'completed').filter(g => matchGig(g, ev)).length, 0);
              if (totalVisible === 0) return <tr><td colSpan={6}><Empty icon={SG_I.Briefcase} title="No matching gigs" body="Try widening your filters or location radius." /></td></tr>;
              return null;
            })()}
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
                    const youApplied = currentUser?.id ? g.assignedTo.includes(currentUser.id) : false;
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
                                <button className="btn-link" style={{ fontSize: 11.5 }} onClick={async () => { setApplied(s => ({ ...s, [g.id]: false })); try { await window.RosyMutate?.applications?.withdraw({ gigId: g.id, workerId: currentUser?.id }); } catch (e) { console.warn(e); } toast.push({ kind: 'warning', title: 'Application withdrawn' }); }}>Withdraw</button>
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
      )}

      <Modal open={!!applyGig} onClose={() => setApplyGig(null)} title="Apply for this gig" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setApplyGig(null)}>Cancel</button><button className="btn btn-coral" onClick={async () => { const g = applyGig; setApplyGig(null); const dup = (SG_D.APPLICATIONS || []).some(a => a.gigId === g.id && a.workerId === currentUser?.id && a.status !== 'withdrawn' && a.status !== 'rejected'); if (dup) { toast.push({ kind: 'warning', title: 'Already applied', body: 'You’ve already applied to this gig.' }); return; } setApplied(s => ({ ...s, [g.id]: true })); try { await window.RosyMutate?.applications?.apply({ gigId: g.id, workerId: currentUser?.id }); } catch (e) { console.warn(e); toast.push({ kind: 'error', title: 'Apply failed', body: e.message }); return; } toast.push({ kind: 'success', title: 'Application sent', body: "You'll hear back within 24 hours." }); }}>Confirm application</button></>}>
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

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter gigs" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setTypeFilter({ Lead: true, Design: true, Assist: true, Strike: true }); setMinRate(0); setDateFilter('any'); }}>Reset all</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Gig type</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(typeFilter).map(t => (
                <button key={t} type="button" onClick={() => setTypeFilter(f => ({ ...f, [t]: !f[t] }))} style={{ border: '1.5px solid', borderColor: typeFilter[t] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: typeFilter[t] ? 'var(--color-ink)' : 'transparent', color: typeFilter[t] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{t} <span style={{ opacity: 0.7, marginLeft: 4 }}>${SG_D.GIG_TYPES[t]?.hourly}+</span></button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>When</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['any','Any date'],['thisweek','Next 7 days'],['thismonth','Next 30 days']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setDateFilter(id)} style={{ border: '1.5px solid', borderColor: dateFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: dateFilter === id ? 'var(--color-ink)' : 'transparent', color: dateFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Minimum hourly rate: ${minRate}</p>
            <input type="range" min={0} max={60} step={5} value={minRate} onChange={(e) => setMinRate(parseInt(e.target.value))} style={{ width: '100%' }} />
            <p style={{ margin: 4, fontSize: 11.5, color: 'var(--color-muted)' }}>Hide gigs paying under this rate.</p>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailGig} onClose={() => setDetailGig(null)} title={detailGig ? `${detailGig.g.type} · ${detailGig.ev.name}` : 'Gig details'} size="md"
        footer={(() => {
          if (!detailGig) return null;
          const { g } = detailGig;
          const dup = (SG_D.APPLICATIONS || []).some(a => a.gigId === g.id && a.workerId === currentUser?.id && a.status !== 'withdrawn' && a.status !== 'rejected');
          const youApplied = currentUser?.id && (g.assignedTo || []).includes(currentUser.id);
          const full = g.spotsFilled >= g.spots;
          return (
            <>
              <button className="btn btn-ghost" onClick={() => setDetailGig(null)}>Close</button>
              {youApplied ? <Badge kind="Confirmed">Confirmed</Badge>
                : dup ? <Badge kind="Pending">Already applied</Badge>
                : full ? <Badge kind="Cancelled">Full</Badge>
                : <button className="btn btn-coral" onClick={() => { setDetailGig(null); setApplyGig(g); }}>Apply</button>}
            </>
          );
        })()}>
        {detailGig ? (() => {
          const { g, ev } = detailGig;
          const v = SG_D.VENUES.find(x => x.id === ev?.venueId);
          const vendor = SG_D.USERS.find(u => u.id === ev?.vendorId);
          return (
            <div className="col" style={{ gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <GigChip type={g.type} />
                <span className="t-mono-amount" style={{ fontSize: 18, fontWeight: 600 }}>${g.rate}/hr</span>
              </div>
              <KV label="Event" value={ev?.name} />
              <KV label="Date" value={`${fmtDate(g.date, 'mdy-dots')} · ${g.start}–${g.end}`} />
              <KV label="Venue" value={`${v?.name || '—'} · ${v?.city || ''}`} />
              <KV label="Spots" value={`${g.spots - g.spotsFilled} of ${g.spots} left`} />
              <KV label="Vendor" value={vendor?.company || vendor?.name || '—'} />
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>What you'll do</p>
                <p style={{ marginTop: 6, fontSize: 14, color: 'var(--color-body)', lineHeight: 1.55 }}>{g.description || 'No description provided.'}</p>
              </div>
              <button className="btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => { setDetailGig(null); setRoute('events:' + ev.id); }}>See full event →</button>
            </div>
          );
        })() : null}
      </Modal>

      {locOpen ? (
        <Modal open={locOpen} onClose={() => setLocOpen(false)} title="Service area" size="sm"
          footer={<><button className="btn btn-ghost" onClick={() => setLocOpen(false)}>Cancel</button><button className="btn btn-coral" onClick={() => { setLocOpen(false); toast.push({ kind: 'success', title: 'Filter updated', body: `Showing gigs within ${radius} mi of ${city}` }); }}>Apply</button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>City or postcode</label><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Radius: {radius} miles</label><input type="range" min={5} max={100} step={5} value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} style={{ width: '100%' }} /></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ============ Worker: My gigs ============ */
function PageMyGigsWorker({ currentUser, setRoute }) {
  const toast = useToast();
  const [tab, setTab] = SG_us('upcoming');
  const [search, setSearch] = SG_us('');
  const [sortBy, setSortBy] = SG_us('date');
  const today = new Date('2026-05-25');
  const assignedGigs = currentUser?.id ? SG_D.GIGS.filter(g => g.assignedTo.includes(currentUser.id)) : [];
  // Also surface pending applications as Applied entries (only ones not already assigned)
  const assignedIds = new Set(assignedGigs.map(g => g.id));
  const myApps = currentUser?.id ? (SG_D.APPLICATIONS || []).filter(a => a.workerId === currentUser.id && a.status !== 'withdrawn' && a.status !== 'rejected') : [];
  const appliedGigs = myApps
    .filter(a => !assignedIds.has(a.gigId))
    .map(a => { const g = SG_D.GIGS.find(x => x.id === a.gigId); return g ? { ...g, _appStatus: 'applied' } : null; })
    .filter(Boolean);
  const allMy = [...assignedGigs, ...appliedGigs];
  // Stats span all gigs, not the tab
  const past = allMy.filter(g => new Date(g.date) < today);
  const future = allMy.filter(g => new Date(g.date) >= today);
  const stats = {
    upcoming: future.filter(g => g.status !== 'completed').length,
    completed: past.filter(g => g.status === 'completed').length,
    pending: past.filter(g => g.status !== 'completed').length,
    estEarn: future.reduce((s, g) => {
      const sh = parseInt((g.start || '0:0').split(':')[0]) || 0;
      const eh = parseInt((g.end   || '0:0').split(':')[0]) || 0;
      const hours = Math.max(0, (eh - sh + 24) % 24);
      return s + hours * (g.rate || 0);
    }, 0),
  };
  const my = allMy.filter(g => {
    const isPast = new Date(g.date) < today;
    if (tab === 'upcoming' && (isPast || g.status === 'completed')) return false;
    if (tab === 'past'     && g.status !== 'completed') return false;
    if (tab === 'pending'  && (!isPast || g.status === 'completed')) return false;
    if (!search.trim()) return true;
    const ev = SG_D.EVENTS.find(e => e.id === g.eventId);
    const v = SG_D.VENUES.find(x => x.id === ev?.venueId);
    const q = search.toLowerCase();
    return [g.type, ev?.name, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
  }).sort((a, b) => {
    if (sortBy === 'rate-desc') return (b.rate || 0) - (a.rate || 0);
    if (sortBy === 'oldest')    return new Date(a.date) - new Date(b.date);
    return new Date(b.date) - new Date(a.date);
  });
  const [mark, setMark] = SG_us(null);
  const [markHours, setMarkHours] = SG_us(8.5);
  const [markNotes, setMarkNotes] = SG_us('');
  const [rate, setRate] = SG_us(null);
  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SG_I.Briefcase}    label="Upcoming gigs" value={stats.upcoming} />
        <StatCard icon={SG_I.CheckCircle2} label="Completed"     value={stats.completed} />
        <StatCard icon={SG_I.Clock}        label="Awaiting payout" value={stats.pending} />
        <StatCard icon={SG_I.DollarSign}   label="Booked earnings" value={stats.estEarn} prefix="$" />
      </div>
      <div className="section-heading">
        <h2>My gigs</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <SG_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search event, venue, role…" style={{ paddingLeft: 36, width: 240 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date','Newest first'],['oldest','Oldest first'],['rate-desc','Highest rate']]} />
          <div className="tabs">
            {[['upcoming','Upcoming'],['past','Past'],['pending','Pending payment']].map(([id, label]) => (
              <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr><th>Event</th><th>Gig</th><th>Date / time</th><th>Location</th><th>Pay rate</th><th>Hours</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {my.length === 0 ? <tr><td colSpan={8}><Empty icon={SG_I.Briefcase} title="No gigs yet" body="Browse open gig posts to apply." cta={<button className="btn btn-coral" onClick={() => setRoute && setRoute('gig-posts')}><SG_I.Search size={14} />Find gigs</button>} /></td></tr> :
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
                   <td><Badge kind={g._appStatus === 'applied' ? 'Pending' : g.status === 'completed' ? 'Completed' : g.status === 'confirmed' ? 'Confirmed' : 'Open'}>{g._appStatus === 'applied' ? 'Applied' : null}</Badge></td>
                   <td>
                     {g.status === 'completed' ? <button className="btn btn-ghost btn-sm" onClick={() => setRate(g)}><SG_I.Star size={14} />Rate vendor</button>
                       : past ? <button className="btn btn-coral btn-sm" onClick={() => setMark(g)}>Mark complete</button>
                       : <button className="btn btn-ghost btn-sm" onClick={() => {
                           const q = encodeURIComponent(`${v?.name || ''} ${v?.address || ''}`.trim());
                           window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener');
                         }}><SG_I.MapPin size={14} />Directions</button>}
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      <Modal open={!!mark} onClose={() => { setMark(null); setMarkHours(8.5); setMarkNotes(''); }} title="Mark gig complete" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setMark(null); setMarkHours(8.5); setMarkNotes(''); }}>Cancel</button><button className="btn btn-coral" onClick={async () => {
          const gig = mark;
          const hours = markHours, notes = markNotes;
          setMark(null); setMarkHours(8.5); setMarkNotes('');
          try {
            const sb = window.sb;
            if (sb && currentUser?.id) {
              const { data } = await sb.from('rr_gig_applications').select('id').eq('gig_id', gig.id).eq('worker_id', currentUser.id).limit(1);
              const appId = data && data[0]?.id;
              if (appId) await window.RosyMutate?.applications?.markComplete({ id: appId, hoursWorked: hours, notes });
            }
          } catch (e) { console.warn(e); }
          toast.push({ kind: 'success', title: 'Submitted', body: 'Vendor has 24h to approve.' });
        }}>Submit</button></>}>
        {mark ? (
          <div className="col" style={{ gap: 14 }}>
            <KV label="Event" value={SG_D.EVENTS.find(e => e.id === mark.eventId)?.name} />
            <KV label="Scheduled" value={`${mark.start} – ${mark.end}`} />
            <div className="field"><label className="field-label">Hours worked</label><input className="input" type="number" step="0.25" min={0.25} value={markHours} onChange={e => setMarkHours(e.target.value)} /></div>
            <div className="field"><label className="field-label">Notes to vendor (optional)</label><textarea className="textarea" placeholder="Optional context for the vendor — overtime, scope changes, etc." value={markNotes} onChange={e => setMarkNotes(e.target.value)} /></div>
            <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 10, padding: 12, fontSize: 13 }}>
              <strong>Heads up:</strong> the vendor has 24 hours to approve. After that, hours auto-approve.
            </div>
          </div>
        ) : null}
      </Modal>

      <RatingModal gig={rate} currentUser={currentUser} onClose={() => setRate(null)} />
    </div>
  );
}

function RatingModal({ gig, currentUser, onClose }) {
  const [stars, setStars] = SG_us(0);
  const [hover, setHover] = SG_us(0);
  const toast = useToast();
  const submit = async () => {
    const target = gig;
    onClose();
    try {
      const ev = SG_D.EVENTS.find(e => e.id === target.eventId);
      const vendorId = ev?.vendorId;
      const sb = window.sb;
      let appId = null;
      if (sb && currentUser?.id) {
        const { data } = await sb.from('rr_gig_applications').select('id').eq('gig_id', target.id).eq('worker_id', currentUser.id).limit(1);
        appId = data && data[0]?.id;
      }
      const commentEl = document.querySelector('.modal textarea');
      if (appId) {
        await window.RosyMutate?.ratings?.create({
          raterId: currentUser?.id, ratedId: vendorId, gigAppId: appId,
          raterRole: 'worker', score: stars, comment: commentEl?.value || null,
        });
      }
    } catch (e) { console.warn(e); }
    toast.push({ kind: 'success', title: 'Rating submitted', body: 'Thanks for keeping the community strong.' });
  };
  return (
    <Modal open={!!gig} onClose={onClose} title="Rate vendor" size="md"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Skip</button><button className="btn btn-coral" disabled={!stars} onClick={submit}>Submit rating</button></>}>
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

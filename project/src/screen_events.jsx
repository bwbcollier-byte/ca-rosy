/* Events screens: vendor list (table/card), event detail, worker event browse */

const SE_D = window.RosyData;
const SE_I = window.Icons;
const { useState: SE_us } = React;

function PageEventsVendor({ user, setRoute, viewMode, density }) {
  const [view, setView] = SE_us(viewMode || 'table');
  const [search, setSearch] = SE_us('');
  const [sortBy, setSortBy] = SE_us('date-asc');
  const [filter, setFilter] = SE_us({ open: true, draft: true, completed: true });
  const [filterOpen, setFilterOpen] = SE_us(false);
  const [addOpen, setAddOpen] = SE_us(false);
  const [editEvent, setEditEvent] = SE_us(null);
  const [confirmId, setConfirmId] = SE_us(null);
  const [bulkConfirm, setBulkConfirm] = SE_us(null);
  const [events, setEvents] = SE_us(SE_D.EVENTS);
  const [selected, setSelected] = SE_us({});
  const [newEvent, setNewEvent] = SE_us({ name: 'Carter Garden Brunch', desc: 'Saturday morning brunch with garden installations and intimate tablescapes for 80 guests.', date: '2026-07-04', start: '10:00', end: '15:00', venueId: SE_D.VENUES[0]?.id, image: '', address: '' });
  const toast = useToast();

  React.useEffect(() => setView(viewMode || 'table'), [viewMode]);

  const filtered = events
    .filter(e => filter[e.status])
    .filter(e => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const v = SE_D.VENUES.find(x => x.id === e.venueId);
      return [e.name, e.desc, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'date-asc')  return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'name')      return a.name.localeCompare(b.name);
      if (sortBy === 'fill')      return (b.filledCount / b.gigCount) - (a.filledCount / a.gigCount);
      return 0;
    });

  const paged = usePaged(filtered, 10, `${search}|${sortBy}|${filter.open ? 1 : 0}${filter.draft ? 1 : 0}${filter.completed ? 1 : 0}|${filtered.length}`);
  const tableRows = view === 'table' ? paged.slice : filtered;
  const pickedIds = Object.keys(selected).filter(k => selected[k]);
  const pickedCount = pickedIds.length;

  const applyBulk = (action) => {
    if (action === 'open' || action === 'draft' || action === 'completed') {
      setEvents(es => es.map(e => pickedIds.includes(e.id) ? { ...e, status: action } : e));
      toast.push({ kind: 'success', title: `${pickedCount} marked ${action}` });
      setSelected({});
    } else if (action === 'delete') {
      setBulkConfirm({ ids: pickedIds, count: pickedCount });
    }
  };
  const confirmBulkDelete = () => {
    setEvents(es => es.filter(e => !bulkConfirm.ids.includes(e.id)));
    toast.push({ kind: 'warning', title: `${bulkConfirm.count} events deleted` });
    setSelected({}); setBulkConfirm(null);
  };

  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SE_I.CalendarCheck} label="All New Events" value={9}  delta={20}  />
        <StatCard icon={SE_I.Calendar}      label="Open Events"    value={6}  delta={20}  />
        <StatCard icon={SE_I.Briefcase}     label="All Gigs"       value={32} delta={9}   />
        <StatCard icon={SE_I.ClipboardList} label="Open Gigs"      value={7}  delta={-3}  />
      </div>

      <div className="section-heading">
        <h2>My events</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <SE_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search events..." style={{ paddingLeft: 36, width: 220, height: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date-asc','Soonest first'],['date-desc','Latest first'],['name','Name A–Z'],['fill','Most filled']]} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SE_I.Filter size={14} />Filters {Object.values(filter).filter(Boolean).length < 3 ? `(${3 - Object.values(filter).filter(x => !x).length})` : ''}</button>
          <div style={{ display: 'inline-flex', borderRadius: 9999, padding: 3, background: 'var(--color-surface-soft)' }}>
            <button onClick={() => setView('table')} className={`row-action-btn`} style={{ background: view==='table' ? 'var(--color-canvas)' : 'transparent', boxShadow: view==='table' ? 'var(--shadow-soft)' : 'none', borderRadius: 9999 }}><SE_I.ClipboardList size={15} /></button>
            <button onClick={() => setView('cards')} className={`row-action-btn`} style={{ background: view==='cards' ? 'var(--color-canvas)' : 'transparent', boxShadow: view==='cards' ? 'var(--shadow-soft)' : 'none', borderRadius: 9999 }}><SE_I.Image size={15} /></button>
          </div>
          <button className="btn btn-coral" onClick={() => setAddOpen(true)}><SE_I.Plus size={15} />New Event</button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid-3">
          {filtered.map(e => <EventCard key={e.id} event={e} onClick={() => setRoute('events:' + e.id)} />)}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="rosy-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <CheckBox
                    checked={tableRows.length > 0 && tableRows.every(e => selected[e.id])}
                    onChange={(on) => { setSelected(s => { const n = { ...s }; tableRows.forEach(e => { if (on) n[e.id] = true; else delete n[e.id]; }); return n; }); }} />
                </th>
                <th>Event</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Gigs filled</th>
                <th>Status</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr><td colSpan={7}>
                  <Empty icon={SE_I.Calendar} title="No events yet" body="Create your first event to start posting gigs." cta={<button className="btn btn-coral" onClick={() => setAddOpen(true)}><SE_I.Plus size={14} />New Event</button>} />
                </td></tr>
              ) : tableRows.map(e => {
                const v = SE_D.VENUES.find(v => v.id === e.venueId);
                return (
                  <tr key={e.id} tabIndex={0} role="button" aria-label={`Open ${e.name}`}
                      onClick={(ev) => { if (ev.target.closest('button')) return; setRoute('events:' + e.id); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); setRoute('events:' + e.id); } }}
                      style={{ cursor: 'pointer' }}>
                    <td onClick={(ev) => ev.stopPropagation()}><CheckBox checked={!!selected[e.id]} onChange={(on) => setSelected(s => ({ ...s, [e.id]: on }))} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <EventImage src={e.image} name={e.name} size={44} radius={10} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-ink)', fontSize: 14 }}>{e.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.desc}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{fmtDate(e.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{e.start}–{e.end}</span></td>
                    <td style={{ fontSize: 13 }}>{v?.name}<br/><span className="t-muted" style={{ fontSize: 12 }}>{v?.city}</span></td>
                    <td>{e.filledCount}/{e.gigCount}</td>
                    <td><Badge kind={e.status === 'open' ? 'Open' : e.status === 'draft' ? 'Draft' : 'Completed'} /></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="row-actions">
                        <button className="row-action-btn" onClick={() => setRoute('events:' + e.id)} title="View"><SE_I.Eye size={14} /></button>
                        <button className="row-action-btn" onClick={() => setEditEvent(e)} title="Edit"><SE_I.Pencil size={14} /></button>
                        <button className="row-action-btn danger" onClick={() => setConfirmId(e.id)} title="Delete"><SE_I.Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="events" />
        </div>
      )}

      <BulkActionBar count={pickedCount} onClear={() => setSelected({})}
        actions={[
          { label: 'Mark Open',     icon: SE_I.CheckCircle2, onClick: () => applyBulk('open') },
          { label: 'Mark Draft',    icon: SE_I.ClipboardList, onClick: () => applyBulk('draft') },
          { label: 'Mark Completed', icon: SE_I.CheckCircle, onClick: () => applyBulk('completed') },
          { label: 'Delete', icon: SE_I.Trash2, danger: true, onClick: () => applyBulk('delete') },
        ]} />

      <Slideover open={!!editEvent} onClose={() => setEditEvent(null)} title={editEvent ? `Edit · ${editEvent.name}` : 'Edit event'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditEvent(null)}>Cancel</button>
            <button className="btn btn-coral" onClick={() => {
              const id = editEvent.id;
              setEvents(es => es.map(x => x.id === id ? { ...x, ...editEvent } : x));
              toast.push({ kind: 'success', title: 'Event updated', body: `${editEvent.name} saved.` });
              setEditEvent(null);
            }}>Save changes</button>
          </>
        }>
        {editEvent ? <NewEventForm value={editEvent} onChange={setEditEvent} /> : null}
      </Slideover>

      <ConfirmDialog open={!!bulkConfirm} onClose={() => setBulkConfirm(null)}
        title={bulkConfirm ? `Delete ${bulkConfirm.count} events?` : ''} message="This will also remove their gigs, applications, and pending payments."
        confirmLabel="Delete" onConfirm={confirmBulkDelete} />

      <Slideover open={addOpen} onClose={() => setAddOpen(false)} title="New Event"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Save draft</button>
            <WriteForMe context={{ kind: 'event', fields: ['name','desc'] }}
              placeholderQuestions={[
                { key: 'eventName', label: 'Event name (or vibe)', placeholder: 'e.g. Carter Garden Wedding' },
                { key: 'kind', label: 'Event type', placeholder: 'wedding, gala, brand activation...' },
                { key: 'guests', label: 'Guest count', placeholder: '180' },
                { key: 'style', label: 'Style', placeholder: 'modern garden, editorial, moody...' },
                { key: 'notes', label: 'Anything we should know?', type: 'textarea', placeholder: 'Palette, installation scope, special requests...' },
              ]}
              onFill={(d) => { setNewEvent(s => ({ ...s, name: d.name || s.name, desc: d.desc || s.desc })); }} />
            <button className="btn btn-coral" disabled={!newEvent.name.trim() || !newEvent.desc.trim()}
              onClick={() => { setAddOpen(false); toast.push({ kind: 'success', title: 'Event published', body: `${newEvent.name} is open for gig posts.` }); }}>Publish Event</button>
          </>
        }>
        <NewEventForm value={newEvent} onChange={setNewEvent} />
      </Slideover>

      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} title="Delete this event?" message="This will also remove all gigs, applications, and pending payments. You can't undo this."
        confirmLabel="Delete event"
        onConfirm={() => { setEvents(es => es.filter(x => x.id !== confirmId)); toast.push({ kind: 'warning', title: 'Event deleted' }); }} />

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter events" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setFilter({open: true, draft: true, completed: true})}>Reset</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
        <div className="col">
          {Object.keys(filter).map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', cursor: 'pointer' }}>
              <span className={`checkbox ${filter[k] ? 'checked' : ''}`} onClick={() => setFilter(f => ({ ...f, [k]: !f[k] }))}>
                {filter[k] ? <SE_I.CheckCircle size={12} /> : null}
              </span>
              <span style={{ textTransform: 'capitalize' }}>{k} events</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function EventCard({ event, onClick }) {
  const v = SE_D.VENUES.find(v => v.id === event.venueId);
  return (
    <div className="event-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="ec-image" style={{ position: 'relative', overflow: 'hidden' }}>
        <EventImage src={event.image} name={event.name} size="100%" radius={0}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <Badge kind={event.status === 'open' ? 'Open' : event.status === 'draft' ? 'Draft' : 'Completed'} />
      </div>
      <div className="ec-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h4>{event.name}</h4>
        </div>
        <p className="ec-desc">{event.desc}</p>
        <div className="ec-chips">{event.types.map(t => <GigChip key={t} type={t} />)}</div>
        <div className="ec-footer">
          <Avatar name={SE_D.USERS.find(u => u.id === event.vendorId)?.name || 'Vendor'} size="sm" />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{SE_D.USERS.find(u => u.id === event.vendorId)?.company}</p>
            <p style={{ margin: '1px 0 0', color: 'var(--color-muted)', fontSize: 11.5 }}>{v?.name} · {fmtDate(event.date, 'mdy-dots')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewEventForm({ value = {}, onChange = () => {} }) {
  const upd = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="field"><label className="field-label">Event name *</label><input className="input" value={value.name || ''} onChange={e => upd('name', e.target.value)} placeholder="e.g. Carter Garden Brunch" /></div>
      <div className="field"><label className="field-label">Description *</label><textarea className="textarea" value={value.desc || ''} onChange={e => upd('desc', e.target.value)} placeholder="Paint the room. What's the palette, scope, vibe?" /></div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Event date</label><input className="input" type="date" value={value.date || ''} onChange={e => upd('date', e.target.value)} /></div>
        <div className="field"><label className="field-label">Start time</label><input className="input" type="time" value={value.start || ''} onChange={e => upd('start', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">End time</label><input className="input" type="time" value={value.end || ''} onChange={e => upd('end', e.target.value)} /></div>
        <div className="field"><label className="field-label">Venue</label>
          <select className="select" value={value.venueId || ''} onChange={e => upd('venueId', e.target.value)}>
            {SE_D.VENUES.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label className="field-label">Venue address</label>
        <AddressInput value={value.address || ''} onChange={(v) => upd('address', v)} placeholder="Confirm or override the venue address" />
      </div>
      <div className="field"><label className="field-label">Cover image</label>
        <ImageUpload value={value.image || ''} onChange={(v) => upd('image', v)} label="Upload cover image" size={120} round={false} />
      </div>
      <div className="field"><label className="field-label">Gig types needed</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(value.types || ['Lead','Design','Assist','Strike']).map(t => <GigChip key={t} type={t} />)}
        </div>
      </div>
    </div>
  );
}

/* ----- Worker events browse (card grid) ----- */
function PageEventsWorker({ setRoute }) {
  const [filters, setFilters] = SE_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [search, setSearch] = SE_us('');
  const activeTypes = Object.keys(filters).filter(k => filters[k]);
  const events = SE_D.EVENTS
    .filter(e => e.status === 'open')
    .filter(e => e.types.some(t => activeTypes.includes(t)))
    .filter(e => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const v = SE_D.VENUES.find(x => x.id === e.venueId);
      return [e.name, e.desc, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
    });
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Browse events</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SE_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search events, venues..." style={{ paddingLeft: 36, width: 260 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="t-eyebrow" style={{ marginRight: 4 }}>Show roles</span>
        {Object.keys(filters).map(k => (
          <button key={k} onClick={() => setFilters(f => ({ ...f, [k]: !f[k] }))}
            style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', opacity: filters[k] ? 1 : 0.35, transition: 'opacity 120ms ease' }}>
            <GigChip type={k} />
          </button>
        ))}
      </div>
      <div className="grid-3">
        {events.length === 0 ?
          <div style={{ gridColumn: '1 / -1' }}><Empty icon={SE_I.Calendar} title="No matching events" body="Try clearing your filters or a broader search." /></div>
          : events.map(e => <EventCard key={e.id} event={e} onClick={() => setRoute('events:' + e.id)} />)}
      </div>
    </div>
  );
}

/* ----- Event detail (vendor + worker view) ----- */
function PageEventDetail({ eventId, role, setRoute }) {
  const e = SE_D.EVENTS.find(x => x.id === eventId);
  if (!e) return <div className="content"><Empty title="Event not found" /></div>;
  const v = SE_D.VENUES.find(x => x.id === e.venueId);
  const vendor = SE_D.USERS.find(x => x.id === e.vendorId);
  const gigs = SE_D.GIGS.filter(g => g.eventId === e.id);
  const [tab, setTab] = SE_us('overview');
  const toast = useToast();
  const [applyGig, setApplyGig] = SE_us(null);
  const [editOpen, setEditOpen] = SE_us(false);
  const [editForm, setEditForm] = SE_us({ name: e.name, desc: e.desc, date: e.date });
  const [decided, setDecided] = SE_us({});

  return (
    <div className="content fade-up">
      <button className="btn-link" style={{ marginBottom: 12 }} onClick={() => setRoute('events')}><SE_I.ChevronLeft size={14} />Back to events</button>
      <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', height: 280, marginBottom: 24, background: 'linear-gradient(135deg, #FDBA9C, #F47C5D)' }}>
        <EventImage src={e.image} name={e.name} size="100%" radius={0}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'absolute', top: 20, right: 20 }}><Badge kind={e.status === 'open' ? 'Open' : e.status === 'draft' ? 'Draft' : 'Completed'} /></div>
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.9, fontWeight: 500 }}>{fmtDate(e.date, 'mdy-dots')} · {e.start}–{e.end} · {v?.name}, {v?.city}</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 48, letterSpacing: '-0.02em', margin: '8px 0 0', lineHeight: 1.05 }}>{e.name}</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs">
          {['overview','gigs','applications','payments'].map(t => (
            <button key={t} className={tab===t ? 'on' : ''} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        {role === 'vendor' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setEditForm({ name: e.name, desc: e.desc, date: e.date }); setEditOpen(true); }}><SE_I.Pencil size={14} />Edit event</button>
            <button className="btn btn-coral" onClick={() => setRoute && setRoute('gigs')}><SE_I.Plus size={14} />Add gig</button>
          </div>
        ) : null}
      </div>

      {tab === 'overview' ? (
        <div className="grid-dash">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 10 }}>About this event</h3>
            <p style={{ color: 'var(--color-body)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{e.desc}</p>
            <div className="divider" style={{ margin: '18px 0' }} />
            <div className="grid-2" style={{ gap: 16 }}>
              <KV label="Date" value={fmtDate(e.date, 'mdy-dots')} />
              <KV label="Hours" value={`${e.start} – ${e.end}`} />
              <KV label="Venue" value={`${v?.name} · ${v?.city}`} />
              <KV label="Capacity" value={`${v?.capacity} guests`} />
              <KV label="Status" value={<Badge kind={e.status === 'open' ? 'Open' : 'Draft'} />} />
              <KV label="Gig fill" value={`${e.filledCount} of ${e.gigCount} confirmed`} />
            </div>
          </div>
          <div className="col" style={{ gap: 16 }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 10 }}>Vendor</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar name={vendor?.name} size="lg" />
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{vendor?.company}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>{vendor?.name} · {vendor?.city}</p>
                </div>
              </div>
              <button className="btn btn-ghost-teal btn-sm" style={{ marginTop: 14 }} onClick={() => { setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${vendor?.first}` }); }}><SE_I.MessageSquare size={14} />Message</button>
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 10 }}>Gig types</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{e.types.map(t => <GigChip key={t} type={t} />)}</div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'gigs' ? (
        <div className="table-wrap">
          <table className="rosy-table">
            <thead><tr><th>Gig</th><th>Date / time</th><th>Filled</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {gigs.map(g => (
                <tr key={g.id}>
                  <td><GigChip type={g.type} /><p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)', maxWidth: 360 }}>{g.description}</p></td>
                  <td style={{ fontSize: 13 }}>{fmtDate(g.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{g.start}–{g.end}</span></td>
                  <td>{g.spotsFilled}/{g.spots}</td>
                  <td className="t-mono-amount">${g.rate}/hr</td>
                  <td><Badge kind={g.status === 'confirmed' ? 'Confirmed' : g.status === 'completed' ? 'Completed' : 'Open'} /></td>
                  <td>
                    {role === 'worker' && g.status === 'open' ? (
                      <button className="btn btn-coral btn-sm" onClick={() => setApplyGig(g)}>Apply</button>
                    ) : <button className="btn btn-ghost btn-sm">Details</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'applications' ? (
        <div className="card card-flush">
          {SE_D.USERS.filter(u => u.role === 'worker').slice(0, 4).filter(w => !decided[w.id]).map(w => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
              <Avatar name={w.name} size="lg" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{w.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>{w.company} · {w.gigs || 0} gigs · ★ {w.rating || '—'}</p>
              </div>
              <span className="pill"><SE_I.Briefcase size={12} style={{ marginRight: 4 }} />Assist</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${w.first}` }); }}>Message</button>
              <button className="btn btn-ghost-coral btn-sm" onClick={() => { setDecided(d => ({ ...d, [w.id]: 'rejected' })); toast.push({ kind: 'warning', title: `${w.first} rejected` }); }}>Reject</button>
              <button className="btn btn-coral btn-sm" onClick={() => { setDecided(d => ({ ...d, [w.id]: 'approved' })); toast.push({ kind: 'success', title: `${w.first} approved`, body: 'They\'ll get an email + push notification.' }); }}>Approve</button>
            </div>
          ))}
          {SE_D.USERS.filter(u => u.role === 'worker').slice(0, 4).every(w => decided[w.id]) ? <div style={{ padding: 28 }}><Empty icon={SE_I.ClipboardList} title="All applications reviewed" body="Decisions sent to applicants." /></div> : null}
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="card card-flush">
          <table className="rosy-table">
            <thead><tr><th>Invoice</th><th>Worker</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {SE_D.TRANSACTIONS.slice(0, 4).map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.invoice}</td>
                  <td>{t.payee}</td>
                  <td><Badge kind={t.status} /></td>
                  <td className="t-mono-amount">{fmtMoney(t.amount)}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{fmtDate(t.date, 'mdy-dots')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={!!applyGig} onClose={() => setApplyGig(null)} title="Apply for this gig" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setApplyGig(null)}>Cancel</button><button className="btn btn-coral" onClick={() => { setApplyGig(null); toast.push({ kind: 'success', title: 'Application sent', body: `You'll hear from ${vendor?.first || 'the vendor'} soon.` }); }}>Confirm application</button></>}>
        {applyGig ? (
          <div>
            <p style={{ margin: '0 0 16px' }}><GigChip type={applyGig.type} /> {e.name}</p>
            <KV label="Date" value={`${fmtDate(applyGig.date, 'mdy-dots')} · ${applyGig.start}–${applyGig.end}`} />
            <KV label="Rate" value={`$${applyGig.rate}/hr`} />
            <KV label="Spots" value={`${applyGig.spots - applyGig.spotsFilled} left of ${applyGig.spots}`} />
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-body)' }}>{applyGig.description}</p>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit event" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button><button className="btn btn-coral" onClick={() => { setEditOpen(false); toast.push({ kind: 'success', title: 'Event updated', body: `${editForm.name} saved.` }); }}>Save changes</button></>}>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Event name</label><input className="input" value={editForm.name} onChange={(ev) => setEditForm(f => ({ ...f, name: ev.target.value }))} /></div>
          <div className="field"><label className="field-label">Description</label><textarea className="textarea" value={editForm.desc} onChange={(ev) => setEditForm(f => ({ ...f, desc: ev.target.value }))} /></div>
          <div className="field"><label className="field-label">Date</label><input className="input" type="date" value={editForm.date} onChange={(ev) => setEditForm(f => ({ ...f, date: ev.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{label}</p>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{value}</div>
    </div>
  );
}

Object.assign(window, { PageEventsVendor, PageEventsWorker, PageEventDetail, EventCard, KV });

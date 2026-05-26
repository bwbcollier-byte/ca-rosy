/* Events screens: vendor list (table/card), event detail, worker event browse */

const SE_D = window.RosyData;
const SE_I = window.Icons;
const { useState: SE_us, useEffect: SE_ue } = React;

function PageEventsVendor({ user, role, setRoute, viewMode, density }) {
  const [view, setView] = SE_us(viewMode || 'table');
  const [search, setSearch] = SE_us('');
  const [sortBy, setSortBy] = SE_us('date-asc');
  const [filter, setFilter] = SE_us({ open: true, draft: true, completed: true });
  const [typeFilter, setTypeFilter] = SE_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [venueFilter, setVenueFilter] = SE_us('all');
  const [dateFilter, setDateFilter] = SE_us('any'); // any | upcoming | thismonth | past
  const [filterOpen, setFilterOpen] = SE_us(false);
  const [addOpen, setAddOpen] = SE_us(false);
  const [addVenueOpen, setAddVenueOpen] = SE_us(false);
  const [savingVenue, setSavingVenue] = SE_us(false);
  const blankVenue = { name: '', address: '', city: '', state: '', country: '', addressParts: null, addressLatLng: null, enriched: null };
  const [newVenue, setNewVenue] = SE_us(blankVenue);
  SE_ue(() => { if (addVenueOpen) setNewVenue(blankVenue); }, [addVenueOpen]);
  // Honor cross-page "open Add Event modal on mount" intent
  SE_ue(() => { if (window.__rosyOpenAddEvent) { window.__rosyOpenAddEvent = false; setAddOpen(true); } }, []);
  const [editEvent, setEditEvent] = SE_us(null);
  const [confirmId, setConfirmId] = SE_us(null);
  const [bulkConfirm, setBulkConfirm] = SE_us(null);
  // Vendors only see their own events; admins see all.
  const scopeForRole = (arr) => (role === 'vendor' && user?.id) ? arr.filter(e => e.vendorId === user.id) : arr;
  const [events, setEvents] = SE_us(scopeForRole(SE_D.EVENTS));
  // Sync local state with realtime / cross-screen mutations
  SE_ue(() => {
    const sync = () => setEvents(scopeForRole([...SE_D.EVENTS]));
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, [role, user?.id]);
  const [selected, setSelected] = SE_us({});
  const [postCreatePrompt, setPostCreatePrompt] = SE_us(null);
  const blankEvent = { name: '', desc: '', date: '', endDate: '', start: '', end: '', venueId: '', image: '', address: '', types: ['Lead','Design','Assist','Strike'] };
  const [newEvent, setNewEvent] = SE_us(blankEvent);
  const [publishingEvent, setPublishingEvent] = SE_us(false);
  const publishEvent = async () => {
    if (publishingEvent) return;
    // Don't allow events in the past.
    const todayIso = new Date().toISOString().slice(0, 10);
    if (newEvent.date && newEvent.date < todayIso) { toast.push({ kind: 'warning', title: 'Event date must be today or in the future' }); return; }
    // End time must be after start time on the same day. (Multi-day events use endDate.)
    if (newEvent.start && newEvent.end && newEvent.end <= newEvent.start && !newEvent.endDate) {
      toast.push({ kind: 'warning', title: 'End time must be after start time' }); return;
    }
    // Multi-day: endDate must be on or after start date.
    if (newEvent.endDate && newEvent.date && newEvent.endDate < newEvent.date) {
      toast.push({ kind: 'warning', title: 'End date must be on or after start date' }); return;
    }
    setPublishingEvent(true);
    const draftEvent = { ...newEvent, vendorId: user?.id, status: 'open', gigCount: 0, filledCount: 0 };
    let createdId = null;
    try {
      const live = await window.RosyMutate?.events?.create(draftEvent);
      if (live) { setEvents(es => [live, ...es]); createdId = live.id; }
      else      { createdId = 'e_' + Math.random().toString(36).slice(2,8); setEvents(es => [{ id: createdId, ...draftEvent }, ...es]); }
    } catch (e) { console.warn(e); toast.push({ kind: 'error', title: 'Publish failed', body: e.message }); setPublishingEvent(false); return; }
    setAddOpen(false);
    toast.push({ kind: 'success', title: 'Event published', body: `${newEvent.name} is open for gig posts.` });
    if (createdId) setPostCreatePrompt({ eventId: createdId, name: newEvent.name });
    setPublishingEvent(false);
  };
  // Reset to blank every time the slideover opens (so each new-event session starts clean).
  SE_ue(() => { if (addOpen) setNewEvent(blankEvent); }, [addOpen]);
  const toast = useToast();

  React.useEffect(() => setView(viewMode || 'table'), [viewMode]);

  const today = new Date(); today.setHours(0,0,0,0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const filtered = events
    .filter(e => filter[e.status])
    .filter(e => {
      // Legacy / freshly-created events sometimes have no types yet (column
      // came in later). Treat empty types as "passes the filter" rather than
      // hiding the event — otherwise new events vanish from the table.
      const ts = e.types || [];
      return ts.length === 0 || ts.some(t => typeFilter[t]);
    })
    .filter(e => venueFilter === 'all' || e.venueId === venueFilter)
    .filter(e => {
      if (dateFilter === 'any') return true;
      const d = new Date(e.date);
      if (dateFilter === 'upcoming')  return d >= today;
      if (dateFilter === 'past')      return d <  today;
      if (dateFilter === 'thismonth') return d >= today && d <= monthEnd;
      return true;
    })
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
      if (sortBy === 'fill')      return ((b.gigCount ? b.filledCount / b.gigCount : 0)) - ((a.gigCount ? a.filledCount / a.gigCount : 0));
      return 0;
    });

  const paged = usePaged(filtered, view === 'cards' ? 9 : 10, `${view}|${search}|${sortBy}|${JSON.stringify(filter)}|${JSON.stringify(typeFilter)}|${venueFilter}|${dateFilter}|${filtered.length}`);
  const tableRows = paged.slice;
  const pickedIds = Object.keys(selected).filter(k => selected[k]);
  const pickedCount = pickedIds.length;

  const applyBulk = async (action) => {
    if (action === 'open' || action === 'draft' || action === 'completed') {
      setEvents(es => es.map(e => pickedIds.includes(e.id) ? { ...e, status: action } : e));
      try { await Promise.all(pickedIds.map(id => window.RosyMutate?.events?.update(id, { status: action }))); } catch (e) { console.warn(e); }
      toast.push({ kind: 'success', title: `${pickedCount} marked ${action}` });
      setSelected({});
    }
  };

  // Live stat counts from window.RosyData (replaces hardcoded 9/6/32/7 demo values).
  // Vendor scope: only count this vendor's events/gigs. Admins see global.
  const allEvents = (window.RosyData?.EVENTS || []).filter(e => role === 'admin' || !user?.id || e.vendorId === user.id);
  const allGigs = (window.RosyData?.GIGS || []).filter(g => allEvents.some(e => e.id === g.eventId));
  const myEventsCount = allEvents.length;
  const openEventsCount = allEvents.filter(e => e.status === 'open').length;
  const myGigsCount = allGigs.length;
  const openGigsCount = allGigs.filter(g => g.status === 'open').length;
  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SE_I.CalendarCheck} label={role === 'admin' ? 'All events' : 'My Events'} value={myEventsCount} onClick={() => setRoute && setRoute('events')} />
        <StatCard icon={SE_I.Calendar}      label="Open Events" value={openEventsCount} dateStrip="Live" onClick={() => setRoute && setRoute('events')} />
        <StatCard icon={SE_I.Briefcase}     label={role === 'admin' ? 'All gigs' : 'My Gigs'} value={myGigsCount} onClick={() => setRoute && setRoute('gigs')} />
        <StatCard icon={SE_I.ClipboardList} label="Open Gigs"   value={openGigsCount} dateStrip="Live" onClick={() => setRoute && setRoute('gigs')} />
      </div>

      <div className="section-heading">
        <h2>{role === 'admin' ? 'All events' : 'My events'}</h2>
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
        <>
          {tableRows.length === 0 ? <Empty icon={SE_I.Calendar} title="No events match" body="Adjust filters or search to see more." /> : (
            <div className="grid-3">
              {tableRows.map(e => <EventCard key={e.id} event={e} onClick={() => setRoute('events:' + e.id)} />)}
            </div>
          )}
          {paged.total > paged.perPage ? <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="events" /> : null}
        </>
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
                    <td style={{ fontSize: 13 }}>{fmtDate(e.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{fmtTime(e.start)}–{fmtTime(e.end)}</span></td>
                    <td style={{ fontSize: 13 }}>{v?.name}<br/><span className="t-muted" style={{ fontSize: 12 }}>{v?.city}</span></td>
                    <td>{e.filledCount}/{e.gigCount}</td>
                    <td><Badge kind={e.status === 'open' ? 'Open' : e.status === 'draft' ? 'Draft' : 'Completed'} /></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="row-actions">
                        <button className="row-action-btn" onClick={() => setRoute('events:' + e.id)} title="View"><SE_I.Eye size={14} /></button>
                        <button className="row-action-btn" onClick={() => setEditEvent(e)} title="Edit"><SE_I.Pencil size={14} /></button>
                        <button className="row-action-btn" title={e.status === 'completed' ? 'Mark draft' : 'Mark completed'} onClick={async () => {
                          const next = e.status === 'completed' ? 'draft' : 'completed';
                          setEvents(es => es.map(x => x.id === e.id ? { ...x, status: next } : x));
                          try { await window.RosyMutate?.events?.update(e.id, { status: next }); } catch (err) { console.warn(err); }
                          toast.push({ kind: next === 'completed' ? 'success' : 'warning', title: `${e.name} marked ${next}` });
                        }}>{e.status === 'completed' ? <SE_I.CheckCircle2 size={14} /> : <SE_I.UserX size={14} />}</button>
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
        ]} />

      <Slideover open={!!editEvent} onClose={() => setEditEvent(null)} title={editEvent ? `Edit · ${editEvent.name}` : 'Edit event'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditEvent(null)}>Cancel</button>
            <button className="btn btn-coral" onClick={async () => {
              const id = editEvent.id;
              const patch = editEvent;
              setEvents(es => es.map(x => x.id === id ? { ...x, ...patch } : x));
              try { await window.RosyMutate?.events?.update(id, patch); } catch (e) { console.warn(e); }
              toast.push({ kind: 'success', title: 'Event updated', body: `${patch.name} saved.` });
              setEditEvent(null);
            }}>Save changes</button>
          </>
        }>
        {editEvent ? <NewEventForm value={editEvent} onChange={setEditEvent} /> : null}
      </Slideover>

      <Slideover open={addOpen} onClose={() => setAddOpen(false)} title="New Event"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Save draft</button>
            <WriteForMe context={{ kind: 'event', fields: ['name','desc','imageKey'] }}
              placeholderQuestions={[
                { key: 'eventName', label: 'Event name (or vibe)', placeholder: 'e.g. Carter Garden Wedding' },
                { key: 'kind', label: 'Event type', placeholder: 'wedding, gala, brand activation...' },
                { key: 'guests', label: 'Guest count', placeholder: '180' },
                { key: 'style', label: 'Style', placeholder: 'modern garden, editorial, moody...' },
                { key: 'venue', label: 'Venue type', placeholder: 'glass conservatory, barn, industrial loft...' },
                { key: 'palette', label: 'Palette', placeholder: 'ivory + blush, deep burgundy, soft sage...' },
                { key: 'notes', label: 'Anything else?', type: 'textarea', placeholder: 'Installation moments, scope, special requests...' },
              ]}
              onFill={(d) => { setNewEvent(s => ({
                ...s,
                name: d.name || s.name,
                desc: d.desc || d._raw || s.desc,
                // Only fill the cover image if the user hasn't already uploaded their own.
                image: s.image || d.image || '',
              })); }} />
            <button className="btn btn-coral" disabled={publishingEvent || !newEvent.name?.trim() || !newEvent.desc?.trim() || !newEvent.date || !newEvent.start || !newEvent.end || !newEvent.venueId} onClick={publishEvent}>{publishingEvent ? 'Publishing…' : 'Publish Event'}</button>
          </>
        }>
        <NewEventForm value={newEvent} onChange={setNewEvent}
          onCreateVenue={() => setAddVenueOpen(true)} />
      </Slideover>

      {/* Quick-add venue — opens ON TOP of the new-event slideover so the user
          doesn't lose their in-progress event form. On save, the new venue is
          selected in the event form's dropdown automatically. */}
      <Modal open={addVenueOpen} onClose={() => setAddVenueOpen(false)} title="Add venue" size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddVenueOpen(false)}>Cancel</button>
            <button className="btn btn-coral" disabled={savingVenue || !newVenue.name?.trim() || !newVenue.address?.trim()} onClick={async () => {
              if (savingVenue) return;
              setSavingVenue(true);
              try {
                const enr = newVenue.enriched || {};
                // Auto-pick a category from Google's `types` array. Most useful
                // types come first ("restaurant", "wedding_venue", etc.) — strip
                // generic ones like "point_of_interest" / "establishment".
                const genericTypes = new Set(['point_of_interest','establishment','premise','street_address','political','geocode']);
                const categoryRaw = (enr.types || []).find(t => !genericTypes.has(t)) || null;
                const category = categoryRaw ? categoryRaw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;
                // Open hours from Google come as weekday_text strings; pack into
                // jsonb shape compatible with our existing business_hours pattern.
                const businessHours = Array.isArray(enr.openingHours) && typeof enr.openingHours[0] === 'string'
                  ? { weekday_text: enr.openingHours }
                  : (enr.openingHours || null);
                const payload = {
                  // Prefer the Google-canonical name if the user kept the picker's
                  // selection; their typed value otherwise.
                  name: newVenue.name.trim(),
                  address: newVenue.address.trim(),
                  city: newVenue.addressParts?.city || newVenue.city || null,
                  state: newVenue.addressParts?.state || newVenue.state || null,
                  zip: newVenue.addressParts?.zip || null,
                  country: newVenue.addressParts?.country || newVenue.country || null,
                  latitude: newVenue.addressLatLng?.lat ?? null,
                  longitude: newVenue.addressLatLng?.lng ?? null,
                  // Enriched fields from Google Places (venue mode AddressInput)
                  place_id: enr.placeId || null,
                  phone: enr.phone || null,
                  website: enr.website || null,
                  rating: enr.rating ?? null,
                  user_ratings_total: enr.userRatingsTotal ?? null,
                  category,
                  google_maps_url: enr.googleMapsUrl || null,
                  business_hours: businessHours,
                  image_url: enr.photoUrl || null,
                  active: true,
                };
                const created = await window.RosyMutate?.venues?.create(payload);
                const id = created?.id || ('v_' + Math.random().toString(36).slice(2, 8));
                if (!created) {
                  // Optimistic local insert if RosyMutate isn't wired (offline / template build).
                  SE_D.VENUES.unshift({ id, ...payload });
                  window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                }
                // Pre-select the new venue in the in-progress event form.
                setNewEvent(s => ({ ...s, venueId: id, address: payload.address }));
                setAddVenueOpen(false);
                toast.push({ kind: 'success', title: 'Venue added', body: `${payload.name} is selected for this event.` });
              } catch (e) {
                console.warn('venue create failed:', e);
                toast.push({ kind: 'error', title: 'Couldn’t save venue', body: e.message || 'Try again.' });
              } finally {
                setSavingVenue(false);
              }
            }}>{savingVenue ? 'Saving…' : 'Save venue'}</button>
          </>
        }>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Venue name *</label>
            <input className="input" value={newVenue.name} onChange={e => setNewVenue(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Carter Garden Estate" />
          </div>
          <div className="field"><label className="field-label">Address *</label>
            <AddressInput mode="venue"
              value={newVenue.address}
              onChange={(v, meta) => setNewVenue(s => ({
                ...s,
                // When the user picks a Google suggestion, prefer the canonical
                // venue name if the field hasn't already been edited manually.
                name: s.name?.trim() ? s.name : (meta?.enriched?.name || s.name),
                address: v,
                addressParts: meta?.parts || null,
                addressLatLng: meta ? { lat: meta.lat, lng: meta.lng } : null,
                enriched: meta?.enriched || null,
              }))}
              placeholder="Search the venue (or type the address)" />
            {newVenue.enriched ? (
              <p className="field-hint" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--rosy-teal-dark)' }}>
                ✓ Enriched from Google: {[
                  newVenue.enriched.rating ? `★ ${newVenue.enriched.rating}` : null,
                  newVenue.enriched.phone ? '📞' : null,
                  newVenue.enriched.website ? 'website' : null,
                  newVenue.enriched.photoUrl ? 'photo' : null,
                  newVenue.enriched.openingHours ? 'hours' : null,
                ].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
      {/* Post-create CTA — 'Add gigs now?' */}
      <ConfirmDialog open={!!postCreatePrompt} onClose={() => setPostCreatePrompt(null)}
        title="Event published 🎉"
        message={postCreatePrompt ? `Post gigs for ${postCreatePrompt.name} now so workers can start applying.` : ''}
        confirmLabel="Add gigs"
        onConfirm={() => { const id = postCreatePrompt.eventId; setPostCreatePrompt(null); window.__rosyAddGigEventId = id; setRoute && setRoute('gigs'); }} />

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter events" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setFilter({ open: true, draft: true, completed: true }); setTypeFilter({ Lead: true, Design: true, Assist: true, Strike: true }); setVenueFilter('all'); setDateFilter('any'); }}>Reset all</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(filter).map(k => (
                <button key={k} type="button" onClick={() => setFilter(f => ({ ...f, [k]: !f[k] }))} style={{ border: '1.5px solid', borderColor: filter[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: filter[k] ? 'var(--color-ink)' : 'transparent', color: filter[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Date range</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['any','Any time'],['upcoming','Upcoming'],['thismonth','This month'],['past','Past']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setDateFilter(id)} style={{ border: '1.5px solid', borderColor: dateFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: dateFilter === id ? 'var(--color-ink)' : 'transparent', color: dateFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Gig types needed</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(typeFilter).map(k => (
                <button key={k} type="button" onClick={() => setTypeFilter(f => ({ ...f, [k]: !f[k] }))} style={{ border: '1.5px solid', borderColor: typeFilter[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: typeFilter[k] ? 'var(--color-ink)' : 'transparent', color: typeFilter[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Venue</p>
            <select className="select" value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
              {(() => { const av = SE_D.VENUES.filter(v => v.active !== false); return <>
                <option value="all">All venues ({av.length})</option>
                {av.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
              </>; })()}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EventCard({ event, onClick, onApply, showApply = false }) {
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
          {showApply && event.status === 'open' ? (
            <button className="btn btn-coral btn-sm" onClick={(e) => { e.stopPropagation(); (onApply || onClick) && (onApply || onClick)(); }}>Apply</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NewEventForm({ value = {}, onChange = () => {}, onCreateVenue }) {
  const upd = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Image first per global pattern */}
      <div className="field"><label className="field-label">Cover image</label>
        <ImageUpload value={value.image || ''} onChange={(v) => upd('image', v)} label="Upload cover image" size={120} round={false} bucket="rr-event-images" />
      </div>
      <div className="field"><label className="field-label">Event name *</label><input className="input" value={value.name || ''} onChange={e => upd('name', e.target.value)} placeholder="e.g. Carter Garden Brunch" /></div>
      <div className="field"><label className="field-label">Description *</label><textarea className="textarea" value={value.desc || ''} onChange={e => upd('desc', e.target.value)} placeholder="Paint the room. What's the palette, scope, vibe?" /></div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Start date</label><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={value.date || ''} onChange={e => upd('date', e.target.value)} /></div>
        <div className="field"><label className="field-label">End date <span className="t-muted" style={{ fontWeight: 400 }}>(optional, for multi-day events)</span></label><input className="input" type="date" value={value.endDate || ''} min={value.date || undefined} onChange={e => upd('endDate', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label className="field-label">Start time</label><input className="input" type="time" value={value.start || ''} onChange={e => upd('start', e.target.value)} /></div>
        <div className="field"><label className="field-label">End time</label><input className="input" type="time" value={value.end || ''} onChange={e => upd('end', e.target.value)} /></div>
      </div>
      <div className="field"><label className="field-label">Venue</label>
        <select className="select" value={value.venueId || ''} onChange={e => {
          if (e.target.value === '__new__') { onCreateVenue && onCreateVenue(); return; }
          upd('venueId', e.target.value);
        }}>
          <option value="">— Pick a venue —</option>
          {SE_D.VENUES.filter(v => v.active !== false).map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
          <option value="__new__" style={{ fontWeight: 600 }}>+ Create new venue…</option>
        </select>
      </div>
      <div className="field"><label className="field-label">Venue address</label>
        <AddressInput value={value.address || ''} onChange={(v) => upd('address', v)} placeholder="Confirm or override the venue address" />
      </div>
      <div className="field"><label className="field-label">Gig types needed</label>
        <p className="field-hint" style={{ marginTop: -2, marginBottom: 4 }}>Tap to add or remove. {(value.types || ['Lead','Design','Assist','Strike']).length} selected.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Lead','Design','Assist','Strike'].map(t => {
            const selected = (value.types || ['Lead','Design','Assist','Strike']).includes(t);
            const toggle = () => {
              const cur = value.types || ['Lead','Design','Assist','Strike'];
              const next = selected ? cur.filter(x => x !== t) : [...cur, t];
              upd('types', next);
            };
            return (
              <button key={t} type="button" onClick={toggle}
                className={`gig-chip ${t.toLowerCase()}`}
                style={{ border: '1.5px solid', borderColor: selected ? 'currentColor' : 'transparent', opacity: selected ? 1 : 0.45, cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: 12, transition: 'opacity 120ms ease, border-color 120ms ease', background: 'transparent' }}>
                <span className="dot" />{t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----- Worker events browse (card grid) ----- */
function PageEventsWorker({ setRoute, currentUser }) {
  const [filters, setFilters] = SE_us({ Lead: true, Design: true, Assist: true, Strike: true });
  const [search, setSearch] = SE_us('');
  const [applyEvent, setApplyEvent] = SE_us(null);
  const [pickedGigId, setPickedGigId] = SE_us('');
  // Sort + filter + view parity with the worker /gig-posts page.
  const [sortBy, setSortBy] = SE_us('date-asc');
  const [dateFilter, setDateFilter] = SE_us('any');
  const [city, setCity] = SE_us('');
  const [radius, setRadius] = SE_us(25);
  const [view, setView] = SE_us('cards');
  const [filterOpen, setFilterOpen] = SE_us(false);
  const [locOpen, setLocOpen] = SE_us(false);
  const toast = useToast();
  const openApply = (ev) => { setApplyEvent(ev); setPickedGigId(''); };
  const closeApply = () => { setApplyEvent(null); setPickedGigId(''); };
  const eventGigs = applyEvent ? SE_D.GIGS.filter(g => g.eventId === applyEvent.id && (g.spots - g.spotsFilled) > 0) : [];
  const pickedGig = eventGigs.find(g => g.id === pickedGigId) || null;
  const submitApply = async () => {
    if (!pickedGig) return;
    const workerId = currentUser?.id || SE_D.USERS.find(u => u.role === 'worker')?.id;
    const vendor = SE_D.USERS.find(u => u.id === applyEvent.vendorId);
    const dup = (SE_D.APPLICATIONS || []).some(a => a.gigId === pickedGig.id && a.workerId === workerId && a.status !== 'withdrawn' && a.status !== 'rejected');
    closeApply();
    if (dup) { toast.push({ kind: 'warning', title: 'Already applied', body: 'You’ve already applied to this gig.' }); return; }
    try {
      await window.RosyMutate?.applications?.apply({ gigId: pickedGig.id, workerId });
    } catch (err) {
      console.warn(err);
      toast.push({ kind: 'error', title: 'Apply failed', body: err.message });
      return;
    }
    toast.push({ kind: 'success', title: 'Application sent', body: `You'll hear from ${vendor?.first || 'the vendor'} soon.` });
  };
  const activeTypes = Object.keys(filters).filter(k => filters[k]);
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setDate(monthEnd.getDate() + 30);
  let events = SE_D.EVENTS
    .filter(e => e.status === 'open')
    .filter(e => SE_D.GIGS.some(g => g.eventId === e.id && (g.spots - g.spotsFilled) > 0 && activeTypes.includes(g.type)))
    .filter(e => {
      if (dateFilter === 'any') return true;
      const d = new Date(e.date);
      if (dateFilter === 'thisweek')  return d <= weekEnd;
      if (dateFilter === 'thismonth') return d <= monthEnd;
      return true;
    })
    .filter(e => {
      if (!city.trim()) return true;
      const v = SE_D.VENUES.find(x => x.id === e.venueId);
      return (v?.city || '').toLowerCase().includes(city.trim().toLowerCase());
    })
    .filter(e => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const v = SE_D.VENUES.find(x => x.id === e.venueId);
      return [e.name, e.desc, v?.name, v?.city].some(s => (s || '').toLowerCase().includes(q));
    });
  events = [...events].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortBy === 'name')      return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'fill')      return ((a.filledCount || 0) / Math.max(a.gigCount || 1, 1)) - ((b.filledCount || 0) / Math.max(b.gigCount || 1, 1));
    return new Date(a.date) - new Date(b.date);
  });
  const stats = {
    open: events.length,
    nextWeek: events.filter(e => new Date(e.date) <= weekEnd).length,
    totalGigs: events.reduce((s, e) => s + (SE_D.GIGS.filter(g => g.eventId === e.id && (g.spots - g.spotsFilled) > 0).length), 0),
    avgRate: (() => {
      const rates = events.flatMap(e => SE_D.GIGS.filter(g => g.eventId === e.id).map(g => g.rate || 0)).filter(Boolean);
      return rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0;
    })(),
  };
  const activeFilters = (Object.values(filters).filter(v => !v).length > 0 ? 1 : 0) + (dateFilter !== 'any' ? 1 : 0);
  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SE_I.Calendar}    label="Open events"     value={stats.open} dateStrip="Live" />
        <StatCard icon={SE_I.CalendarCheck} label="Next 7 days"   value={stats.nextWeek} dateStrip="Live" />
        <StatCard icon={SE_I.Briefcase}   label="Gigs available"  value={stats.totalGigs} dateStrip="Live" />
        <StatCard icon={SE_I.DollarSign}  label="Avg rate"        value={stats.avgRate} prefix="$" />
      </div>
      <div className="section-heading">
        <h2>Browse events</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <SE_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search events, venues..." style={{ paddingLeft: 36, width: 240, height: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['date-asc','Soonest first'],['date-desc','Latest first'],['name','Name A–Z'],['fill','Least filled']]} />
          <div style={{ display: 'inline-flex', borderRadius: 9999, background: 'var(--color-surface-soft)', padding: 3 }}>
            <button className={`btn btn-sm ${view==='table' ? 'btn-ink' : 'btn-ghost'}`} onClick={() => setView('table')} style={{ height: 30, borderRadius: 9999 }}><SE_I.List size={14} />Table</button>
            <button className={`btn btn-sm ${view==='cards' ? 'btn-ink' : 'btn-ghost'}`} onClick={() => setView('cards')} style={{ height: 30, borderRadius: 9999 }}><SE_I.LayoutGrid size={14} />Cards</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SE_I.Filter size={14} />Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLocOpen(true)}><SE_I.MapPin size={14} />{city ? `${city}, ${radius} mi` : `Anywhere`}</button>
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
          : events.map(e => <EventCard key={e.id} event={e} showApply onClick={() => setRoute('events:' + e.id)} onApply={() => openApply(e)} />)}
      </div>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter events" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setFilters({ Lead: true, Design: true, Assist: true, Strike: true }); setDateFilter('any'); }}>Reset</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Date range</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['any','Any time'],['thisweek','Next 7 days'],['thismonth','Next 30 days']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setDateFilter(id)}
                  style={{ border: '1.5px solid', borderColor: dateFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: dateFilter === id ? 'var(--color-ink)' : 'transparent', color: dateFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Roles available</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(filters).map(k => (
                <button key={k} type="button" onClick={() => setFilters(f => ({ ...f, [k]: !f[k] }))}
                  style={{ border: '1.5px solid', borderColor: filters[k] ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: filters[k] ? 'var(--color-ink)' : 'transparent', color: filters[k] ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={locOpen} onClose={() => setLocOpen(false)} title="Filter by location" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => { setCity(''); setLocOpen(false); }}>Clear (anywhere)</button><button className="btn btn-coral" onClick={() => setLocOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chicago, Plano, San Francisco" />
          </div>
          <div className="field"><label className="field-label">Radius (mi)</label>
            <input className="input" type="number" min={1} max={500} value={radius} onChange={(e) => setRadius(Number(e.target.value) || 25)} />
            <p className="field-hint" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Radius display only — matching is substring on venue city for now.</p>
          </div>
        </div>
      </Modal>

      <Modal open={!!applyEvent} onClose={closeApply} title={applyEvent ? `Apply to ${applyEvent.name}` : 'Apply'} size="md"
        footer={<><button className="btn btn-ghost" onClick={closeApply}>Cancel</button><button className="btn btn-coral" disabled={!pickedGig} onClick={submitApply}>Confirm application</button></>}>
        {applyEvent ? (
          <div className="col" style={{ gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>Pick the gig you want to apply for. Only open gigs with spots remaining are shown.</p>
            {eventGigs.length === 0 ? (
              <Empty icon={SE_I.Briefcase} title="No open gigs" body="All gigs for this event are filled. Check back soon." />
            ) : (
              <div className="col" style={{ gap: 10 }}>
                {eventGigs.map(g => {
                  const selected = g.id === pickedGigId;
                  return (
                    <button key={g.id} type="button" onClick={() => setPickedGigId(g.id)}
                      style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: selected ? '2px solid var(--rosy-coral)' : '1px solid var(--color-hairline)', background: selected ? 'var(--color-surface-soft)' : 'var(--color-surface)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <GigChip type={g.type} />
                          <span style={{ fontWeight: 600 }}>${g.rate}/hr</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{g.spots - g.spotsFilled} of {g.spots} left</span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-body)' }}>
                        {fmtDate(g.date, 'mdy-dots')} · {fmtTime(g.start)}–{fmtTime(g.end)}
                      </div>
                      {g.description ? <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--color-muted)' }}>{g.description}</div> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ----- Event detail (vendor + worker view) ----- */
function PageEventDetail({ eventId, role, currentUser, setRoute }) {
  const base = SE_D.EVENTS.find(x => x.id === eventId);
  if (!base) return <div className="content"><Empty title="Event not found" /></div>;
  const [override, setOverride] = SE_us({});
  const e = { ...base, ...override };
  const v = SE_D.VENUES.find(x => x.id === e.venueId);
  const vendor = SE_D.USERS.find(x => x.id === e.vendorId);
  const gigs = SE_D.GIGS.filter(g => g.eventId === e.id);
  const [tab, setTab] = SE_us(() => {
    // Honor cross-page "open Applications tab" intent (from vendor Gigs "review" link).
    if (window.__rosyEventDetailTab) {
      const t = window.__rosyEventDetailTab;
      window.__rosyEventDetailTab = null;
      return t;
    }
    return 'overview';
  });
  const toast = useToast();
  const [applyGig, setApplyGig] = SE_us(null);
  const [applying, setApplying] = SE_us(false);
  const [editOpen, setEditOpen] = SE_us(false);
  // Full-event edit form — name, desc, date, endDate, start, end, venueId,
  // image, address, types. Pre-populated from the live event on open.
  const [editForm, setEditForm] = SE_us({});
  const openEditModal = () => {
    setEditForm({
      image: e.image || '',
      name: e.name || '',
      desc: e.desc || '',
      date: e.date || '',
      endDate: e.endDate || '',
      start: e.start || '',
      end: e.end || '',
      venueId: e.venueId || '',
      address: e.address || (v?.address || ''),
      types: e.types || ['Lead','Design','Assist','Strike'],
    });
    setEditOpen(true);
  };
  const [editSaving, setEditSaving] = SE_us(false);
  const submitEventEdit = async () => {
    if (editSaving) return;
    if (!editForm.name?.trim()) { toast.push({ kind: 'warning', title: 'Event name is required' }); return; }
    if (!editForm.date) { toast.push({ kind: 'warning', title: 'Event date is required' }); return; }
    if (!editForm.venueId) { toast.push({ kind: 'warning', title: 'Venue is required' }); return; }
    if (editForm.endDate && editForm.endDate < editForm.date) { toast.push({ kind: 'warning', title: 'End date must be on or after start date' }); return; }
    setEditSaving(true);
    const patch = {
      name: editForm.name.trim(),
      desc: editForm.desc,
      date: editForm.date,
      endDate: editForm.endDate || null,
      start: editForm.start || null,
      end: editForm.end || null,
      venueId: editForm.venueId,
      image: editForm.image || null,
      address: editForm.address || null,
      types: editForm.types || null,
    };
    setOverride(o => ({ ...o, ...patch }));
    try {
      await window.RosyMutate?.events?.update(eventId, patch);
      setEditOpen(false);
      toast.push({ kind: 'success', title: 'Event updated', body: `${patch.name} saved.` });
    } catch (err) {
      console.warn(err);
      toast.push({ kind: 'error', title: "Couldn't save event", body: err.message || 'Try again.' });
    }
    setEditSaving(false);
  };

  // ---- Inline Add Gig modal (stays on this page) ----
  const blankGig = { type: 'Design', date: e.date || '', start: e.start || '09:00', end: e.end || '17:00', spots: 2, rate: 35, priority: 'Medium', description: '' };
  const [addGigOpen, setAddGigOpen] = SE_us(false);
  const [gigForm, setGigForm] = SE_us(blankGig);
  const [gigSaving, setGigSaving] = SE_us(false);
  SE_ue(() => { if (addGigOpen) setGigForm({ ...blankGig, date: e.date || '', start: e.start || '09:00', end: e.end || '17:00' }); }, [addGigOpen]);
  const submitAddGig = async () => {
    if (gigSaving) return;
    if (!gigForm.type) { toast.push({ kind: 'warning', title: 'Pick a gig type' }); return; }
    if (!gigForm.date) { toast.push({ kind: 'warning', title: 'Pick a date' }); return; }
    if (!gigForm.start || !gigForm.end) { toast.push({ kind: 'warning', title: 'Enter start + end times' }); return; }
    if (Number(gigForm.rate) <= 0) { toast.push({ kind: 'warning', title: 'Enter a positive pay rate' }); return; }
    if (Number(gigForm.spots) <= 0) { toast.push({ kind: 'warning', title: 'Enter a positive spot count' }); return; }
    setGigSaving(true);
    const payload = {
      eventId, vendorId: e.vendorId, type: gigForm.type, description: gigForm.description,
      date: gigForm.date, start: gigForm.start, end: gigForm.end,
      rate: Number(gigForm.rate), spots: Number(gigForm.spots), spotsFilled: 0,
      status: 'open', priority: gigForm.priority,
    };
    try {
      await window.RosyMutate?.gigs?.create(payload);
      setAddGigOpen(false);
      toast.push({ kind: 'success', title: 'Gig added', body: `${gigForm.type} gig is now open for applications.` });
    } catch (err) {
      console.warn(err);
      toast.push({ kind: 'error', title: "Couldn't add gig", body: err.message || 'Try again.' });
    }
    setGigSaving(false);
  };
  const writeGigDescWithAI = async () => {
    if (!gigForm.type || !gigForm.date) { toast.push({ kind: 'warning', title: 'Pick gig type + date first', body: 'AI needs those to write a useful brief.' }); return; }
    const prompt = `You are drafting the "description" field for a single gig (worker shift) under a luxury floral studio's event. The audience is prospective applicants.

Reply with ONLY a JSON object: { "description": "..." }

The gig:
- Role: ${gigForm.type}
- Date: ${gigForm.date}
- Start/end: ${gigForm.start || '(tbd)'} – ${gigForm.end || '(tbd)'}
- Pay rate: $${gigForm.rate || '(tbd)'}/hr
- Spots: ${gigForm.spots || '(tbd)'}

The parent event:
- Event name: ${e.name || '(unnamed)'}
- Event description: ${e.desc || '(none provided)'}
- Event date: ${e.date || '(tbd)'}
- Venue: ${v?.name || '(none)'}${v?.address ? ' — ' + v.address : ''}${v?.category ? ' (' + v.category + ')' : ''}

3-4 sentences, ~280 chars max. Tell the applicant what THIS role looks like at THIS venue, what skills matter, install/strike scope. Reference specific floral moments. No emoji, no exclamation points, no marketing puff. Confident operator voice.

Reply ONLY with the JSON.`;
    try {
      const r = await fetch('/api/ai-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const d = await r.json();
      let desc = '';
      try { const m = d.text.match(/\{[\s\S]*\}/); desc = JSON.parse(m ? m[0] : d.text)?.description || ''; } catch (e) { desc = d.text || ''; }
      if (desc) {
        setGigForm(f => ({ ...f, description: desc.trim() }));
        toast.push({ kind: 'success', title: 'Description generated', body: 'Review before saving.' });
      } else {
        toast.push({ kind: 'warning', title: 'No description returned' });
      }
    } catch (err) {
      toast.push({ kind: 'error', title: 'Generation failed' });
    }
  };
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
          <p style={{ margin: 0, fontSize: 13, opacity: 0.9, fontWeight: 500 }}>{fmtDate(e.date, 'mdy-dots')} · {fmtTime(e.start)}–{fmtTime(e.end)} · {v?.name}, {v?.city}</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 48, letterSpacing: '-0.02em', margin: '8px 0 0', lineHeight: 1.05 }}>{e.name}</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs">
          {(role === 'worker' ? ['overview','gigs'] : ['overview','gigs','applications','payments']).map(t => (
            <button key={t} className={tab===t ? 'on' : ''} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        {role === 'vendor' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={openEditModal}><SE_I.Pencil size={14} />Edit event</button>
            {e.status === 'draft' ? (
              <button className="btn btn-coral" onClick={async () => {
                setOverride(o => ({ ...o, status: 'open' }));
                try {
                  await window.RosyMutate?.events?.update(e.id, { status: 'open' });
                  toast.push({ kind: 'success', title: 'Event published', body: 'Workers can now see this event and apply to its gigs.' });
                } catch (err) {
                  setOverride(o => ({ ...o, status: 'draft' }));
                  toast.push({ kind: 'error', title: "Couldn't publish", body: err.message || 'Try again.' });
                }
              }}><SE_I.CheckCircle size={14} />Publish</button>
            ) : null}
            <button className={e.status === 'draft' ? 'btn btn-ghost' : 'btn btn-coral'} onClick={() => setAddGigOpen(true)}><SE_I.Plus size={14} />Add gig</button>
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
              <KV label="Hours" value={`${fmtTime(e.start)} – ${fmtTime(e.end)}`} />
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
              {role === 'worker' ? (
                <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--color-muted)' }}>You'll be able to message {vendor?.first || 'the vendor'} once your application is accepted.</p>
              ) : (
                <button className="btn btn-ghost-teal btn-sm" style={{ marginTop: 14 }} onClick={() => { window.__rosyComposeTo = vendor?.id; setRoute && setRoute('inbox'); }}><SE_I.MessageSquare size={14} />Message</button>
              )}
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 10 }}>Gig types</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{e.types.map(t => <GigChip key={t} type={t} />)}</div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'gigs' && gigs.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: 'var(--color-surface-soft)', color: 'var(--color-muted)', marginBottom: 14 }}>
            <SE_I.Briefcase size={26} />
          </div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>No gigs yet</h3>
          <p style={{ margin: '8px 0 18px', color: 'var(--color-muted)', fontSize: 14 }}>Add gigs so workers can apply for this event.</p>
          {role === 'vendor' ? <button className="btn btn-coral" onClick={() => setAddGigOpen(true)}><SE_I.Plus size={14} />Add a gig</button> : null}
        </div>
      ) : null}
      {tab === 'gigs' && gigs.length > 0 ? (
        <div className="table-wrap">
          <table className="rosy-table">
            <thead><tr><th>Gig</th><th>Date / time</th><th>Filled</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {gigs.map(g => (
                <tr key={g.id}>
                  <td><GigChip type={g.type} /><p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)', maxWidth: 360 }}>{g.description}</p></td>
                  <td style={{ fontSize: 13 }}>{fmtDate(g.date, 'mdy-dots')}<br/><span className="t-muted" style={{ fontSize: 12 }}>{fmtTime(g.start)}–{fmtTime(g.end)}</span></td>
                  <td>{g.spotsFilled}/{g.spots}</td>
                  <td className="t-mono-amount">${g.rate}/hr</td>
                  <td><Badge kind={g.status === 'confirmed' ? 'Confirmed' : g.status === 'completed' ? 'Completed' : 'Open'} /></td>
                  <td>
                    {(() => {
                      if (role !== 'worker') return <button className="btn btn-ghost btn-sm" onClick={() => setRoute && setRoute('events:' + g.eventId)}>Details</button>;
                      const apps = (SE_D.APPLICATIONS || []).filter(a => a.gigId === g.id && a.workerId === currentUser?.id);
                      const myApp = apps[apps.length - 1];
                      const isAssigned = currentUser?.id && (g.assignedTo || []).includes(currentUser.id);
                      if (isAssigned) return <Badge kind="Confirmed">Confirmed</Badge>;
                      if (myApp && myApp.status !== 'withdrawn' && myApp.status !== 'rejected') return <Badge kind="Pending">Applied</Badge>;
                      if (g.status !== 'open' || (g.spots - g.spotsFilled) <= 0) return <Badge kind="Cancelled">Closed</Badge>;
                      return <button className="btn btn-coral btn-sm" onClick={() => setApplyGig(g)}>Apply</button>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'applications' ? (() => {
        // Real applications for this event's gigs (filter by gigIds belonging to this event).
        const eventGigIds = new Set((window.RosyData?.GIGS || []).filter(g => g.eventId === eventId).map(g => g.id));
        const apps = (window.RosyData?.APPLICATIONS || []).filter(a => eventGigIds.has(a.gigId) && a.status !== 'withdrawn');
        const usersById = Object.fromEntries((window.RosyData?.USERS || []).map(u => [u.id, u]));
        const gigsById  = Object.fromEntries((window.RosyData?.GIGS  || []).map(g => [g.id, g]));
        return (
          <div className="card card-flush">
            {apps.length === 0 ? (
              <div style={{ padding: 36 }}><Empty icon={SE_I.ClipboardList} title="No applications yet" body="When workers apply to your gigs for this event, they'll appear here." /></div>
            ) : apps.map(a => {
              const w = usersById[a.workerId] || {};
              const g = gigsById[a.gigId] || {};
              const status = decided[a.id] || a.status;
              const isPending = status === 'applied';
              const isApproved = status === 'confirmed';
              const isRejected = status === 'rejected';
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', opacity: isRejected ? 0.55 : 1 }}>
                  <Avatar name={w.name || 'Applicant'} size="lg" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{w.name || 'Applicant'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>{w.gigs || 0} gigs · ★ {w.rating || '—'}</p>
                  </div>
                  <span className="pill"><SE_I.Briefcase size={12} style={{ marginRight: 4 }} />{g.type || 'Gig'}</span>
                  {isApproved ? <Badge kind="Confirmed">Approved</Badge> : null}
                  {isRejected ? <Badge kind="Rejected">Rejected</Badge> : null}
                  <button className="btn btn-ghost btn-sm" onClick={() => { window.__rosyComposeTo = a.workerId; setRoute && setRoute('inbox'); }}>Message</button>
                  {isPending ? (
                    <>
                      <button className="btn btn-ghost-coral btn-sm" onClick={async () => {
                        setDecided(d => ({ ...d, [a.id]: 'rejected' }));
                        try { await window.RosyMutate?.applications?.setStatus?.(a.id, 'rejected'); toast.push({ kind: 'warning', title: `${w.first || 'Applicant'} rejected` }); }
                        catch (e) { setDecided(d => ({ ...d, [a.id]: undefined })); toast.push({ kind: 'error', title: "Couldn't reject", body: e.message || 'Try again.' }); }
                      }}>Reject</button>
                      <button className="btn btn-coral btn-sm" onClick={async () => {
                        setDecided(d => ({ ...d, [a.id]: 'confirmed' }));
                        try { await window.RosyMutate?.applications?.setStatus?.(a.id, 'confirmed'); toast.push({ kind: 'success', title: `${w.first || 'Applicant'} approved`, body: "They'll get an email + push notification." }); }
                        catch (e) { setDecided(d => ({ ...d, [a.id]: undefined })); toast.push({ kind: 'error', title: "Couldn't approve", body: e.message || 'Try again.' }); }
                      }}>Approve</button>
                    </>
                  ) : isApproved ? (
                    // Undo path so an accidental approval can be reversed.
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                      setDecided(d => ({ ...d, [a.id]: 'applied' }));
                      try { await window.RosyMutate?.applications?.setStatus?.(a.id, 'applied'); toast.push({ kind: 'info', title: 'Approval undone', body: `${w.first || 'Applicant'} moved back to pending.` }); }
                      catch (e) { setDecided(d => ({ ...d, [a.id]: 'confirmed' })); toast.push({ kind: 'error', title: "Couldn't undo", body: e.message || 'Try again.' }); }
                    }}>Undo</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })() : null}

      {tab === 'payments' ? (() => {
        // Scope to transactions tied to applications for this event's gigs.
        const eventGigIds = new Set((window.RosyData?.GIGS || []).filter(g => g.eventId === eventId).map(g => g.id));
        const eventAppIds = new Set((window.RosyData?.APPLICATIONS || []).filter(a => eventGigIds.has(a.gigId)).map(a => a.id));
        const eventTxs = (window.RosyData?.TRANSACTIONS || []).filter(t => eventAppIds.has(t.id));
        return (
        <div className="card card-flush">
          <table className="rosy-table">
            <thead><tr><th>Invoice</th><th>Worker</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {eventTxs.length === 0 ? (
                <tr><td colSpan={5}><Empty icon={SE_I.CreditCard} title="No payments yet" body="Payments will appear here once gigs are confirmed and approved." /></td></tr>
              ) : eventTxs.map(t => (
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
        );
      })() : null}

      <Modal open={!!applyGig} onClose={() => { if (!applying) setApplyGig(null); }} title="Apply for this gig" size="md"
        footer={<><button className="btn btn-ghost" disabled={applying} onClick={() => setApplyGig(null)}>Cancel</button><button className="btn btn-coral" disabled={applying} onClick={async () => {
          if (applying) return;
          const g = applyGig;
          const workerId = currentUser?.id || SE_D.USERS.find(u => u.role === 'worker')?.id;
          const dup = (SE_D.APPLICATIONS || []).some(a => a.gigId === g.id && a.workerId === workerId && a.status !== 'withdrawn' && a.status !== 'rejected');
          if (dup) { toast.push({ kind: 'warning', title: 'Already applied', body: "You've already applied to this gig." }); return; }
          setApplying(true);
          try {
            await window.RosyMutate?.applications?.apply({ gigId: g.id, workerId });
            toast.push({ kind: 'success', title: 'Application sent', body: `You'll hear from ${vendor?.first || 'the vendor'} soon.` });
            setApplyGig(null);
          } catch (err) { console.warn(err); toast.push({ kind: 'error', title: 'Apply failed', body: err.message }); }
          setApplying(false);
        }}>{applying ? 'Sending…' : 'Confirm application'}</button></>}>
        {applyGig ? (
          <div>
            <p style={{ margin: '0 0 16px' }}><GigChip type={applyGig.type} /> {e.name}</p>
            <KV label="Date" value={`${fmtDate(applyGig.date, 'mdy-dots')} · ${fmtTime(applyGig.start)}–${fmtTime(applyGig.end)}`} />
            <KV label="Rate" value={`$${applyGig.rate}/hr`} />
            <KV label="Spots" value={`${applyGig.spots - applyGig.spotsFilled} left of ${applyGig.spots}`} />
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-body)' }}>{applyGig.description}</p>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit event" size="lg"
        footer={<><button className="btn btn-ghost" disabled={editSaving} onClick={() => setEditOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={editSaving} onClick={submitEventEdit}>{editSaving ? 'Saving…' : 'Save changes'}</button></>}>
        <NewEventForm value={editForm} onChange={setEditForm}
          onCreateVenue={() => toast.push({ kind: 'info', title: 'Add venues from the Venues page', body: 'New venues can be created from the Venues section, then linked here.' })} />
      </Modal>

      <Modal open={addGigOpen} onClose={() => { if (!gigSaving) setAddGigOpen(false); }} title={`Add gig — ${e.name}`} size="md"
        footer={
          <>
            <button className="btn btn-ghost" disabled={gigSaving} onClick={() => setAddGigOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-ghost-teal btn-sm" onClick={writeGigDescWithAI} disabled={gigSaving} style={{ height: 34 }}>
              <SE_I.Sparkles size={14} />Write it for me
            </button>
            <button className="btn btn-coral" disabled={gigSaving} onClick={submitAddGig}>{gigSaving ? 'Creating…' : 'Create gig'}</button>
          </>
        }>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Gig type *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Lead','Design','Assist','Strike'].map(t => (
                <button key={t} type="button" onClick={() => setGigForm(f => ({ ...f, type: t }))}
                  className={`gig-chip ${t.toLowerCase()}`}
                  style={{ border: '1.5px solid', borderColor: gigForm.type === t ? 'currentColor' : 'transparent', opacity: gigForm.type === t ? 1 : 0.45, cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: 12, background: 'transparent' }}>
                  <span className="dot" />{t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Date *</label><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={gigForm.date} onChange={(ev) => setGigForm(f => ({ ...f, date: ev.target.value }))} /></div>
            <div className="field"><label className="field-label">Spots *</label><input className="input" type="number" min={1} value={gigForm.spots} onChange={(ev) => setGigForm(f => ({ ...f, spots: ev.target.value }))} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Start time *</label><input className="input" type="time" value={gigForm.start} onChange={(ev) => setGigForm(f => ({ ...f, start: ev.target.value }))} /></div>
            <div className="field"><label className="field-label">End time *</label><input className="input" type="time" value={gigForm.end} onChange={(ev) => setGigForm(f => ({ ...f, end: ev.target.value }))} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="field-label">Pay rate ($/hr) *</label><input className="input" type="number" min={0} value={gigForm.rate} onChange={(ev) => setGigForm(f => ({ ...f, rate: ev.target.value }))} /></div>
            <div className="field"><label className="field-label">Priority</label>
              <select className="select" value={gigForm.priority} onChange={(ev) => setGigForm(f => ({ ...f, priority: ev.target.value }))}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="field"><label className="field-label">Description</label>
            <textarea className="textarea" value={gigForm.description} onChange={(ev) => setGigForm(f => ({ ...f, description: ev.target.value }))} placeholder="What does this role look like on the day? Skills, install scope, what to expect." />
          </div>
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

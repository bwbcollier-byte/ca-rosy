/* Payments, disputes, users, workers, vendors, venues, settings, audit, content, analytics */

const SP_D = window.RosyData;
const SP_I = window.Icons;
const { useState: SP_us } = React;

/* ============ Payments (admin/vendor/worker) ============ */
function PagePayments({ role, currentUser, setRoute, openId }) {
  const toast = useToast();
  const [dispute, setDispute] = SP_us(null);
  const [openTx, setOpenTx] = SP_us(null);
  const [statusTab, setStatusTab] = SP_us('all');
  const [search, setSearch] = SP_us('');
  let txs = SP_D.TRANSACTIONS;
  if (role === 'vendor') txs = txs.filter(t => t.payer.includes('Bloom') || t.payer.includes('Floral Forge'));
  if (role === 'worker') txs = txs.filter(t => t.payee === currentUser.name || t.payee === 'Multiple');

  const filtered = txs
    .filter(t => statusTab === 'all' || t.status.toLowerCase() === statusTab)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [t.invoice, t.payee, t.payer].some(s => (s || '').toLowerCase().includes(q));
    });

  const paged = usePaged(filtered, 10, `${search}|${statusTab}|${filtered.length}`);

  React.useEffect(() => {
    if (!openId) return;
    const t = txs.find(x => x.id === openId);
    if (t) setOpenTx(t);
  }, [openId]);

  const closeTx = () => {
    setOpenTx(null);
    if (openId) setRoute && setRoute('payments');
  };

  const totalEarned = txs.filter(t => t.status === 'Paid').reduce((s,t) => s + t.amount, 0);
  const totalPending = txs.filter(t => t.status === 'Pending' || t.status === 'Not Due').reduce((s,t) => s + t.amount, 0);
  const totalLate = txs.filter(t => t.status === 'Late' || t.status === 'Disputed').reduce((s,t) => s + t.amount, 0);

  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SP_I.DollarSign}    label={role === 'worker' ? 'Total earned' : 'Total paid'} value={totalEarned}  prefix="$" delta={14} />
        <StatCard icon={SP_I.Clock}         label="Pending"  value={totalPending} prefix="$" delta={6}  />
        <StatCard icon={SP_I.AlertCircle}   label="Late / disputed" value={totalLate} prefix="$" delta={-32} />
        <StatCard icon={SP_I.CreditCard}    label="Avg per gig" value={Math.round((totalEarned + totalPending) / Math.max(txs.length, 1))} prefix="$" />
      </div>
      <div className="section-heading">
        <h2>Payments</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search invoices..." style={{ paddingLeft: 36, width: 220, height: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="tabs">
            {[['all','All'],['paid','Paid'],['pending','Pending'],['late','Late'],['disputed','Disputed']].map(([id, label]) => (
              <button key={id} className={statusTab === id ? 'on' : ''} onClick={() => setStatusTab(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead>
            <tr><th>Invoice</th><th>Status</th><th>{role==='worker' ? 'From' : 'To / from'}</th><th>Amount</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {paged.slice.length === 0 ? <tr><td colSpan={6}><Empty icon={SP_I.CreditCard} title="No matching payments" body="Try a different status or search term." /></td></tr> :
             paged.slice.map(t => (
              <tr key={t.id} tabIndex={0} role="button" aria-label={`Open invoice ${t.invoice}`}
                  onClick={(e) => { if (e.target.closest('button')) return; setOpenTx(t); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOpenTx(t); } }}
                  style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{t.invoice}{t.note ? <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--color-warning)' }}>{t.note}</p> : null}</td>
                <td><Badge kind={t.status} /></td>
                <td style={{ fontSize: 13 }}>{role === 'worker' ? t.payer : (role === 'vendor' ? t.payee : `${t.payee} ← ${t.payer}`)}</td>
                <td className="t-mono-amount">{fmtMoney(t.amount)}</td>
                <td style={{ color: 'var(--color-muted)', fontSize: 13 }}>{fmtDate(t.date, 'mdy-dots')}</td>
                <td>
                  <div className="row-actions">
                    {t.status === 'Pending' && role !== 'worker' ?
                      <button className="btn btn-coral btn-sm" onClick={() => toast.push({ kind: 'success', title: 'Payment released', body: `${fmtMoney(t.amount)} sent to ${t.payee}` })}>Approve</button> : null}
                    {t.status !== 'Paid' && t.status !== 'Disputed' ?
                      <button className="btn btn-ghost btn-sm" onClick={() => setDispute(t)}><SP_I.AlertTriangle size={14} />Dispute</button> : null}
                    <button className="row-action-btn" aria-label="Open invoice" onClick={() => setOpenTx(t)}><SP_I.ExternalLink size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="payments" />
      </div>

      <Modal open={!!dispute} onClose={() => setDispute(null)} title="File a dispute" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setDispute(null)}>Cancel</button><button className="btn btn-danger" onClick={() => { setDispute(null); toast.push({ kind: 'warning', title: 'Dispute filed', body: 'Rosy support will review within 48 hours.' }); }}>File dispute</button></>}>
        {dispute ? (
          <div className="col" style={{ gap: 14 }}>
            <KV label="Invoice" value={dispute.invoice} />
            <KV label="Amount" value={fmtMoney(dispute.amount)} />
            <div className="field"><label className="field-label">Reason</label>
              <select className="select"><option>Hours mismatch</option><option>No-show</option><option>Quality of work</option><option>Other</option></select>
            </div>
            <div className="field"><label className="field-label">Describe what happened</label><textarea className="textarea" placeholder="Be specific. Include dates, times, what was agreed, and what occurred." /></div>
            <div className="field"><label className="field-label">Evidence (optional)</label>
              <div style={{ border: '2px dashed var(--color-hairline-strong)', borderRadius: 12, padding: 18, textAlign: 'center', background: 'var(--color-surface-soft)' }}>
                <SP_I.UploadCloud size={22} style={{ color: 'var(--color-muted)' }} />
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>Drag in screenshots or PDFs</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {openTx ? (
        <Modal open={!!openTx} onClose={closeTx} title={`Invoice ${openTx.invoice}`} size="md"
          footer={<><button className="btn btn-ghost" onClick={closeTx}>Close</button><button className="btn btn-coral" onClick={() => { const t = openTx; closeTx(); toast.push({ kind: 'success', title: 'Receipt sent', body: `Sent to ${t.payee}` }); }}>Send receipt</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Status</p><Badge kind={openTx.status} /></div>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Amount</p><p className="t-mono-amount" style={{ margin: '4px 0 0', fontSize: 18 }}>{fmtMoney(openTx.amount)}</p></div>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Payer</p><p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 500 }}>{openTx.payer}</p></div>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Payee</p><p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 500 }}>{openTx.payee}</p></div>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Date</p><p style={{ margin: '4px 0 0', fontSize: 14 }}>{fmtDate(openTx.date, 'mdy-dots')}</p></div>
            <div><p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Method</p><p style={{ margin: '4px 0 0', fontSize: 14 }}>Stripe Connect</p></div>
          </div>
          {openTx.note ? <p style={{ marginTop: 16, padding: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 8, fontSize: 13 }}>{openTx.note}</p> : null}
        </Modal>
      ) : null}
    </div>
  );
}

/* ============ Disputes (admin only) ============ */
function PageDisputes() {
  const toast = useToast();
  const [mediate, setMediate] = SP_us(null);
  const [thread, setThread] = SP_us(null);
  const disputed = SP_D.TRANSACTIONS.filter(t => t.status === 'Disputed' || t.status === 'Late');
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Disputes & overdue</h2></div>
      <div className="grid-3">
        {disputed.map(t => (
          <div key={t.id} className="card" tabIndex={0} role="button" aria-label={`Open dispute ${t.invoice}`}
            onClick={(e) => { if (e.target.closest('button')) return; setThread(t); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setThread(t); } }}
            style={{ borderColor: t.status === 'Disputed' ? 'var(--color-warning)' : 'var(--rosy-coral)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge kind={t.status} />
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(t.date, 'mdy-dots')}</span>
            </div>
            <p style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: 15 }}>{t.invoice}</p>
            <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--color-muted)' }}>{t.payee} ← {t.payer}</p>
            <p className="t-mono-amount" style={{ fontSize: 22, margin: '8px 0 0', color: 'var(--color-ink)' }}>{fmtMoney(t.amount)}</p>
            {t.note ? <p style={{ margin: '12px 0 0', padding: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 8, fontSize: 12.5 }}>{t.note}</p> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setThread(t)}>View thread</button>
              <button className="btn btn-coral btn-sm" style={{ flex: 1 }} onClick={() => setMediate(t)}>Mediate</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!mediate} onClose={() => setMediate(null)} title="Mediate dispute" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setMediate(null)}>Close</button><button className="btn btn-ghost-coral" onClick={() => { setMediate(null); toast.push({ kind: 'warning', title: 'Released to worker', body: 'Worker paid in full. Vendor notified.' }); }}>Release to worker</button><button className="btn btn-coral" onClick={() => { setMediate(null); toast.push({ kind: 'success', title: 'Split decision', body: 'Worker paid 75%, vendor refunded 25%.' }); }}>Split 75/25</button></>}>
        {mediate ? (
          <div className="col" style={{ gap: 14 }}>
            <KV label="Invoice" value={mediate.invoice} />
            <KV label="Amount" value={fmtMoney(mediate.amount)} />
            <KV label="Worker says" value={mediate.note || 'Hours match my timesheet.'} />
            <KV label="Vendor says" value="Worker left 2 hours early. We were short on the strike crew." />
            <div className="field"><label className="field-label">Admin notes</label><textarea className="textarea" placeholder="Notes shared with both parties on resolution." /></div>
          </div>
        ) : null}
      </Modal>

      {thread ? (
        <Modal open={!!thread} onClose={() => setThread(null)} title={`Thread · ${thread.invoice}`} size="md"
          footer={<button className="btn btn-ghost" onClick={() => setThread(null)}>Close</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { who: thread.payer, side: 'in', text: 'Hi — when can I expect payment for the May 12 event?', time: '2 days ago' },
              { who: thread.payee, side: 'out', text: 'Sorry for the delay, end of month is hectic. Releasing today.', time: '2 days ago' },
              { who: thread.payer, side: 'in', text: "Still don't see it. Stripe says nothing pending.", time: '1 day ago' },
              { who: thread.payee, side: 'out', text: "Let me check with our bookkeeper, I'll get back today.", time: '1 day ago' },
              { who: thread.payer, side: 'in', text: 'Filing a dispute — this has gone past 5 business days.', time: '2 hours ago' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.side === 'out' ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 4 }}>{m.who} · {m.time}</span>
                <div className={`msg-bubble ${m.side}`}>{m.text}</div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ============ Users / Workers / Vendors directory ============ */
function PageDirectory({ filter, title, role, setRoute, openId, openAction }) {
  const [search, setSearch] = SP_us('');
  const [statusFilter, setStatusFilter] = SP_us('all');
  const [sortBy, setSortBy] = SP_us('newest');
  const [filterOpen, setFilterOpen] = SP_us(false);
  const [inviteOpen, setInviteOpen] = SP_us(false);
  const [confirmId, setConfirmId] = SP_us(null);
  const [bulkConfirm, setBulkConfirm] = SP_us(null);
  const [selected, setSelected] = SP_us(null);
  const [editing, setEditing] = SP_us(false);
  const [picked, setPicked] = SP_us({});
  const [overrides, setOverrides] = SP_us({});
  const [deleted, setDeleted] = SP_us({});
  const toast = useToast();

  const merged = SP_D.USERS.map(u => overrides[u.id] ? { ...u, ...overrides[u.id] } : u).filter(u => !deleted[u.id]);

  const all = merged
    .filter(u => filter ? filter(u) : true)
    .filter(u => statusFilter === 'all' || u.status === statusFilter)
    .filter(u => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [u.name, u.email, u.company, u.city].some(s => (s || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.joined) - new Date(a.joined);
      if (sortBy === 'oldest') return new Date(a.joined) - new Date(b.joined);
      if (sortBy === 'name')   return a.name.localeCompare(b.name);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

  const paged = usePaged(all, 10, `${search}|${statusFilter}|${sortBy}|${all.length}`);
  const visible = paged.slice;
  const pickedIds = Object.keys(picked).filter(k => picked[k]);
  const pickedCount = pickedIds.length;

  // Sub-route: pre-open user detail (and optionally in edit mode)
  React.useEffect(() => {
    if (!openId) return;
    const u = merged.find(x => x.id === openId);
    if (u) { setSelected(u); setEditing(openAction === 'edit'); }
  }, [openId, openAction]);

  const closeDetail = () => {
    setSelected(null);
    setEditing(false);
    // Clean sub-route from hash so back navigation works
    if (openId) setRoute && setRoute(title === 'Workers' ? 'workers' : title === 'Vendors' ? 'vendors' : 'users');
  };

  const applyBulk = (action) => {
    if (action === 'activate' || action === 'deactivate') {
      const next = action === 'activate' ? 'active' : 'inactive';
      setOverrides(o => {
        const c = { ...o };
        pickedIds.forEach(id => { c[id] = { ...(c[id] || {}), status: next }; });
        return c;
      });
      toast.push({ kind: action === 'activate' ? 'success' : 'warning', title: `${pickedCount} marked ${next}` });
      setPicked({});
    } else if (action === 'delete') {
      setBulkConfirm({ ids: pickedIds, count: pickedCount });
    }
  };
  const confirmBulkDelete = () => {
    setDeleted(d => {
      const c = { ...d };
      bulkConfirm.ids.forEach(id => { c[id] = true; });
      return c;
    });
    toast.push({ kind: 'warning', title: `${bulkConfirm.count} removed` });
    setPicked({}); setBulkConfirm(null);
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder={`Search ${title.toLowerCase()}...`} style={{ paddingLeft: 36, width: 260 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['newest','Newest first'],['oldest','Oldest first'],['name','Name A–Z'],['rating','Highest rated']]} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SP_I.Filter size={14} />Filters{statusFilter !== 'all' ? ' (1)' : ''}</button>
          {role === 'admin' ? <button className="btn btn-coral" onClick={() => setInviteOpen(true)}><SP_I.Plus size={14} />Invite</button> : null}
        </div>
      </div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <CheckBox
                  checked={visible.length > 0 && visible.every(u => picked[u.id])}
                  onChange={(on) => { setPicked(p => { const n = { ...p }; visible.forEach(u => { if (on) n[u.id] = true; else delete n[u.id]; }); return n; }); }} />
              </th>
              <th>Name</th>
              <th>Role / Company</th>
              <th>Location</th>
              <th>Rating</th>
              <th>Gigs</th>
              <th>Status</th>
              <th>Joined</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? <tr><td colSpan={9}><Empty icon={SP_I.Users} title="No matches" body="Try a broader search." /></td></tr> :
             visible.map(u => (
              <tr key={u.id} tabIndex={0} role="button" aria-label={`Open ${u.name}`}
                  onClick={() => { setSelected(u); setEditing(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(u); setEditing(false); } }}
                  style={{ cursor: 'pointer' }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <CheckBox checked={!!picked[u.id]} onChange={(on) => setPicked(p => ({ ...p, [u.id]: on }))} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={u.name} size="md" />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-ink)', fontSize: 14 }}>{u.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13 }}><span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{u.role}</span><br/><span className="t-muted" style={{ fontSize: 12 }}>{u.company}</span></td>
                <td style={{ fontSize: 13 }}>{u.city}</td>
                <td>{u.rating ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><SP_I.Star size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />{u.rating}</span> : <span className="t-muted">—</span>}</td>
                <td style={{ fontSize: 13 }}>{u.gigs ?? '—'}</td>
                <td><Badge kind={u.status === 'active' ? 'Active' : 'Inactive'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(u.joined, 'mdy-dots')}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    <button className="row-action-btn" onClick={() => { setSelected(u); setEditing(false); }} title="View profile"><SP_I.Eye size={14} /></button>
                    <button className="row-action-btn" onClick={() => { setSelected(u); setEditing(true); }} title="Edit profile"><SP_I.Pencil size={14} /></button>
                    <button className="row-action-btn danger" onClick={() => setConfirmId(u.id)} title="Delete"><SP_I.Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="users" />
      </div>

      <BulkActionBar count={pickedCount} onClear={() => setPicked({})}
        actions={[
          { label: 'Activate',   icon: SP_I.CheckCircle2, onClick: () => applyBulk('activate') },
          { label: 'Deactivate', icon: SP_I.UserX,        onClick: () => applyBulk('deactivate') },
          { label: 'Delete',     icon: SP_I.Trash2, danger: true, onClick: () => applyBulk('delete') },
        ]} />

      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} title="Delete this user?" message="They'll be removed from the directory. The full record stays archived." confirmLabel="Delete"
        onConfirm={() => { setDeleted(d => ({ ...d, [confirmId]: true })); toast.push({ kind: 'warning', title: 'User deleted' }); }} />

      <ConfirmDialog open={!!bulkConfirm} onClose={() => setBulkConfirm(null)}
        title={bulkConfirm ? `Delete ${bulkConfirm.count} users?` : ''} message="They'll be removed from the directory."
        confirmLabel="Delete" onConfirm={confirmBulkDelete} />

      <UserDetailModal user={selected} onClose={closeDetail} setRoute={setRoute}
        initialEdit={editing}
        onSave={(draft) => { setOverrides(o => ({ ...o, [selected.id]: { ...(o[selected.id] || {}), ...draft } })); }} />

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => { setStatusFilter('all'); }}>Reset</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
        <div className="col" style={{ gap: 6 }}>
          {[['all','All'],['active','Active only'],['inactive','Inactive only']].map(([id, label]) => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
              <span className={`checkbox ${statusFilter === id ? 'checked' : ''}`} onClick={() => setStatusFilter(id)}>{statusFilter === id ? <SP_I.CheckCircle size={12} /> : null}</span>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={`Invite ${title.toLowerCase().slice(0, -1) || 'user'}`} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setInviteOpen(false)}>Cancel</button><button className="btn btn-coral" onClick={() => { setInviteOpen(false); toast.push({ kind: 'success', title: 'Invite sent', body: 'They\'ll get an email within a minute.' }); }}>Send invite</button></>}>
        <div className="col" style={{ gap: 12 }}>
          <div className="field"><label className="field-label">Email</label><input className="input" placeholder="they@studio.com" defaultValue="" /></div>
          <div className="field"><label className="field-label">Personal note (optional)</label><textarea className="textarea" placeholder="Hey — wanted to bring you onto our weekend crew." /></div>
        </div>
      </Modal>
    </div>
  );
}

function UserDetailModal({ user, onClose, setRoute, initialEdit = false, onSave }) {
  const toast = useToast();
  const [editing, setEditing] = SP_us(initialEdit);
  const [draft, setDraft] = SP_us({ name: user?.name || '', email: user?.email || '', company: user?.company || '', city: user?.city || '' });
  React.useEffect(() => {
    if (user) setDraft({ name: user.name, email: user.email, company: user.company, city: user.city });
    setEditing(initialEdit);
  }, [user?.id, initialEdit]);
  if (!user) return null;
  const handleSave = () => {
    onSave && onSave(draft);
    setEditing(false);
    toast.push({ kind: 'success', title: 'Profile updated' });
  };
  return (
    <Modal open={!!user} onClose={onClose} title={user.name} size="lg"
      footer={editing
        ? <><button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-coral" onClick={handleSave}>Save changes</button></>
        : <><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-ghost-teal" onClick={() => { onClose(); setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${user.first}` }); }}><SP_I.MessageSquare size={14} />Message</button><button className="btn btn-coral" onClick={() => setEditing(true)}><SP_I.Pencil size={14} />Edit profile</button></>}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, alignItems: 'flex-start' }}>
        <Avatar name={user.name} size="xl" />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em' }}>{editing ? draft.name : user.name}</h3>
          <p style={{ margin: '4px 0 12px', color: 'var(--color-muted)', fontSize: 14 }}>{(editing ? draft.company : user.company)} · {(editing ? draft.city : user.city)}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Badge kind={user.status === 'active' ? 'Active' : 'Inactive'}>{user.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            <span style={{ textTransform: 'capitalize', color: 'var(--color-muted)', fontSize: 13 }}>{user.role}</span>
            {user.rating ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><SP_I.Star size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />{user.rating} ({user.gigs} gigs)</span> : null}
          </div>
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Name</label><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Email</label><input className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Company</label><input className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>City</label><input className="input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid-2" style={{ gap: 12 }}>
            <KV label="Email" value={user.email} />
            <KV label="Joined" value={fmtDate(user.joined, 'mdy-dots')} />
            <KV label="Location" value={user.city} />
            <KV label="Role" value={<span style={{ textTransform: 'capitalize' }}>{user.role}</span>} />
          </div>
          <h4 style={{ margin: '24px 0 8px', fontSize: 14, fontWeight: 600 }}>Bio</h4>
          <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 14, lineHeight: 1.55 }}>
            {user.role === 'worker'
              ? `${user.first} brings ${user.gigs ?? 0} gigs of experience to ${user.role === 'worker' ? 'high-end floral events' : 'the platform'} — specializing in installations, tablescapes, and on-day execution. Reliable, calm under pressure, takes direction well.`
              : `${user.company} is a ${user.city}-based floral studio serving the tri-state area. Specialties: weddings, brand activations, editorial work.`}
          </p>
        </>
      )}
    </Modal>
  );
}

/* ============ Venues (admin) ============ */
function PageVenues() {
  const toast = useToast();
  const [addOpen, setAddOpen] = SP_us(false);
  const [viewOpen, setViewOpen] = SP_us(null);
  const [editing, setEditing] = SP_us(null);
  const [deleteId, setDeleteId] = SP_us(null);
  const [venues, setVenues] = SP_us(SP_D.VENUES.map(v => ({ ...v, address: `${v.name} · ${v.city}`, image: SP_D.IMAGES.events[(parseInt(v.id.slice(1)) - 1) % SP_D.IMAGES.events.length], parking: 'Street parking + nearby lot.', notes: 'Standard load-in via rear dock. Single 30A 120V circuit available.' })));
  const [search, setSearch] = SP_us('');
  const filtered = venues.filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [v.name, v.city, v.type].some(s => (s || '').toLowerCase().includes(q));
  });
  const upsert = (v) => {
    setVenues(arr => {
      const idx = arr.findIndex(x => x.id === v.id);
      if (idx >= 0) return arr.map(x => x.id === v.id ? v : x);
      return [...arr, v];
    });
  };
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Venues</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search venues..." style={{ paddingLeft: 36, width: 240 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-coral" onClick={() => { setEditing(null); setAddOpen(true); }}><SP_I.Plus size={14} />Add venue</button>
        </div>
      </div>
      <div className="grid-3">
        {filtered.length === 0 ? <div style={{ gridColumn: '1 / -1' }}><Empty icon={SP_I.MapPin} title="No matching venues" /></div> :
         filtered.map(v => (
          <div key={v.id} className="card" tabIndex={0} role="button" aria-label={`Open ${v.name}`}
            onClick={(e) => { if (e.target.closest('button')) return; setViewOpen(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setViewOpen(v); } }}
            style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
              <SafeImage src={v.image} placeholderIcon={SP_I.MapPin} placeholderTone={['mint','peach','lavender','ochre'][parseInt(v.id.slice(1)) % 4]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', padding: '4px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600 }}>{v.type}</span>
            </div>
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em' }}>{v.name}</h4>
                <SP_I.MapPin size={18} style={{ color: 'var(--color-muted)' }} />
              </div>
              <p style={{ margin: '4px 0 12px', color: 'var(--color-muted)', fontSize: 13.5 }}>{v.city}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 4 }}>
                <span><strong>{v.capacity}</strong> capacity</span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(v); setAddOpen(true); }}><SP_I.Pencil size={13} />Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewOpen(v)}><SP_I.Eye size={13} />View</button>
                <button className="row-action-btn danger" style={{ marginLeft: 'auto' }} onClick={() => setDeleteId(v.id)}><SP_I.Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <VenueFormModal open={addOpen} onClose={() => setAddOpen(false)} venue={editing} onSave={(v) => { upsert(v); setAddOpen(false); toast.push({ kind: 'success', title: editing ? 'Venue updated' : 'Venue added' }); }} />

      <VenueDetailModal venue={viewOpen} onClose={() => setViewOpen(null)} onEdit={(v) => { setViewOpen(null); setEditing(v); setAddOpen(true); }} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove venue?" message="This won't affect past events but it'll be hidden from new event creation." confirmLabel="Remove"
        onConfirm={() => { setVenues(vs => vs.filter(v => v.id !== deleteId)); toast.push({ kind: 'warning', title: 'Venue removed' }); }} />
    </div>
  );
}

function VenueFormModal({ open, onClose, venue, onSave }) {
  const [f, setF] = SP_us({ name: '', city: '', address: '', capacity: '', type: 'Industrial loft', parking: '', notes: '', image: null });
  React.useEffect(() => {
    if (open) {
      if (venue) setF({ name: venue.name, city: venue.city, address: venue.address || '', capacity: venue.capacity, type: venue.type, parking: venue.parking || '', notes: venue.notes || '', image: venue.image || null });
      else setF({ name: '', city: '', address: '', capacity: '', type: 'Industrial loft', parking: '', notes: '', image: null });
    }
  }, [open, venue]);
  const upd = (k, v) => setF(s => ({ ...s, [k]: v }));
  const valid = f.name.trim() && f.address.trim() && String(f.capacity).trim();
  const save = () => {
    onSave({ id: venue?.id || ('v' + Math.random().toString(36).slice(2, 6)), ...f, capacity: Number(f.capacity) || 0 });
  };
  return (
    <Modal open={open} onClose={onClose} title={venue ? 'Edit venue' : 'Add venue'} size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <WriteForMe context={{ kind: 'venue', fields: ['name','type','city','address','capacity','parking','notes'] }}
            placeholderQuestions={[
              { key: 'name', label: 'Venue name (or vibe)', placeholder: 'e.g. Greenpoint loft with east-river views' },
              { key: 'guests', label: 'Capacity', placeholder: '200' },
              { key: 'type', label: 'Venue type', placeholder: 'Garden, loft, estate...' },
              { key: 'city', label: 'City', placeholder: 'Brooklyn, NY' },
            ]}
            onFill={(d) => { if (d._raw) upd('notes', d._raw); else Object.entries(d).forEach(([k, v]) => upd(k, v)); }} />
          <button className="btn btn-coral" disabled={!valid} onClick={save}>{venue ? 'Save changes' : 'Save venue'}</button>
        </>
      }>
      <div className="col" style={{ gap: 14 }}>
        <div className="field"><label className="field-label">Cover image</label>
          <ImageUpload value={f.image} onChange={(v) => upd('image', v)} label="Upload venue photo" size={120} round={false} />
        </div>
        <div className="field"><label className="field-label">Name *</label><input className="input" placeholder="e.g. Carter Garden Estate" value={f.name} onChange={e => upd('name', e.target.value)} /></div>
        <div className="grid-2">
          <div className="field"><label className="field-label">City *</label><input className="input" placeholder="Brooklyn, NY" value={f.city} onChange={e => upd('city', e.target.value)} /></div>
          <div className="field"><label className="field-label">Capacity *</label><input className="input" type="number" placeholder="200" value={f.capacity} onChange={e => upd('capacity', e.target.value)} /></div>
        </div>
        <div className="field"><label className="field-label">Address *</label>
          <AddressInput value={f.address} onChange={v => upd('address', v)} placeholder="Start typing a street address" />
        </div>
        <div className="field"><label className="field-label">Type</label>
          <select className="select" value={f.type} onChange={e => upd('type', e.target.value)}>
            <option>Industrial loft</option><option>Garden</option><option>Estate</option><option>Skyline venue</option><option>Waterfront</option><option>Studio</option><option>Other</option>
          </select>
        </div>
        <div className="field"><label className="field-label">Parking & access</label>
          <textarea className="textarea" placeholder="Number of spots, loading dock, freight elevator, valet, etc." value={f.parking} onChange={e => upd('parking', e.target.value)} />
        </div>
        <div className="field"><label className="field-label">Other details</label>
          <textarea className="textarea" placeholder="Electrical, water access, contact, hours, restrictions" value={f.notes} onChange={e => upd('notes', e.target.value)} />
        </div>
        {!valid ? <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Fields marked * are required.</p> : null}
      </div>
    </Modal>
  );
}

function VenueDetailModal({ venue, onClose, onEdit }) {
  if (!venue) return null;
  return (
    <Modal open={!!venue} onClose={onClose} title={venue.name} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-coral" onClick={() => onEdit(venue)}><SP_I.Pencil size={14} />Edit venue</button></>}>
      {venue.image ? <div style={{ height: 220, borderRadius: 12, background: `center/cover url(${venue.image})`, marginBottom: 16 }} /> : null}
      <div className="grid-2" style={{ gap: 12 }}>
        <KV label="City" value={venue.city} />
        <KV label="Type" value={venue.type} />
        <KV label="Capacity" value={`${venue.capacity} guests`} />
        <KV label="Address" value={venue.address || '—'} />
      </div>
      {venue.parking ? <><h4 style={{ margin: '20px 0 6px', fontSize: 14, fontWeight: 600 }}>Parking & access</h4><p style={{ margin: 0, fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>{venue.parking}</p></> : null}
      {venue.notes ? <><h4 style={{ margin: '20px 0 6px', fontSize: 14, fontWeight: 600 }}>Notes</h4><p style={{ margin: 0, fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>{venue.notes}</p></> : null}
    </Modal>
  );
}

/* ============ Settings ============ */
function PageSettings({ role, currentUser }) {
  const [tab, setTab] = SP_us('profile');
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Settings</h2></div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <div className="col" style={{ gap: 4 }}>
          {['profile','account','notifications','payouts','privacy','team','danger'].map(s => (
            <button key={s} onClick={() => setTab(s)} className={`nav-item ${tab===s ? 'active' : ''}`} style={{ textTransform: 'capitalize' }}>{s === 'danger' ? 'Danger zone' : s === 'privacy' ? 'Privacy & data' : s}</button>
          ))}
        </div>
        <div className="col" style={{ gap: 16 }}>
          {tab === 'profile' ? <SettingsProfile user={currentUser} /> : null}
          {tab === 'account' ? <SettingsAccount /> : null}
          {tab === 'notifications' ? <SettingsNotifications /> : null}
          {tab === 'payouts' ? <SettingsPayouts /> : null}
          {tab === 'privacy' ? <SettingsPrivacy role={role} /> : null}
          {tab === 'team' ? <SettingsTeam /> : null}
          {tab === 'danger' ? <SettingsDanger /> : null}
        </div>
      </div>
    </div>
  );
}

function SettingsPrivacy({ role }) {
  const toast = useToast();
  const [hideOldRatings, setHideOldRatings] = SP_us(false);
  const [noindex, setNoindex] = SP_us(false);
  const matrix = {
    admin:  ['Full visibility across all users, events, gigs, and payments.','Audit log access.','Can mediate disputes and release escrow.','Cannot read private message bodies.'],
    vendor: ['Only your own events, gigs, payments, and team are visible.','Worker profiles show public info only — ratings, gigs, location.','You see worker contact info only after confirming them on a gig.','Disputes you file are visible to admins and the named worker.'],
    worker: ['Only your own confirmed gigs, applications, and payments are visible.','Other workers in your favorites list see your public profile.','Vendors see your profile only when you apply to a gig.','You can hide your ratings older than 12 months from Settings.'],
  };
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 14 }}>Privacy & data</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-muted)' }}>What you can see and what others can see about you, as a <strong style={{ color: 'var(--color-ink)', textTransform: 'capitalize' }}>{role}</strong>.</p>
      <div className="col" style={{ gap: 10 }}>
        {matrix[role].map(line => (
          <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: 'var(--color-surface-soft)', borderRadius: 10 }}>
            <SP_I.ShieldCheck size={16} style={{ color: 'var(--rosy-teal-dark)', flex: 'none', marginTop: 2 }} />
            <span style={{ fontSize: 13.5 }}>{line}</span>
          </div>
        ))}
      </div>
      <div className="divider" style={{ margin: '20px 0' }} />
      <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>Your data</h4>
      <div className="col" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => toast.push({ kind: 'success', title: 'Export started', body: 'We\'ll email the ZIP within 5 minutes.' })}><SP_I.UploadCloud size={14} />Export all my data</button>
        <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setHideOldRatings(v => !v); toast.push({ kind: 'info', title: hideOldRatings ? 'Older ratings visible' : 'Older ratings hidden', body: hideOldRatings ? 'Ratings older than 12 months now show.' : 'Ratings older than 12 months are now hidden from your profile.' }); }}>
          <SP_I.Eye size={14} />{hideOldRatings ? '✓ ' : ''}Hide ratings older than 12 months
        </button>
        <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setNoindex(v => !v); toast.push({ kind: 'info', title: noindex ? 'Search engines allowed' : 'Search engines blocked', body: noindex ? 'Your public profile is indexable again.' : 'Your public profile is now noindex.' }); }}>
          <SP_I.ShieldCheck size={14} />{noindex ? '✓ ' : ''}Hide profile from search engines
        </button>
      </div>
    </div>
  );
}

function SettingsProfile({ user }) {
  const toast = useToast();
  const [photo, setPhoto] = SP_us(null);
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Profile</h3>
      <div style={{ marginBottom: 16 }}>
        <ImageUpload value={photo} onChange={setPhoto} label="Upload new photo" size={88} />
      </div>
      <div className="grid-2" style={{ gap: 14 }}>
        <div className="field"><label className="field-label">First name</label><input className="input" defaultValue={user.first} /></div>
        <div className="field"><label className="field-label">Last name</label><input className="input" defaultValue={user.last} /></div>
        <div className="field"><label className="field-label">Email</label><input className="input" defaultValue={user.email} /></div>
        <div className="field"><label className="field-label">Phone</label><input className="input" defaultValue="+1 (917) 555-0188" /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Bio</label><textarea className="textarea" defaultValue="Lead floral designer with 8 years of high-end event experience. Brooklyn-based. Specializes in suspended installations and editorial moments." /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-coral" onClick={() => toast.push({ kind: 'success', title: 'Profile updated' })}>Save changes</button>
      </div>
    </div>
  );
}

function SettingsAccount() {
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Account</h3>
      <div className="col" style={{ gap: 16 }}>
        <div className="field"><label className="field-label">Password</label><input className="input" type="password" defaultValue="••••••••••" /></div>
        <div className="field"><label className="field-label">Two-factor authentication</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="toggle on" /><span style={{ fontSize: 13.5 }}>Enabled via authenticator app</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNotifications() {
  const [s, setS] = SP_us({ apps: true, msgs: true, payments: true, weekly: false });
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Notifications</h3>
      <div className="col" style={{ gap: 14 }}>
        {[
          ['apps','New gig applications'],
          ['msgs','New messages'],
          ['payments','Payment status changes'],
          ['weekly','Weekly summary digest'],
        ].map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-hairline)' }}>
            <span>{label}</span>
            <span className={`toggle ${s[k] ? 'on' : ''}`} onClick={() => setS(x => ({ ...x, [k]: !x[k] }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPayouts() {
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Payouts</h3>
      <div style={{ background: 'var(--rosy-teal-soft)', border: '1px solid var(--rosy-teal-border)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>Stripe Connect — Connected</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--rosy-teal-dark)' }}>Payouts to Bank of America ••••3041 · 1–2 business days</p>
        </div>
        <button className="btn btn-ghost-teal btn-sm">Manage in Stripe</button>
      </div>
    </div>
  );
}

function SettingsTeam() { return <div className="card"><h3 className="card-title">Team</h3><Empty icon={SP_I.Users} title="No teammates yet" body="Invite collaborators to manage this account." cta={<button className="btn btn-coral btn-sm"><SP_I.UserPlus size={14} />Invite</button>} /></div>; }
function SettingsDanger() {
  return (
    <div className="card" style={{ borderColor: 'var(--rosy-coral)' }}>
      <h3 className="card-title" style={{ color: 'var(--rosy-coral)', marginBottom: 12 }}>Danger zone</h3>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', marginBottom: 16 }}>Permanently delete your account and all associated data. This can't be undone.</p>
      <button className="btn btn-danger">Delete account</button>
    </div>
  );
}

/* ============ Audit log (admin) ============ */
function PageAudit() {
  const toast = useToast();
  const [search, setSearch] = SP_us('');
  const entries = [
    { who: 'Ben Reyes',    what: 'Released disputed payment Atelier #4015-D',  when: '2 minutes ago', kind: 'payment' },
    { who: 'Mariana Cruz', what: 'Created event "Wheeler Wedding"',            when: '14 minutes ago', kind: 'event' },
    { who: 'Naomi Park',   what: 'Confirmed gig: Carter–Liang Reception (Lead)', when: '1 hour ago', kind: 'gig' },
    { who: 'System',       what: 'Auto-approved hours for 6 completed gigs',   when: '3 hours ago', kind: 'system' },
    { who: 'Theo Akande',  what: 'Updated company profile for Floral Forge',   when: '5 hours ago', kind: 'profile' },
    { who: 'Henry Lim',    what: 'Filed dispute on Atelier #4015-D',           when: 'Yesterday',    kind: 'payment' },
    { who: 'Ben Reyes',    what: 'Suspended user: spam-account-2025',          when: 'Yesterday',    kind: 'admin' },
    { who: 'System',       what: 'Stripe payout batch processed ($24,180)',    when: '2 days ago',   kind: 'system' },
  ];
  const colorByKind = { payment: 'var(--rosy-teal-soft)', event: 'var(--color-brand-peach)', gig: 'var(--rosy-teal-soft)', system: 'var(--color-surface-card)', profile: 'var(--color-surface-soft)', admin: 'var(--rosy-coral-soft)' };
  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [e.who, e.what, e.kind].some(s => s.toLowerCase().includes(q));
  });
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Audit log</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search log..." style={{ paddingLeft: 36, width: 220, height: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toast.push({ kind: 'success', title: 'Export started', body: 'Audit-log-2026-05.csv will download shortly.' })}>Export CSV</button>
        </div>
      </div>
      <div className="card card-flush">
        {filtered.length === 0 ? <Empty icon={SP_I.ScrollText} title="No matching entries" /> :
         filtered.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 20px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--color-hairline)' }}>
            <div style={{ width: 8, height: 8, background: colorByKind[e.kind] || 'var(--color-surface-card)', borderRadius: 9999, marginTop: 8, flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14 }}><strong>{e.who}</strong> {e.what}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{e.when} · {e.kind}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Analytics (admin) ============ */
function PageAnalytics() {
  const [range, setRange] = SP_us('12m');
  const series = [22, 30, 26, 38, 42, 36, 48, 58, 52, 64, 71, 84];
  const months = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
  const max = Math.max(...series);
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Analytics</h2><div className="tabs">
        {[['12m','Last 12 mo'],['ytd','YTD'],['all','All time']].map(([id, label]) => (
          <button key={id} className={range === id ? 'on' : ''} onClick={() => setRange(id)}>{label}</button>
        ))}
      </div></div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SP_I.Briefcase} label="Gigs filled" value={1842} delta={28} />
        <StatCard icon={SP_I.DollarSign} label="Platform GMV" value={284600} prefix="$" delta={34} />
        <StatCard icon={SP_I.Users} label="Active vendors" value={148} delta={9} />
        <StatCard icon={SP_I.UserCircle2} label="Active workers" value={612} delta={22} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Monthly GMV</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 220, gap: 10, padding: '8px 0' }}>
          {series.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', height: `${(v / max) * 100}%`, background: i === series.length - 1 ? 'var(--rosy-coral)' : 'var(--color-brand-peach)', borderRadius: 8, minHeight: 12 }} />
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{months[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Top vendors by GMV</h3>
          {[['Bloom & Fern Studio', 48200], ['Floral Forge', 36100], ['Thistle & Honey', 22400], ['Wild & Ivory', 19800]].map(([n, v], i) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === 3 ? 'none' : '1px solid var(--color-hairline)', fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>{n}</span>
              <span className="t-mono-amount">{fmtMoney(v)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Top workers by hours</h3>
          {[['Naomi Park', 312], ['Jasper Wu', 268], ['Marcus Chen', 191], ['Daniela Soto', 142]].map(([n, h], i) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === 3 ? 'none' : '1px solid var(--color-hairline)', fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>{n}</span>
              <span className="t-mono">{h}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Simple content/email/gallery admin pages ============ */
function PageSiteContent() {
  const toast = useToast();
  const [items, setItems] = SP_us([
    ['Hero headline', 'Where floral excellence meets efficiency.'],
    ['Hero sub',      'A skilled crew on every event — booked in minutes, paid in days.'],
    ['About title',   'A community of florists, not a job board.'],
    ['CTA headline',  'Run your next event with the right team.'],
  ]);
  const [sections, setSections] = SP_us([
    { id: 's1', title: 'Hero', desc: 'Headline + sub + CTA + image' },
    { id: 's2', title: 'How it works', desc: '3-step explainer with icons' },
    { id: 's3', title: 'Testimonials', desc: 'Carousel of 6 vendor quotes' },
    { id: 's4', title: 'Pricing', desc: 'Plan cards with feature checklist' },
    { id: 's5', title: 'FAQ', desc: 'Accordion of 8 common questions' },
  ]);
  const [addSectionOpen, setAddSectionOpen] = SP_us(false);
  const [newSection, setNewSection] = SP_us({ title: '', desc: '' });
  const updateAt = (i, v) => setItems(its => its.map((it, idx) => idx === i ? [it[0], v] : it));
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Site content</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddSectionOpen(true)}><SP_I.Plus size={14} />Add section</button>
          <button className="btn btn-coral btn-sm" onClick={() => toast.push({ kind: 'success', title: 'Saved', body: 'Live on rosyrecruits.com within 60 seconds.' })}>Save changes</button>
        </div>
      </div>
      <div className="grid-2">
        {items.map(([t, v], i) => (
          <div key={t} className="card">
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{t}</p>
            <input className="input" value={v} onChange={e => updateAt(i, e.target.value)} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <h3 style={{ margin: '28px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em' }}>Page sections</h3>
      <div className="grid-2">
        {sections.map(sec => (
          <div key={sec.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{sec.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>{sec.desc}</p>
            </div>
            <button className="icon-btn" aria-label="Delete section" onClick={() => { setSections(s => s.filter(x => x.id !== sec.id)); toast.push({ kind: 'info', title: 'Section removed' }); }}><SP_I.Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {addSectionOpen ? (
        <Modal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} title="Add section" size="sm"
          footer={<><button className="btn btn-ghost" onClick={() => setAddSectionOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={!newSection.title.trim()} onClick={() => { setSections(s => [...s, { id: 's' + Date.now(), ...newSection }]); setNewSection({ title: '', desc: '' }); setAddSectionOpen(false); toast.push({ kind: 'success', title: 'Section added' }); }}>Add</button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Title</label><input className="input" value={newSection.title} onChange={(e) => setNewSection({ ...newSection, title: e.target.value })} placeholder="e.g. Case studies" /></div>
            <div><label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Description</label><input className="input" value={newSection.desc} onChange={(e) => setNewSection({ ...newSection, desc: e.target.value })} placeholder="What this section contains" /></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function PageEmails() {
  const toast = useToast();
  const [templates, setTemplates] = SP_us(window.RosyStores.emailTemplates);
  const [editId, setEditId] = SP_us(null);
  const [draft, setDraft] = SP_us({ subject: '', body: '', live: true });
  const [testModalOpen, setTestModalOpen] = SP_us(false);
  const [testEmail, setTestEmail] = SP_us('');

  const openTemplate = (id) => {
    setEditId(id);
    const t = templates[id];
    setDraft({ subject: t.subject, body: t.body, live: t.live });
  };
  const saveTemplate = () => {
    const updated = { ...templates[editId], subject: draft.subject, body: draft.body, live: draft.live, lastEdited: new Date().toISOString().slice(0, 10) };
    const next = { ...templates, [editId]: updated };
    setTemplates(next);
    window.RosyStores.emailTemplates = next;
    setEditId(null);
    toast.push({ kind: 'success', title: 'Template saved', body: 'Outgoing emails using this template will update immediately.' });
  };

  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Email templates</h2><p className="t-muted" style={{ margin: 0, fontSize: 13 }}>Live edits affect outgoing emails immediately.</p></div>
      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr><th>Template</th><th>Subject</th><th>Last edited</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {Object.entries(templates).map(([id, t]) => (
              <tr key={id} style={{ cursor: 'pointer' }} onClick={() => openTemplate(id)}>
                <td style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{t.name}</td>
                <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t.subject}</td>
                <td style={{ color: 'var(--color-muted)', fontSize: 13 }}>{t.lastEdited}</td>
                <td>{t.live ? <Badge kind="Active">Live</Badge> : <Badge kind="Draft">Draft</Badge>}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="row-action-btn" onClick={() => openTemplate(id)}><SP_I.Pencil size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!editId} onClose={() => setEditId(null)} title={editId ? templates[editId].name : ''} size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button><button className="btn btn-ghost" onClick={() => setTestModalOpen(true)}>Send test</button><button className="btn btn-coral" onClick={saveTemplate}>Save changes</button></>}>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Subject line</label><input className="input" value={draft.subject} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} /></div>
          <div className="field"><label className="field-label">Body</label>
            <textarea className="textarea" value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--color-hairline)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Live (send to users)</span>
            <span className={`toggle ${draft.live ? 'on' : ''}`} onClick={() => setDraft(d => ({ ...d, live: !d.live }))} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Variables: <code>{`{{worker_first}}`}</code>, <code>{`{{event_name}}`}</code>, <code>{`{{event_date}}`}</code>, <code>{`{{call_time}}`}</code>, <code>{`{{venue_name}}`}</code>, <code>{`{{hourly_rate}}`}</code></p>
        </div>
      </Modal>
      {testModalOpen ? (
        <Modal open={testModalOpen} onClose={() => setTestModalOpen(false)} title="Send test email" size="sm"
          footer={<><button className="btn btn-ghost" onClick={() => setTestModalOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={!testEmail.includes('@')} onClick={() => { setTestModalOpen(false); toast.push({ kind: 'success', title: 'Test email sent', body: `Sent to ${testEmail}` }); setTestEmail(''); }}>Send</button></>}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Send to</label>
          <input className="input" placeholder="you@studio.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
        </Modal>
      ) : null}
    </div>
  );
}

function PageGallery() {
  const toast = useToast();
  const [items, setItems] = SP_us(window.RosyStores.gallery);
  const [filter, setFilter] = SP_us('all');
  const fileRef = React.useRef(null);

  const updateItem = (id, patch) => {
    setItems(arr => {
      const next = arr.map(x => x.id === id ? { ...x, ...patch } : x);
      window.RosyStores.gallery = next;
      return next;
    });
  };
  const removeItem = (id) => {
    setItems(arr => {
      const next = arr.filter(x => x.id !== id);
      window.RosyStores.gallery = next;
      return next;
    });
    toast.push({ kind: 'warning', title: 'Photo removed' });
  };
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newId = 'g' + Math.random().toString(36).slice(2, 6);
      const next = [{ id: newId, src: ev.target.result, section: 'unused' }, ...items];
      setItems(next); window.RosyStores.gallery = next;
      toast.push({ kind: 'success', title: 'Photo uploaded', body: 'Assign it to a section below.' });
    };
    reader.readAsDataURL(f);
  };

  const filtered = items.filter(x => filter === 'all' || x.section === filter);
  const sectionCounts = window.GALLERY_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: items.filter(x => x.section === s.id).length }), {});

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Gallery</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-coral btn-sm" onClick={() => fileRef.current && fileRef.current.click()}><SP_I.UploadCloud size={14} />Upload</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        <button className={`pill`} style={{ background: filter === 'all' ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: filter === 'all' ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }} onClick={() => setFilter('all')}>All ({items.length})</button>
        {window.GALLERY_SECTIONS.map(s => (
          <button key={s.id} className="pill" style={{ background: filter === s.id ? 'var(--color-ink)' : 'var(--color-surface-soft)', color: filter === s.id ? '#fff' : 'var(--color-muted)', cursor: 'pointer', border: 0 }} onClick={() => setFilter(s.id)}>{s.label} ({sectionCounts[s.id]})</button>
        ))}
      </div>
      {filtered.length === 0 ? <Empty icon={SP_I.Image} title="No photos in this section" body="Drag a photo here or upload from the toolbar." /> : (
        <div className="grid-3">
          {filtered.map(item => {
            const section = window.GALLERY_SECTIONS.find(s => s.id === item.section);
            return (
              <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', aspectRatio: '4/5' }}>
                  <EventImage src={item.src} name={section?.label || 'Photo'} size="100%" radius={0}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                  <button className="row-action-btn danger" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.92)' }} onClick={() => removeItem(item.id)}><SP_I.Trash2 size={14} /></button>
                </div>
                <div style={{ padding: 12 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assigned to</p>
                  <select className="select" style={{ height: 34, padding: '0 10px' }} value={item.section} onChange={e => updateItem(item.id, { section: e.target.value })}>
                    {window.GALLERY_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PagePlatformSettings() {
  const toast = useToast();
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Platform settings</h2>
        <button className="btn btn-coral" onClick={() => toast.push({ kind: 'success', title: 'Settings saved' })}>Save changes</button>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>Default gig rates</h3>
          {Object.entries(SP_D.GIG_TYPES).map(([k, v]) => (
            <div key={k} className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{k}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" defaultValue={v.hourly} style={{ width: 100 }} />
                <span style={{ alignSelf: 'center', color: 'var(--color-muted)', fontSize: 13 }}>$/hr default</span>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>Fees</h3>
          <div className="field" style={{ marginBottom: 12 }}><label className="field-label">Vendor platform fee</label><input className="input" defaultValue="6.0%" /></div>
          <div className="field" style={{ marginBottom: 12 }}><label className="field-label">Worker take rate</label><input className="input" defaultValue="92%" /></div>
          <div className="field"><label className="field-label">Stripe Connect fee</label><input className="input" defaultValue="2.9% + $0.30" /></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PagePayments, PageDisputes, PageDirectory, PageVenues, PageSettings, PageAudit, PageAnalytics, PageSiteContent, PageEmails, PageGallery, PagePlatformSettings });

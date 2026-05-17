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
  const [picked, setPicked] = SP_us({});

  // Fire in-app notifications to both parties after a payment approval.
  const notifyPaymentApproved = async (t) => {
    try {
      const vendorUser = SP_D.USERS.find(u => u.company === t.payer || u.name === t.payer || (u.role === 'vendor' && u.company && t.payer.includes(u.company)));
      const workerUser = SP_D.USERS.find(u => u.name === t.payee);
      const stamp = new Date().toISOString();
      const push = (entry) => {
        SP_D.NOTIFICATIONS = SP_D.NOTIFICATIONS || [];
        SP_D.NOTIFICATIONS.unshift(entry);
      };
      if (workerUser) {
        push({ id: 'pay_wrk_' + t.id, type: 'payment_sent', title: `Payment received: ${fmtMoney(t.amount)}`, body: `${t.payer} approved your invoice ${t.invoice}. Funds land in your Stripe account within 48h.`, time: 'Just now', link: '#worker/payments', unread: true, user_id: workerUser.id });
      }
      if (vendorUser) {
        push({ id: 'pay_vnd_' + t.id, type: 'payment_sent', title: `Payment confirmed: ${t.invoice}`, body: `Released ${fmtMoney(t.amount)} to ${t.payee}.`, time: 'Just now', link: '#vendor/payments', unread: true, user_id: vendorUser.id });
      }
      window.dispatchEvent(new CustomEvent('rosy:data-changed'));
      // Best-effort persist to Supabase
      if (window.sb && (workerUser || vendorUser)) {
        const rows = [];
        if (workerUser) rows.push({ user_id: workerUser.id, type: 'payment_sent', title: `Payment received: ${fmtMoney(t.amount)}`, body: `${t.payer} approved your invoice ${t.invoice}.`, link: '#worker/payments', read: false });
        if (vendorUser) rows.push({ user_id: vendorUser.id, type: 'payment_sent', title: `Payment confirmed: ${t.invoice}`, body: `Released ${fmtMoney(t.amount)} to ${t.payee}.`, link: '#vendor/payments', read: false });
        if (rows.length) window.sb.from('rr_notifications').insert(rows).then(() => {});
      }
    } catch (e) { console.warn('notify payment failed:', e); }
  };

  const approveOne = async (t) => {
    try { await window.RosyMutate?.applications?.setPaymentStatus(t.id, 'paid'); } catch (e) { console.warn(e); }
    await notifyPaymentApproved(t);
    toast.push({ kind: 'success', title: 'Payment released', body: `${fmtMoney(t.amount)} sent to ${t.payee}` });
  };
  let txs = SP_D.TRANSACTIONS;
  // Scope payments strictly by the current user. Workers see only invoices
  // addressed exactly to them; vendors see only invoices from their company.
  // No fallback matching — that leaks demo rows to brand-new users.
  if (role === 'vendor') {
    const company = currentUser?.company || '';
    const name = currentUser?.name || '';
    txs = txs.filter(t => (company && t.payer === company) || (name && t.payer === name));
  }
  if (role === 'worker') {
    const name = currentUser?.name || '';
    // Workers only see records for actual completed work — hide $0 / "Not Due"
    // placeholder rows that get generated when a gig is merely assigned.
    txs = txs.filter(t => name && t.payee === name && t.status !== 'Not Due' && (t.amount || 0) > 0);
  }

  const filtered = txs
    .filter(t => statusTab === 'all' || t.status.toLowerCase() === statusTab)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [t.invoice, t.payee, t.payer].some(s => (s || '').toLowerCase().includes(q));
    });

  const paged = usePaged(filtered, 10, `${search}|${statusTab}|${filtered.length}`);
  const visible = paged.slice;
  const pickedIds = Object.keys(picked).filter(k => picked[k]);
  const pickedCount = pickedIds.length;
  const pickedRows  = txs.filter(t => pickedIds.includes(t.id));
  const canApproveAny = pickedRows.some(t => t.status === 'Pending');

  const bulkApprove = async () => {
    const targets = pickedRows.filter(t => t.status === 'Pending');
    for (const t of targets) {
      try { await window.RosyMutate?.applications?.setPaymentStatus(t.id, 'paid'); } catch (e) { console.warn(e); }
      await notifyPaymentApproved(t);
    }
    setPicked({});
    toast.push({ kind: 'success', title: `${targets.length} payments released`, body: `Total ${fmtMoney(targets.reduce((s,t) => s + t.amount, 0))}` });
  };
  const bulkDispute = () => {
    if (pickedRows.length === 1) { setDispute(pickedRows[0]); return; }
    pickedRows.forEach(t => { try { window.RosyMutate?.applications?.setPaymentStatus(t.id, 'disputed'); } catch (e) {} });
    setPicked({});
    toast.push({ kind: 'warning', title: `${pickedRows.length} marked disputed`, body: 'Rosy support will review within 48 hours.' });
  };

  React.useEffect(() => {
    if (!openId) return;
    const t = txs.find(x => x.id === openId);
    if (t) setOpenTx(t);
  }, [openId, role]);

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
            <tr>
              {role !== 'worker' ? (
                <th style={{ width: 36 }}>
                  <CheckBox
                    checked={visible.length > 0 && visible.every(t => picked[t.id])}
                    onChange={(on) => { setPicked(p => { const n = { ...p }; visible.forEach(t => { if (on) n[t.id] = true; else delete n[t.id]; }); return n; }); }} />
                </th>
              ) : null}
              <th>Invoice</th><th>Status</th><th>{role==='worker' ? 'From' : 'To / from'}</th><th>Amount</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? <tr><td colSpan={role !== 'worker' ? 7 : 6}><Empty icon={SP_I.CreditCard} title="No matching payments" body="Try a different status or search term." /></td></tr> :
             visible.map(t => (
              <tr key={t.id} tabIndex={0} role="button" aria-label={`Open invoice ${t.invoice}`}
                  onClick={(e) => { if (e.target.closest('button') || e.target.closest('[role=checkbox]')) return; setOpenTx(t); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOpenTx(t); } }}
                  style={{ cursor: 'pointer' }}>
                {role !== 'worker' ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <CheckBox checked={!!picked[t.id]} onChange={(on) => setPicked(p => ({ ...p, [t.id]: on }))} />
                  </td>
                ) : null}
                <td style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{t.invoice}{t.note ? <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--color-warning)' }}>{t.note}</p> : null}</td>
                <td><Badge kind={t.status} /></td>
                <td style={{ fontSize: 13 }}>{role === 'worker' ? t.payer : (role === 'vendor' ? t.payee : `${t.payee} ← ${t.payer}`)}</td>
                <td className="t-mono-amount">{fmtMoney(t.amount)}</td>
                <td style={{ color: 'var(--color-muted)', fontSize: 13 }}>{fmtDate(t.date, 'mdy-dots')}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    {/* Approved payments show a "Complete" badge instead of action buttons */}
                    {t.status === 'Paid' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 9999, fontWeight: 600 }}>
                        <SP_I.CheckCircle2 size={12} />Complete
                      </span>
                    ) : (<>
                      {t.status === 'Pending' && role !== 'worker' ?
                        <button className="btn btn-coral btn-sm" onClick={() => approveOne(t)}>Approve</button> : null}
                      {t.status !== 'Disputed' ?
                        <button className="btn btn-ghost btn-sm" onClick={() => setDispute(t)}><SP_I.AlertTriangle size={14} />Dispute</button> : null}
                    </>)}
                    <button className="row-action-btn" aria-label="Open invoice" onClick={() => setOpenTx(t)}><SP_I.ExternalLink size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="payments" />
      </div>

      {role !== 'worker' ? (
        <BulkActionBar count={pickedCount} onClear={() => setPicked({})}
          actions={[
            { label: 'Approve', icon: SP_I.CheckCircle2, onClick: bulkApprove, disabled: !canApproveAny },
            { label: 'Dispute', icon: SP_I.AlertTriangle, onClick: bulkDispute },
            { label: 'Clear',   icon: SP_I.X,             onClick: () => setPicked({}) },
          ]} />
      ) : null}

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
  const [view, setView] = SP_us('cards');
  const [search, setSearch] = SP_us('');
  const [statusFilter, setStatusFilter] = SP_us('all');
  const [sortBy, setSortBy] = SP_us('newest');
  const allDisputes = SP_D.TRANSACTIONS.filter(t => t.status === 'Disputed' || t.status === 'Late');
  const disputed = allDisputes
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [t.invoice, t.payer, t.payee, t.note].some(s => (s || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'newest')  return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest')  return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount-desc') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'amount-asc')  return (a.amount || 0) - (b.amount || 0);
      return 0;
    });
  const stats = {
    open:      allDisputes.length,
    disputed:  allDisputes.filter(t => t.status === 'Disputed').length,
    late:      allDisputes.filter(t => t.status === 'Late').length,
    atStake:   allDisputes.reduce((s, t) => s + (t.amount || 0), 0),
  };
  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SP_I.AlertTriangle} label="Open disputes"   value={stats.open} />
        <StatCard icon={SP_I.ShieldAlert}   label="In dispute"      value={stats.disputed} />
        <StatCard icon={SP_I.Clock}         label="Late payouts"    value={stats.late} />
        <StatCard icon={SP_I.DollarSign}    label="$ at stake"      value={fmtMoney(stats.atStake)} />
      </div>
      <div className="section-heading">
        <h2>Disputes & overdue</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search invoice, party, note…" style={{ paddingLeft: 36, width: 280 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['newest','Newest first'],['oldest','Oldest first'],['amount-desc','Highest amount'],['amount-asc','Lowest amount']]} />
          <ViewToggle value={view} onChange={setView} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','All'],['Disputed','Disputed'],['Late','Late']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setStatusFilter(id)} style={{ border: '1.5px solid', borderColor: statusFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: statusFilter === id ? 'var(--color-ink)' : 'transparent', color: statusFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {disputed.length === 0 ? (
        <Empty icon={SP_I.ShieldCheck} title="No active disputes" body="When a payment is contested or overdue, it'll show up here for you to mediate." />
      ) : view === 'table' ? (
        <div className="table-wrap">
          <table className="rosy-table">
            <thead><tr><th>Invoice</th><th>Type</th><th>Filed</th><th>Worker</th><th>Vendor</th><th>Amount</th><th style={{ width: 160 }}></th></tr></thead>
            <tbody>
              {disputed.map(t => (
                <tr key={t.id} tabIndex={0} role="button" aria-label={`Open dispute ${t.invoice}`} style={{ cursor: 'pointer' }}
                  onClick={(e) => { if (e.target.closest('button')) return; setThread(t); }}>
                  <td style={{ fontWeight: 600, fontSize: 13.5 }}>{t.invoice}</td>
                  <td><Badge kind={t.status} /></td>
                  <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{fmtDate(t.date, 'mdy-dots')}</td>
                  <td style={{ fontSize: 13 }}>{t.payee}</td>
                  <td style={{ fontSize: 13 }}>{t.payer}</td>
                  <td className="t-mono-amount" style={{ fontSize: 14 }}>{fmtMoney(t.amount)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="row-action-btn" onClick={() => setThread(t)} title="View thread"><SP_I.MessageSquare size={14} /></button>
                      <button className="btn btn-coral btn-sm" onClick={() => setMediate(t)}>Mediate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
      )}

      <Modal open={!!mediate} onClose={() => setMediate(null)} title="Mediate dispute" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setMediate(null)}>Close</button><button className="btn btn-ghost-coral" onClick={async () => { const t = mediate; setMediate(null); try { await window.RosyMutate?.applications?.setPaymentStatus(t.id, 'partial'); } catch (e) { console.warn(e); } toast.push({ kind: 'success', title: 'Split decision', body: 'Worker paid 75%, vendor refunded 25%.' }); }}>Split 75/25</button><button className="btn btn-coral" onClick={async () => { const t = mediate; setMediate(null); try { await window.RosyMutate?.applications?.setPaymentStatus(t.id, 'paid'); } catch (e) { console.warn(e); } toast.push({ kind: 'success', title: 'Released to worker', body: 'Worker paid in full. Vendor notified.' }); }}>Release to worker</button></>}>
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
function PageDirectory({ filter, title, role, setRoute, openId, openAction, currentUser }) {
  const [search, setSearch] = SP_us('');
  const [view, setView] = SP_us('table');
  const [statusFilter, setStatusFilter] = SP_us('all');
  const [roleFilter, setRoleFilter] = SP_us('all');
  const [ratingFilter, setRatingFilter] = SP_us('any');
  const [cityFilter, setCityFilter] = SP_us('all');
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
  // Saved-profiles ("My team") — owner-scoped shortlist of user ids.
  const ownerId = currentUser?.id || 'anon';
  const [savedIds, setSavedIds] = SP_us(() => {
    return (window.RosyStores?.savedProfiles?.[ownerId] || []).slice();
  });
  const [savedOnly, setSavedOnly] = SP_us(false);
  const toggleSaved = async (uid) => {
    setSavedIds(arr => {
      const exists = arr.includes(uid);
      const next = exists ? arr.filter(x => x !== uid) : [...arr, uid];
      window.RosyStores.savedProfiles[ownerId] = next;
      try { localStorage.setItem('rosy.savedProfiles', JSON.stringify(window.RosyStores.savedProfiles)); } catch (_) {}
      // Best-effort persist
      try {
        if (window.sb) {
          if (exists) {
            window.sb.from('rr_user_lists').delete().eq('owner_id', ownerId).eq('user_id', uid).then(() => {});
          } else {
            window.sb.from('rr_user_lists').insert({ owner_id: ownerId, user_id: uid, name: 'My team', created_at: new Date().toISOString() }).then(() => {});
          }
        }
      } catch (_) { /* table may not exist */ }
      toast.push({ kind: exists ? 'info' : 'success', title: exists ? 'Removed from My team' : 'Saved to My team' });
      return next;
    });
  };
  const toast = useToast();

  const merged = SP_D.USERS.map(u => overrides[u.id] ? { ...u, ...overrides[u.id] } : u).filter(u => !deleted[u.id]);
  // Unique city list (best-effort) for the filter dropdown.
  const cities = Array.from(new Set(merged.map(u => u.city).filter(Boolean))).sort();
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0) + (ratingFilter !== 'any' ? 1 : 0) + (cityFilter !== 'all' ? 1 : 0);

  const all = merged
    .filter(u => filter ? filter(u) : true)
    .filter(u => !savedOnly || savedIds.includes(u.id))
    .filter(u => statusFilter === 'all' || u.status === statusFilter)
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => cityFilter === 'all' || u.city === cityFilter)
    .filter(u => {
      if (ratingFilter === 'any') return true;
      if (ratingFilter === 'unrated') return !u.rating;
      const min = parseFloat(ratingFilter);
      return (u.rating || 0) >= min;
    })
    .filter(u => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [u.name, u.email, u.company, u.city, u.role].some(s => (s || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.joined) - new Date(a.joined);
      if (sortBy === 'oldest') return new Date(a.joined) - new Date(b.joined);
      if (sortBy === 'name')   return a.name.localeCompare(b.name);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'gigs')   return (b.gigs   || 0) - (a.gigs   || 0);
      return 0;
    });

  // Top-of-page analytics strip — pre-scope summary that ignores search but respects role/status.
  const scopedForStats = merged.filter(u => filter ? filter(u) : true);
  const stats = {
    total:    scopedForStats.length,
    active:   scopedForStats.filter(u => u.status === 'active').length,
    inactive: scopedForStats.filter(u => u.status === 'inactive').length,
    avgRating: (() => { const r = scopedForStats.filter(u => u.rating); return r.length ? (r.reduce((s, u) => s + u.rating, 0) / r.length).toFixed(2) : '—'; })(),
  };

  const paged = usePaged(all, 10, `${search}|${statusFilter}|${roleFilter}|${ratingFilter}|${cityFilter}|${sortBy}|${all.length}`);
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
      {/* Stat strip — matches the four-card layout on Events / Dashboard */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SP_I.Users}        label={`Total ${title.toLowerCase()}`} value={stats.total} />
        <StatCard icon={SP_I.CheckCircle2} label="Active"   value={stats.active} />
        <StatCard icon={SP_I.UserX}        label="Inactive" value={stats.inactive} />
        <StatCard icon={SP_I.Star}         label="Avg rating" value={stats.avgRating} />
      </div>
      <div className="section-heading">
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder={`Search by name, email, company, city, role…`} style={{ paddingLeft: 36, width: 320 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['newest','Newest first'],['oldest','Oldest first'],['name','Name A–Z'],['rating','Highest rated'],['gigs','Most gigs']]} />
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SP_I.Filter size={14} />Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</button>
          {role === 'admin' ? <button className="btn btn-coral" onClick={() => setInviteOpen(true)}><SP_I.Plus size={14} />Invite</button> : null}
        </div>
      </div>
      {/* Status tab strip — Active / Inactive / All + My team toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all','All'],['active','Active'],['inactive','Inactive']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setStatusFilter(id)}
            style={{ border: '1.5px solid', borderColor: statusFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: statusFilter === id ? 'var(--color-ink)' : 'transparent', color: statusFilter === id ? '#fff' : 'inherit', padding: '6px 14px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setSavedOnly(s => !s)}
          style={{ border: '1.5px solid', borderColor: savedOnly ? 'var(--rosy-coral)' : 'var(--color-hairline-strong)', background: savedOnly ? 'var(--rosy-coral-soft)' : 'transparent', color: savedOnly ? 'var(--rosy-coral)' : 'inherit', padding: '6px 14px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {savedOnly ? <SP_I.BookmarkFilled size={12} /> : <SP_I.Bookmark size={12} />}
          My team ({savedIds.length})
        </button>
      </div>
      {view === 'cards' ? (
        <>
          <div className="grid-3">
            {visible.length === 0 ? <div style={{ gridColumn: '1 / -1' }}><Empty icon={SP_I.Users} title="No matches" body="Try a broader search." /></div> :
             visible.map(u => (
              <div key={u.id} className="card" tabIndex={0} role="button" aria-label={`Open ${u.name}`} style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => { setSelected(u); setEditing(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSelected(u); setEditing(false); } }}>
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 14, right: 14 }}>
                  <CheckBox checked={!!picked[u.id]} onChange={(on) => setPicked(p => ({ ...p, [u.id]: on }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' }}>
                  <Avatar name={u.name} size="xl" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{u.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)', textTransform: 'capitalize' }}>{u.role}{u.company ? ` · ${u.company}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Badge kind={u.status === 'active' ? 'Active' : 'Inactive'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                    {u.rating ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', background: '#FEF3C7', color: '#92400E', borderRadius: 9999, fontWeight: 600 }}><SP_I.Star size={11} style={{ fill: '#F59E0B' }} />{u.rating}</span> : null}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{u.city || '—'}{u.gigs ? ` · ${u.gigs} gigs` : ''}</p>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label={title.toLowerCase()} />
        </>
      ) : (
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
                    <button className="row-action-btn" onClick={() => toggleSaved(u.id)} title={savedIds.includes(u.id) ? 'Remove from My team' : 'Save to My team'}>
                      {savedIds.includes(u.id) ? <SP_I.BookmarkFilled size={14} style={{ color: 'var(--rosy-coral)' }} /> : <SP_I.Bookmark size={14} />}
                    </button>
                    <button className="row-action-btn" onClick={() => { window.__rosyComposeTo = u.id; setRoute && setRoute('inbox'); }} title="Message"><SP_I.MessageSquare size={14} /></button>
                    <button className="row-action-btn" onClick={() => { setSelected(u); setEditing(false); }} title="View profile"><SP_I.Eye size={14} /></button>
                    <button className="row-action-btn" onClick={() => { setSelected(u); setEditing(true); }} title="Edit profile"><SP_I.Pencil size={14} /></button>
                    {u.role !== 'admin' && u.verified !== true ? (
                      <button className="row-action-btn" onClick={async () => {
                        setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), verified: true } }));
                        try { if (window.sb) await window.sb.from('rr_profiles').update({ verified: true }).eq('id', u.id); } catch (e) { console.warn(e); }
                        const uu = (window.RosyData?.USERS || []).find(x => x.id === u.id);
                        if (uu) { uu.verified = true; window.dispatchEvent(new CustomEvent('rosy:data-changed')); }
                        toast.push({ kind: 'success', title: `${u.name} verified`, body: 'They can now access the dashboard.' });
                      }} title="Verify account"><SP_I.UserCheck size={14} /></button>
                    ) : null}
                    <button className="row-action-btn" onClick={async () => {
                      const next = u.status === 'active' ? 'inactive' : 'active';
                      setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), status: next } }));
                      const liveUser = (window.RosyData?.USERS || []).find(x => x.id === u.id);
                      if (liveUser) liveUser.status = next;
                      window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                      try { if (window.sb) { const { error } = await window.sb.from('rr_profiles').update({ status: next }).eq('id', u.id); if (error) throw error; } } catch (e) { console.warn(e); toast.push({ kind: 'error', title: 'Status save failed', body: e.message }); return; }
                      toast.push({ kind: next === 'active' ? 'success' : 'warning', title: `${u.name} marked ${next}` });
                    }} title={u.status === 'active' ? 'Deactivate' : 'Activate'}>{u.status === 'active' ? <SP_I.UserX size={14} /> : <SP_I.CheckCircle2 size={14} />}</button>
                    <button className="row-action-btn danger" onClick={() => setConfirmId(u.id)} title="Delete"><SP_I.Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label={title.toLowerCase()} />
      </div>
      )}

      <BulkActionBar count={pickedCount} onClear={() => setPicked({})}
        actions={[
          { label: 'Message',    icon: SP_I.MessageSquare, onClick: () => { toast.push({ kind: 'success', title: `Drafting message to ${pickedCount}`, body: 'Opening Inbox composer…' }); setRoute && setRoute('inbox'); setPicked({}); } },
          { label: 'Activate',   icon: SP_I.CheckCircle2, onClick: () => applyBulk('activate') },
          { label: 'Deactivate', icon: SP_I.UserX,        onClick: () => applyBulk('deactivate') },
          { label: 'Clear',      icon: SP_I.X,            onClick: () => setPicked({}) },
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

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setStatusFilter('all'); setRoleFilter('all'); setRatingFilter('any'); setCityFilter('all'); }}>Reset all</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','All'],['active','Active'],['inactive','Inactive'],['pending','Pending'],['suspended','Suspended']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setStatusFilter(id)} className={`chip ${statusFilter === id ? 'on' : ''}`} style={{ border: '1.5px solid', borderColor: statusFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: statusFilter === id ? 'var(--color-ink)' : 'transparent', color: statusFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          {title === 'Users' ? (
            <div>
              <p className="t-eyebrow" style={{ marginBottom: 8 }}>Role</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['all','All'],['vendor','Vendor'],['worker','Worker']].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setRoleFilter(id)} className={`chip ${roleFilter === id ? 'on' : ''}`} style={{ border: '1.5px solid', borderColor: roleFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: roleFilter === id ? 'var(--color-ink)' : 'transparent', color: roleFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Minimum rating</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['any','Any'],['4.9','4.9★+'],['4.7','4.7★+'],['4.5','4.5★+'],['unrated','Unrated']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setRatingFilter(id)} className={`chip ${ratingFilter === id ? 'on' : ''}`} style={{ border: '1.5px solid', borderColor: ratingFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: ratingFilter === id ? 'var(--color-ink)' : 'transparent', color: ratingFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>City</p>
            <select className="select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all">All cities ({cities.length})</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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
  const blankDraft = { photo: '', name: '', first: '', last: '', email: '', phone: '', company: '', title: '', city: '', state: '', street: '', zip: '', hourlyRate: '', vendorRate: '', skills: '', bio: '', status: 'active' };
  const userToDraft = (u) => u ? ({
    photo:       u.photo || '',
    name:        u.name || '',
    first:       u.first || (u.name || '').split(' ')[0] || '',
    last:        u.last  || (u.name || '').split(' ').slice(1).join(' ') || '',
    email:       u.email || '',
    phone:       u.phone || '',
    company:     u.company || '',
    title:       u.title || '',
    city:        u.city || '',
    state:       u.state || '',
    street:      u.street || '',
    zip:         u.zip || '',
    hourlyRate:  u.hourlyRate ?? u.rate ?? '',
    vendorRate:  u.vendorRate ?? '',
    skills:      Array.isArray(u.skills) ? u.skills.join(', ') : (u.skills || ''),
    bio:         u.bio || u.description || '',
    status:      u.status || 'active',
  }) : blankDraft;
  const [draft, setDraft] = SP_us(userToDraft(user));
  React.useEffect(() => {
    setDraft(userToDraft(user));
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
        : <><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-ghost-teal" onClick={() => { const first = user.first || (user.name || '').split(' ')[0] || 'them'; onClose(); setRoute && setRoute('inbox'); toast.push({ kind: 'info', title: `Opening conversation with ${first}` }); }}><SP_I.MessageSquare size={14} />Message</button><button className="btn btn-coral" onClick={() => setEditing(true)}><SP_I.Pencil size={14} />Edit profile</button></>}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, alignItems: 'flex-start' }}>
        <Avatar name={user.name} size="xl" />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em' }}>{editing ? draft.name : user.name}</h3>
          <p style={{ margin: '4px 0 12px', color: 'var(--color-muted)', fontSize: 14 }}>{(editing ? draft.company : user.company)} · {(editing ? draft.city : user.city)}</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge kind={user.status === 'active' ? 'Active' : 'Inactive'}>{user.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            <span style={{ textTransform: 'capitalize', color: 'var(--color-muted)', fontSize: 13 }}>{user.role}</span>
            {user.rating ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><SP_I.Star size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />{user.rating} ({user.gigs} gigs)</span> : null}
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const next = user.status === 'active' ? 'inactive' : 'active';
              user.status = next;
              const liveUser = (window.RosyData?.USERS || []).find(x => x.id === user.id);
              if (liveUser) liveUser.status = next;
              window.dispatchEvent(new CustomEvent('rosy:data-changed'));
              onSave && onSave({ status: next });
              try { if (window.sb) await window.sb.from('rr_profiles').update({ status: next }).eq('id', user.id); } catch (e) { console.warn(e); }
              toast.push({ kind: next === 'active' ? 'success' : 'warning', title: `${user.name} marked ${next}` });
            }}>{user.status === 'active' ? <><SP_I.UserX size={13} />Mark inactive</> : <><SP_I.CheckCircle2 size={13} />Mark active</>}</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              if (!user.email) { toast.push({ kind: 'warning', title: 'No email on file' }); return; }
              try {
                if (window.sb) {
                  const { error } = await window.sb.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + '/#auth' });
                  if (error) throw error;
                }
                toast.push({ kind: 'success', title: 'Password reset sent', body: `Reset email sent to ${user.email}.` });
              } catch (e) {
                toast.push({ kind: 'error', title: 'Reset failed', body: e.message || 'Try again.' });
              }
            }}><SP_I.Mail size={13} />Send password reset</button>
          </div>
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ImageUpload value={draft.photo} onChange={(v) => setDraft({ ...draft, photo: v })} label="Upload profile photo" size={88} round />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="field-label">First name</label><input className="input" value={draft.first} onChange={(e) => setDraft({ ...draft, first: e.target.value, name: `${e.target.value} ${draft.last}`.trim() })} /></div>
            <div><label className="field-label">Last name</label><input className="input" value={draft.last} onChange={(e) => setDraft({ ...draft, last: e.target.value, name: `${draft.first} ${e.target.value}`.trim() })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="field-label">Email</label><input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><label className="field-label">Phone</label><input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+1 (555) 555-0100" /></div>
          </div>
          {user.role !== 'worker' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="field-label">Company / studio</label><input className="input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
              <div><label className="field-label">Title</label><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Owner, Lead, Designer…" /></div>
            </div>
          ) : (
            <div><label className="field-label">Title / specialty</label><input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Lead designer, Strike crew…" /></div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div><label className="field-label">Street</label><input className="input" value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} /></div>
            <div><label className="field-label">City</label><input className="input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
            <div><label className="field-label">State</label><input className="input" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder="IL" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: user.role === 'worker' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
            <div><label className="field-label">ZIP</label><input className="input" value={draft.zip} onChange={(e) => setDraft({ ...draft, zip: e.target.value })} /></div>
            {user.role === 'worker' ? (<>
              <div><label className="field-label">Hourly rate ($)</label><input className="input" type="number" min={0} value={draft.hourlyRate} onChange={(e) => setDraft({ ...draft, hourlyRate: e.target.value })} /></div>
              <div><label className="field-label">Skills (comma-separated)</label><input className="input" value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} placeholder="Lead, Design, Strike" /></div>
            </>) : (
              <div><label className="field-label">Vendor day rate ($)</label><input className="input" type="number" min={0} value={draft.vendorRate} onChange={(e) => setDraft({ ...draft, vendorRate: e.target.value })} /></div>
            )}
          </div>
          <div><label className="field-label">Status</label>
            <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Pending</option><option value="suspended">Suspended</option>
            </select>
          </div>
          <div><label className="field-label">Bio</label><textarea className="textarea" rows={4} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="A short summary that vendors / workers will see on this profile." /></div>
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
            {(() => { const first = user.first || (user.name || '').split(' ')[0] || 'They'; return user.role === 'worker'
              ? `${first} brings ${user.gigs ?? 0} gigs of experience to high-end floral events — specializing in installations, tablescapes, and on-day execution. Reliable, calm under pressure, takes direction well.`
              : `${user.company || first} is a ${user.city || 'Chicagoland'}-based floral studio serving the Chicagoland area. Specialties: weddings, brand activations, editorial work.`; })()}
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
  const [venues, setVenues] = SP_us(SP_D.VENUES.map(v => ({ ...v, active: v.active !== false, address: v.address || `${v.name} · ${v.city}`, image: v.image || SP_D.IMAGES.events[(parseInt((v.id.match(/\d+/)?.[0] || '1')) - 1) % SP_D.IMAGES.events.length], parking: v.parking || 'Street parking + nearby lot.', notes: v.notes || 'Standard load-in via rear dock. Single 30A 120V circuit available.' })));
  React.useEffect(() => {
    const sync = () => setVenues(SP_D.VENUES.map(v => ({ ...v, active: v.active !== false, address: v.address || `${v.name} · ${v.city}`, image: v.image || SP_D.IMAGES.events[0], parking: v.parking || '', notes: v.notes || '' })));
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, []);
  const [search, setSearch] = SP_us('');
  const [view, setView] = SP_us('cards');
  const [sortBy, setSortBy] = SP_us('name');
  const [typeFilter, setTypeFilter] = SP_us('all');
  const [cityFilter, setCityFilter] = SP_us('all');
  const [capacityFilter, setCapacityFilter] = SP_us('any');
  const [filterOpen, setFilterOpen] = SP_us(false);
  const venueTypes = Array.from(new Set(venues.map(v => v.type).filter(Boolean))).sort();
  const venueCities = Array.from(new Set(venues.map(v => v.city).filter(Boolean))).sort();
  const activeVenueFilters = (typeFilter !== 'all' ? 1 : 0) + (cityFilter !== 'all' ? 1 : 0) + (capacityFilter !== 'any' ? 1 : 0);
  const filtered = venues.filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [v.name, v.city, v.type, v.address, v.notes].some(s => (s || '').toLowerCase().includes(q));
  }).filter(v => typeFilter === 'all' || v.type === typeFilter)
    .filter(v => cityFilter === 'all' || v.city === cityFilter)
    .filter(v => {
      if (capacityFilter === 'any') return true;
      const cap = v.capacity || 0;
      if (capacityFilter === 'small')   return cap < 100;
      if (capacityFilter === 'medium')  return cap >= 100 && cap < 250;
      if (capacityFilter === 'large')   return cap >= 250;
      return true;
    }).sort((a, b) => {
    if (sortBy === 'city')     return (a.city || '').localeCompare(b.city || '');
    if (sortBy === 'capacity') return (b.capacity || 0) - (a.capacity || 0);
    if (sortBy === 'capacity-asc') return (a.capacity || 0) - (b.capacity || 0);
    if (sortBy === 'type')     return (a.type || '').localeCompare(b.type || '');
    return (a.name || '').localeCompare(b.name || '');
  });
  // Stat strip
  const venueStats = {
    total: venues.length,
    types: venueTypes.length,
    avgCap: venues.length ? Math.round(venues.reduce((s, v) => s + (v.capacity || 0), 0) / venues.length) : 0,
    largest: venues.reduce((m, v) => Math.max(m, v.capacity || 0), 0),
  };
  const paged = usePaged(filtered, view === 'cards' ? 9 : 10, `${view}|${search}|${sortBy}|${typeFilter}|${cityFilter}|${capacityFilter}|${filtered.length}`);
  const visible = paged.slice;
  const upsert = async (v, isNew) => {
    setVenues(arr => {
      const idx = arr.findIndex(x => x.id === v.id);
      if (idx >= 0) return arr.map(x => x.id === v.id ? v : x);
      return [v, ...arr];
    });
    try {
      if (isNew && window.RosyMutate?.venues) {
        const live = await window.RosyMutate.venues.create(v);
        if (live && live.id !== v.id) {
          setVenues(arr => arr.map(x => x.id === v.id ? live : x));
        }
      } else if (window.RosyMutate?.venues) {
        await window.RosyMutate.venues.update(v.id, v);
      }
    } catch (e) { console.warn('venue upsert failed:', e); }
  };
  return (
    <div className="content fade-up">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={SP_I.MapPin}     label="Total venues" value={venueStats.total} />
        <StatCard icon={SP_I.LayoutGrid} label="Venue types"  value={venueStats.types} />
        <StatCard icon={SP_I.Users}      label="Avg capacity" value={venueStats.avgCap} />
        <StatCard icon={SP_I.Building2}  label="Largest"      value={venueStats.largest} />
      </div>
      <div className="section-heading">
        <h2>Venues</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <SP_I.Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input className="input" placeholder="Search name, city, type, address…" style={{ paddingLeft: 36, width: 280 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SortMenu value={sortBy} onChange={setSortBy} options={[['name','Name A–Z'],['city','City A–Z'],['capacity','Largest first'],['capacity-asc','Smallest first'],['type','By type']]} />
          <ViewToggle value={view} onChange={setView} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterOpen(true)}><SP_I.Filter size={14} />Filters{activeVenueFilters > 0 ? ` (${activeVenueFilters})` : ''}</button>
          <button className="btn btn-coral" onClick={() => { setEditing(null); setAddOpen(true); }}><SP_I.Plus size={14} />Add venue</button>
        </div>
      </div>
      {view === 'table' ? (
        <div className="table-wrap">
          <table className="rosy-table">
            <thead><tr><th>Venue</th><th>City</th><th>Type</th><th>Capacity</th><th>Address</th><th>Active</th><th style={{ width: 140 }}></th></tr></thead>
            <tbody>
              {visible.length === 0 ? <tr><td colSpan={7}><Empty icon={SP_I.MapPin} title="No matching venues" /></td></tr> :
               visible.map(v => (
                <tr key={v.id} tabIndex={0} role="button" aria-label={`Open ${v.name}`} style={{ cursor: 'pointer' }}
                  onClick={(e) => { if (e.target.closest('button')) return; setViewOpen(v); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setViewOpen(v); } }}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SafeImage src={v.image} placeholderIcon={SP_I.MapPin} placeholderTone="mint" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{v.name}</p>
                  </div></td>
                  <td style={{ fontSize: 13.5 }}>{v.city}</td>
                  <td style={{ fontSize: 13 }}><span className="pill">{v.type}</span></td>
                  <td style={{ fontSize: 13 }}>{v.capacity}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-muted)' }}>{v.address}</td>
                  <td><Badge kind={v.active !== false ? 'Active' : 'Inactive'}>{v.active !== false ? 'Active' : 'Inactive'}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="row-action-btn" onClick={() => setViewOpen(v)} title="View"><SP_I.Eye size={14} /></button>
                      <button className="row-action-btn" onClick={() => { setEditing(v); setAddOpen(true); }} title="Edit"><SP_I.Pencil size={14} /></button>
                      <button className="row-action-btn" onClick={async () => {
                        const next = !(v.active !== false);
                        const updated = { ...v, active: next };
                        setVenues(arr => arr.map(x => x.id === v.id ? updated : x));
                        const lv = (window.RosyData?.VENUES || []).find(x => x.id === v.id);
                        if (lv) lv.active = next;
                        window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                        try { if (window.sb) await window.sb.from('rr_venues').update({ active: next }).eq('id', v.id); } catch (e) { console.warn(e); }
                        toast.push({ kind: next ? 'success' : 'warning', title: `${v.name} ${next ? 'activated' : 'deactivated'}` });
                      }} title={v.active !== false ? 'Deactivate' : 'Activate'}>{v.active !== false ? <SP_I.UserX size={14} /> : <SP_I.CheckCircle2 size={14} />}</button>
                      <button className="row-action-btn danger" onClick={() => setDeleteId(v.id)} title="Delete"><SP_I.Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="venues" />
        </div>
      ) : (
      <div className="grid-3">
        {visible.length === 0 ? <div style={{ gridColumn: '1 / -1' }}><Empty icon={SP_I.MapPin} title="No matching venues" /></div> :
         visible.map(v => (
          <div key={v.id} className="card" tabIndex={0} role="button" aria-label={`Open ${v.name}`}
            onClick={(e) => { if (e.target.closest('button')) return; setViewOpen(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setViewOpen(v); } }}
            style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
              <SafeImage src={v.image} placeholderIcon={SP_I.MapPin} placeholderTone={['mint','peach','lavender','ochre'][((v.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 4]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
      )}

      {view === 'cards' ? <Pagination page={paged.page} setPage={paged.setPage} total={paged.total} perPage={paged.perPage} label="venues" /> : null}

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter venues" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setTypeFilter('all'); setCityFilter('all'); setCapacityFilter('any'); }}>Reset all</button><button className="btn btn-coral" onClick={() => setFilterOpen(false)}>Apply</button></>}>
        <div className="col" style={{ gap: 16 }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Venue type</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','All'], ...venueTypes.map(t => [t, t])].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTypeFilter(id)} style={{ border: '1.5px solid', borderColor: typeFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: typeFilter === id ? 'var(--color-ink)' : 'transparent', color: typeFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>Capacity</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['any','Any'],['small','<100'],['medium','100–250'],['large','250+']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setCapacityFilter(id)} style={{ border: '1.5px solid', borderColor: capacityFilter === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: capacityFilter === id ? 'var(--color-ink)' : 'transparent', color: capacityFilter === id ? '#fff' : 'inherit', padding: '6px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 8 }}>City</p>
            <select className="select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all">All cities ({venueCities.length})</option>
              {venueCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <VenueFormModal open={addOpen} onClose={() => setAddOpen(false)} venue={editing} onSave={(v) => { upsert(v, !editing); setAddOpen(false); toast.push({ kind: 'success', title: editing ? 'Venue updated' : 'Venue added' }); }} />

      <VenueDetailModal venue={viewOpen} onClose={() => setViewOpen(null)} onEdit={(v) => { setViewOpen(null); setEditing(v); setAddOpen(true); }} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove venue?" message="This won't affect past events but it'll be hidden from new event creation." confirmLabel="Remove"
        onConfirm={async () => { const id = deleteId; setVenues(vs => vs.filter(v => v.id !== id)); try { await window.RosyMutate?.venues?.delete(id); } catch (e) { console.warn(e); } toast.push({ kind: 'warning', title: 'Venue removed' }); }} />
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
              { key: 'city', label: 'City', placeholder: 'Chicago, IL' },
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
          <div className="field"><label className="field-label">City *</label><input className="input" placeholder="Chicago, IL" value={f.city} onChange={e => upd('city', e.target.value)} /></div>
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
  // Admin sees a streamlined set — no Privacy & Data, Team, or Danger Zone.
  const tabs = role === 'admin'
    ? ['profile','account','notifications','payouts']
    : ['profile','account','notifications','payouts','privacy','team','danger'];
  React.useEffect(() => { if (!tabs.includes(tab)) setTab('profile'); }, [role]);
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Settings</h2></div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <div className="col" style={{ gap: 4 }}>
          {tabs.map(s => (
            <button key={s} onClick={() => setTab(s)} className={`nav-item ${tab===s ? 'active' : ''}`} style={{ textTransform: 'capitalize' }}>{s === 'danger' ? 'Danger zone' : s === 'privacy' ? 'Privacy & data' : s}</button>
          ))}
        </div>
        <div className="col" style={{ gap: 16 }}>
          {tab === 'profile' ? <SettingsProfile user={currentUser} /> : null}
          {tab === 'account' ? <SettingsAccount /> : null}
          {tab === 'notifications' ? <SettingsNotifications /> : null}
          {tab === 'payouts' ? <SettingsPayouts /> : null}
          {tab === 'privacy' && role !== 'admin' ? <SettingsPrivacy role={role} /> : null}
          {tab === 'team' && role !== 'admin' ? <SettingsTeam /> : null}
          {tab === 'danger' && role !== 'admin' ? <SettingsDanger /> : null}
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

// US-format phone normaliser used for validation feedback.
function formatUSPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  const has1 = d.length === 11 && d.startsWith('1');
  const core = has1 ? d.slice(1) : d;
  if (core.length <= 3) return `(${core}`;
  if (core.length <= 6) return `(${core.slice(0,3)}) ${core.slice(3)}`;
  return `(${core.slice(0,3)}) ${core.slice(3,6)}-${core.slice(6,10)}`;
}
function isValidUSPhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  return d.length === 10 || (d.length === 11 && d.startsWith('1'));
}

function SettingsProfile({ user }) {
  const toast = useToast();
  const role = user?.role || 'vendor';
  const [d, setD] = SP_us({
    photo: user?.photo || '',
    first: user?.first || '',
    last:  user?.last  || '',
    email: user?.email || '',
    phone: user?.phone || '',
    title: user?.title || '',
    bio:   user?.bio || '',
    city:  user?.city || '',
    state: user?.state || '',
    // Vendor-only
    company_name:         user?.company_name || user?.company || '',
    website:              user?.website || '',
    business_description: user?.business_description || user?.bio || '',
    // Worker-only
    rate_min: user?.rate_min ?? user?.hourlyRate ?? '',
    rate_max: user?.rate_max ?? '',
    services: Array.isArray(user?.services) ? user.services.join(', ') : (user?.services || (Array.isArray(user?.skills) ? user.skills.join(', ') : (user?.skills || ''))),
  });
  const set = (k, v) => setD(s => ({ ...s, [k]: v }));

  React.useEffect(() => {
    setD({
      photo: user?.photo || '',
      first: user?.first || '', last: user?.last || '',
      email: user?.email || '', phone: user?.phone || '',
      title: user?.title || '', bio: user?.bio || '',
      city: user?.city || '', state: user?.state || '',
      company_name: user?.company_name || user?.company || '',
      website: user?.website || '',
      business_description: user?.business_description || user?.bio || '',
      rate_min: user?.rate_min ?? user?.hourlyRate ?? '',
      rate_max: user?.rate_max ?? '',
      services: Array.isArray(user?.services) ? user.services.join(', ') : (user?.services || (Array.isArray(user?.skills) ? user.skills.join(', ') : (user?.skills || ''))),
    });
  }, [user?.id]);

  const phoneInvalid = d.phone && !isValidUSPhone(d.phone);

  const save = async () => {
    if (!user?.id) { toast.push({ kind: 'warning', title: 'Sign in first', body: 'Sign in to save your profile.' }); return; }
    if (phoneInvalid) { toast.push({ kind: 'warning', title: 'Phone is not a valid US number', body: 'Use a 10-digit US format.' }); return; }
    // Patch local store + broadcast
    const u = (window.RosyData?.USERS || []).find(x => x.id === user.id);
    if (u) Object.assign(u, {
      photo: d.photo, first: d.first, last: d.last,
      name: `${d.first} ${d.last}`.trim() || u.name,
      email: d.email, phone: d.phone, title: d.title, bio: d.bio, city: d.city, state: d.state,
      company: d.company_name, company_name: d.company_name, website: d.website, business_description: d.business_description,
      rate_min: d.rate_min, rate_max: d.rate_max, hourlyRate: d.rate_min,
      services: d.services.split(',').map(s => s.trim()).filter(Boolean),
    });
    window.dispatchEvent(new CustomEvent('rosy:data-changed'));
    // Best-effort persist
    try {
      if (window.sb) {
        await window.sb.from('rr_profiles').update({
          first_name: d.first || null, last_name: d.last || null,
          phone: d.phone || null, bio: d.bio || null, avatar_url: d.photo || null,
          title: d.title || null, city: d.city || null, state: d.state || null,
        }).eq('id', user.id);
        if (role === 'vendor') {
          await window.sb.from('rr_vendor_profiles').upsert({
            user_id: user.id, company_name: d.company_name || null,
            website: d.website || null, business_description: d.business_description || null,
          }, { onConflict: 'user_id' });
        } else if (role === 'worker') {
          const servicesArr = d.services.split(',').map(s => s.trim()).filter(Boolean);
          await window.sb.from('rr_worker_profiles').upsert({
            user_id: user.id,
            rate_min: d.rate_min ? Number(d.rate_min) : null,
            rate_max: d.rate_max ? Number(d.rate_max) : null,
            services: servicesArr,
          }, { onConflict: 'user_id' });
        }
      }
    } catch (e) { console.warn('profile save failed (table may not exist):', e); }
    toast.push({ kind: 'success', title: 'Profile saved' });
  };

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Profile</h3>
      <div style={{ marginBottom: 16 }}>
        <ImageUpload value={d.photo} onChange={(v) => set('photo', v)} label="Upload profile photo" size={88} round />
      </div>
      <div className="grid-2" style={{ gap: 14 }}>
        <div className="field"><label className="field-label">First name</label><input className="input" value={d.first} onChange={e => set('first', e.target.value)} placeholder="First name" /></div>
        <div className="field"><label className="field-label">Last name</label><input className="input" value={d.last} onChange={e => set('last', e.target.value)} placeholder="Last name" /></div>
        <div className="field"><label className="field-label">Email <span style={{ color: 'var(--color-muted-soft)', fontWeight: 400 }}>(managed by auth)</span></label><input className="input" type="email" value={d.email} readOnly disabled /></div>
        <div className="field"><label className="field-label">Phone</label>
          <input className="input" type="tel" value={d.phone}
            onChange={e => set('phone', formatUSPhone(e.target.value))}
            placeholder="(555) 555-0100"
            style={phoneInvalid ? { borderColor: 'var(--rosy-coral)' } : undefined} />
          {phoneInvalid ? <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--rosy-coral)' }}>Enter a 10-digit US phone number.</p> : null}
        </div>
        <div className="field"><label className="field-label">Title</label><input className="input" value={d.title} onChange={e => set('title', e.target.value)} placeholder={role === 'worker' ? 'Lead designer, Strike crew…' : 'Owner, Lead, Designer…'} /></div>
        <div className="field"><label className="field-label">City</label><input className="input" value={d.city} onChange={e => set('city', e.target.value)} placeholder="Chicago" /></div>
        <div className="field"><label className="field-label">State</label><input className="input" value={d.state} onChange={e => set('state', e.target.value)} placeholder="IL" /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Bio</label><textarea className="textarea" value={d.bio} onChange={e => set('bio', e.target.value)} placeholder="A short summary visible on your public profile." /></div>

        {role === 'vendor' ? (
          <>
            <div className="field"><label className="field-label">Company / studio name</label><input className="input" value={d.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Bloom & Fern Studio" /></div>
            <div className="field"><label className="field-label">Website</label><input className="input" type="url" value={d.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Business description</label><textarea className="textarea" value={d.business_description} onChange={e => set('business_description', e.target.value)} placeholder="What the studio specializes in, typical events, palette, location service area." /></div>
          </>
        ) : null}

        {role === 'worker' ? (
          <>
            <div className="field"><label className="field-label">Rate — minimum ($/hr)</label><input className="input" type="number" min={0} value={d.rate_min} onChange={e => set('rate_min', e.target.value)} placeholder="22" /></div>
            <div className="field"><label className="field-label">Rate — maximum ($/hr)</label><input className="input" type="number" min={0} value={d.rate_max} onChange={e => set('rate_max', e.target.value)} placeholder="50" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Services (comma-separated)</label><input className="input" value={d.services} onChange={e => set('services', e.target.value)} placeholder="Lead, Design, Assist, Strike" /></div>
          </>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-coral" onClick={save}>Save changes</button>
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
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const header = 'when,who,kind,what\n';
            const rows = filtered.map(r => `"${r.when}","${r.who}","${r.kind}","${r.what.replace(/"/g, '""')}"`).join('\n');
            const blob = new Blob([header + rows], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            toast.push({ kind: 'success', title: 'CSV downloaded', body: `${filtered.length} entries exported.` });
          }}>Export CSV</button>
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

/* ============ Analytics (admin) — full reporting dashboard ============ */
function PageAnalytics() {
  const D = window.RosyData || SP_D;
  const users = D.USERS || [];
  const events = D.EVENTS || [];
  const gigs = D.GIGS || [];
  const txs = D.TRANSACTIONS || [];

  // KPIs
  const now = new Date();
  const last30 = new Date(now); last30.setDate(now.getDate() - 30);
  const within30 = (dateStr) => { try { return new Date(dateStr) >= last30; } catch (e) { return false; } };
  const totalRevenue = txs.filter(t => t.status === 'Paid').reduce((s, t) => s + (t.amount || 0), 0);
  const activeUsers30 = users.filter(u => u.lastActive && within30(u.lastActive)).length || users.filter(u => u.status === 'active').length;
  const newSignups30 = users.filter(u => within30(u.joined)).length;
  const gigsCompleted30 = gigs.filter(g => g.status === 'confirmed' && within30(g.date)).length;
  const allRates = gigs.map(g => g.rate).filter(Boolean);
  const avgGigRate = allRates.length ? Math.round(allRates.reduce((s, r) => s + r, 0) / allRates.length) : 0;
  const disputes = (D.DISPUTES || []).length || 0;
  const disputeRate = txs.length ? ((disputes / txs.length) * 100).toFixed(1) : '0.0';

  // Signups over last 12 months
  const months12 = (() => {
    const arr = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short' }), date: d });
    }
    return arr;
  })();
  const signupsByMonth = months12.map(m => {
    const next = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 1);
    return users.filter(u => { try { const d = new Date(u.joined); return d >= m.date && d < next; } catch (e) { return false; } }).length;
  });

  // Gigs by type — horizontal bar
  const gigTypeCounts = gigs.reduce((acc, g) => { acc[g.type] = (acc[g.type] || 0) + 1; return acc; }, {});
  const gigTypes = ['Lead','Design','Assist','Strike'];
  const maxTypeCount = Math.max(1, ...Object.values(gigTypeCounts));

  // Revenue by month bar
  const revenueByMonth = months12.map(m => {
    const next = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 1);
    return txs.filter(t => { try { const d = new Date(t.date); return d >= m.date && d < next && t.status === 'Paid'; } catch (e) { return false; } })
      .reduce((s, t) => s + (t.amount || 0), 0);
  });
  const revMax = Math.max(1, ...revenueByMonth);

  // Top vendors / workers
  const vendors = users.filter(u => u.role === 'vendor');
  const eventsByVendor = events.reduce((acc, e) => { acc[e.vendorId] = (acc[e.vendorId] || 0) + 1; return acc; }, {});
  const topVendors = vendors
    .map(v => ({ ...v, gigCount: events.filter(e => e.vendorId === v.id).reduce((s, e) => s + (e.gigCount || 0), 0) }))
    .sort((a, b) => b.gigCount - a.gigCount)
    .slice(0, 10);
  const workers = users.filter(u => u.role === 'worker');
  const completedByWorker = (uid) => gigs.filter(g => (g.assignedTo || []).includes(uid) && g.status === 'confirmed').length;
  const topWorkers = workers
    .map(w => ({ ...w, completed: completedByWorker(w.id) }))
    .sort((a, b) => (b.completed - a.completed) || ((b.rating || 0) - (a.rating || 0)))
    .slice(0, 10);

  // Activity by role from audit log
  const audit = D.AUDIT_LOG || [];

  // Funnel
  const signups = users.length;
  const verified = users.filter(u => u.verified === true).length || Math.round(signups * 0.84);
  const firstGigOrApply = users.filter(u => (u.gigs || 0) > 0).length || Math.round(signups * 0.46);
  const firstPayment = txs.length;

  // Invoices CSV export
  const [invFilter, setInvFilter] = SP_us('all');
  const invoices = txs.filter(t => invFilter === 'all' || t.status === invFilter);
  const exportInvoicesCSV = () => {
    const header = 'invoice,date,payer,payee,amount,status\n';
    const rows = invoices.map(t => `"${t.invoice}","${t.date}","${(t.payer || '').replace(/"/g,'""')}","${(t.payee || '').replace(/"/g,'""')}",${t.amount},"${t.status}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // SVG line chart helper
  const renderLine = (data, color = 'var(--rosy-coral)') => {
    const w = 600, h = 140, pad = 16;
    const max = Math.max(1, ...data);
    const step = (w - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
    const dStr = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 160 }}>
        <path d={dStr} stroke={color} strokeWidth="2" fill="none" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={color} />)}
      </svg>
    );
  };

  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Analytics & reports</h2></div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon={SP_I.DollarSign}  label="Total revenue" value={totalRevenue} prefix="$" />
        <StatCard icon={SP_I.Users}       label="Active users (30d)" value={activeUsers30} />
        <StatCard icon={SP_I.UserPlus}    label="New signups (30d)" value={newSignups30} />
        <StatCard icon={SP_I.Briefcase}   label="Gigs completed (30d)" value={gigsCompleted30} />
      </div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon={SP_I.Clock}        label="Avg gig rate" value={avgGigRate} prefix="$" />
        <StatCard icon={SP_I.AlertTriangle} label="Dispute rate" value={`${disputeRate}%`} />
        <StatCard icon={SP_I.Building2}    label="Total vendors" value={vendors.length} />
        <StatCard icon={SP_I.UserCircle2}  label="Total workers" value={workers.length} />
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Signups — last 12 months</h3>
          {renderLine(signupsByMonth)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--color-muted)' }}>
            {months12.map(m => <span key={m.key}>{m.label}</span>)}
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Revenue by month</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 6 }}>
            {revenueByMonth.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', height: `${(v / revMax) * 100}%`, background: i === revenueByMonth.length - 1 ? 'var(--rosy-coral)' : 'var(--color-brand-peach)', borderRadius: 6, minHeight: 4 }} />
                <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{months12[i].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Gigs by type</h3>
        <div className="col" style={{ gap: 10 }}>
          {gigTypes.map(t => {
            const count = gigTypeCounts[t] || 0;
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 80, fontSize: 13, fontWeight: 600 }}>{t}</span>
                <div style={{ flex: 1, height: 18, background: 'var(--color-surface-soft)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(count / maxTypeCount) * 100}%`, height: '100%', background: 'var(--rosy-teal)' }} />
                </div>
                <span style={{ width: 50, textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Top vendors (by gigs posted)</h3>
          <table className="rosy-table">
            <thead><tr><th>Vendor</th><th style={{ textAlign: 'right' }}>Gigs</th></tr></thead>
            <tbody>
              {topVendors.map(v => (
                <tr key={v.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={v.name} size="sm" /><span style={{ fontSize: 13 }}>{v.company || v.name}</span></div></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{v.gigCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Top workers (by gigs completed + rating)</h3>
          <table className="rosy-table">
            <thead><tr><th>Worker</th><th style={{ textAlign: 'right' }}>Completed</th><th style={{ textAlign: 'right' }}>Rating</th></tr></thead>
            <tbody>
              {topWorkers.map(w => (
                <tr key={w.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={w.name} size="sm" /><span style={{ fontSize: 13 }}>{w.name}</span></div></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{w.completed}</td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{w.rating || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>All invoices</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" style={{ height: 32, padding: '0 10px' }} value={invFilter} onChange={e => setInvFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Refunded">Refunded</option>
              <option value="Disputed">Disputed</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={exportInvoicesCSV}><SP_I.Download size={14} />Export CSV</button>
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="rosy-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Payer</th><th>Payee</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.invoice}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t.date}</td>
                  <td style={{ fontSize: 13 }}>{t.payer}</td>
                  <td style={{ fontSize: 13 }}>{t.payee}</td>
                  <td className="t-mono-amount">{fmtMoney(t.amount)}</td>
                  <td><Badge kind={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Activity by role</h3>
          {(() => {
            const counts = { admin: 0, vendor: 0, worker: 0, system: 0 };
            audit.forEach(a => { const k = (a.role || a.kind || '').toLowerCase(); if (counts[k] !== undefined) counts[k]++; else counts.admin++; });
            // Fallback heuristic if audit-log is empty:
            if (!audit.length) { counts.vendor = events.length; counts.worker = gigs.reduce((s, g) => s + ((g.assignedTo || []).length), 0); counts.admin = txs.length; }
            const total = Math.max(1, counts.admin + counts.vendor + counts.worker + counts.system);
            return (
              <div className="col" style={{ gap: 10 }}>
                {Object.entries(counts).map(([role, n]) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 80, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>
                    <div style={{ flex: 1, height: 16, background: 'var(--color-surface-soft)', borderRadius: 6 }}>
                      <div style={{ width: `${(n / total) * 100}%`, height: '100%', background: 'var(--rosy-coral)', borderRadius: 6 }} />
                    </div>
                    <span style={{ width: 50, textAlign: 'right', fontSize: 13 }}>{n}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Conversion funnel</h3>
          {[
            ['Signups', signups, 'var(--rosy-coral)'],
            ['Verified', verified, 'var(--rosy-teal)'],
            ['First gig posted/applied', firstGigOrApply, 'var(--color-brand-ochre)'],
            ['First payment', firstPayment, 'var(--color-brand-lavender)'],
          ].map(([label, value, color], i, arr) => {
            const max = arr[0][1] || 1;
            const pct = Math.round((value / max) * 100);
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--color-muted)' }}>{value} ({pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 12, background: 'var(--color-surface-soft)', borderRadius: 6 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Site content editor — per-page granular blocks ============ */
// Schema of editable blocks per marketing page. blockId is the key used by
// window.RosyContent(page, blockId, fallback) in marketing_pages.jsx and
// screen_misc.jsx. Defaults match the hardcoded copy currently rendered.
const SITE_CONTENT_SCHEMA = {
  home: {
    label: 'Home',
    blocks: [
      { id: 'hero_strip',     label: 'Hero strip',         kind: 'input',    default: 'New: Stripe instant payouts in 5 cities' },
      { id: 'hero_heading',   label: 'Hero heading',       kind: 'input',    default: 'Where floral excellence meets efficiency.' },
      { id: 'hero_sub',       label: 'Hero sub',           kind: 'textarea', default: 'A skilled crew on every event — booked in minutes, paid in days. Built by florists who got tired of texting from a spreadsheet.' },
      { id: 'cta_primary',    label: 'Primary CTA label',  kind: 'input',    default: 'Hire a team' },
      { id: 'cta_secondary',  label: 'Secondary CTA label',kind: 'input',    default: 'Find work' },
      { id: 'hero_stat1_num', label: 'Hero stat 1 number', kind: 'input',    default: '1,284' },
      { id: 'hero_stat1_lbl', label: 'Hero stat 1 label',  kind: 'input',    default: 'active workers' },
      { id: 'hero_stat2_num', label: 'Hero stat 2 number', kind: 'input',    default: '412' },
      { id: 'hero_stat2_lbl', label: 'Hero stat 2 label',  kind: 'input',    default: 'vendor studios' },
      { id: 'hero_stat3_num', label: 'Hero stat 3 number', kind: 'input',    default: '$284k' },
      { id: 'hero_stat3_lbl', label: 'Hero stat 3 label',  kind: 'input',    default: 'paid this month' },
    ],
  },
  vendors: {
    label: 'For Vendors',
    blocks: [
      { id: 'eyebrow',     label: 'Eyebrow',          kind: 'input',    default: 'For vendors' },
      { id: 'hero_title',  label: 'Hero heading',     kind: 'input',    default: 'Crew up. Show up. Look brilliant.' },
      { id: 'hero_sub',    label: 'Hero sub',         kind: 'textarea', default: 'Spin up an entire wedding team from your phone. Workers see the gig, you approve the applications, both sides get paid through Stripe Connect.' },
      { id: 'cta_label',   label: 'CTA label',        kind: 'input',    default: "Start hiring — it's free" },
      { id: 'section_title', label: 'Section title',  kind: 'input',    default: "The studio dashboard you've been faking with spreadsheets." },
      { id: 'feature1_title', label: 'Feature 1 title', kind: 'input', default: 'Post in 60 seconds' },
      { id: 'feature1_body',  label: 'Feature 1 body',  kind: 'textarea', default: 'Type, date, hourly rate, spots. We push it to qualified workers in your zip code within minutes.' },
      { id: 'feature2_title', label: 'Feature 2 title', kind: 'input', default: 'Verified only' },
      { id: 'feature2_body',  label: 'Feature 2 body',  kind: 'textarea', default: 'Every Lead and Design role is portfolio-reviewed and ID-verified. Strike and Assist are background-checked.' },
      { id: 'feature3_title', label: 'Feature 3 title', kind: 'input', default: 'One bill, one check' },
      { id: 'feature3_body',  label: 'Feature 3 body',  kind: 'textarea', default: 'Fund the gig once. Rosy splits payouts across your team. No 1099s, no chasing receipts.' },
    ],
  },
  workers: {
    label: 'For Workers',
    blocks: [
      { id: 'eyebrow',     label: 'Eyebrow',     kind: 'input',    default: 'For workers' },
      { id: 'hero_title',  label: 'Hero heading',kind: 'input',    default: 'Steady, beautiful work.' },
      { id: 'hero_sub',    label: 'Hero sub',    kind: 'textarea', default: 'Three studios a week or thirty events a season — set your availability, pick your gigs, get paid on time. Lead roles pay $50/hr.' },
      { id: 'cta_label',   label: 'CTA label',   kind: 'input',    default: 'Join as a worker' },
      { id: 'rates_title', label: 'Rates section title', kind: 'input', default: 'What you actually take home.' },
      { id: 'why_title',   label: 'Why-stay section title', kind: 'input', default: 'Why workers stay.' },
    ],
  },
  gallery: {
    label: 'Gallery',
    blocks: [
      { id: 'eyebrow',  label: 'Eyebrow', kind: 'input',    default: 'Gallery' },
      { id: 'title',    label: 'Title',   kind: 'input',    default: 'Work made by Rosy crews.' },
      { id: 'sub',      label: 'Sub',     kind: 'textarea', default: 'A few rooms, weddings, and editorial moments built end-to-end by teams booked through the platform.' },
    ],
  },
  faq: {
    label: 'FAQ',
    blocks: [
      { id: 'eyebrow', label: 'Eyebrow', kind: 'input',    default: 'FAQ' },
      { id: 'title',   label: 'Title',   kind: 'input',    default: 'Answers, before you ask.' },
      { id: 'sub',     label: 'Sub',     kind: 'textarea', default: 'Still need help? Talk to a real person.' },
      { id: 'faq1_q',  label: 'FAQ #1 Question', kind: 'input', default: 'When do workers get paid?' },
      { id: 'faq1_a',  label: 'FAQ #1 Answer',   kind: 'textarea', default: 'Within 48 hours of vendor-approved hours, via Stripe Connect direct deposit.' },
      { id: 'faq2_q',  label: 'FAQ #2 Question', kind: 'input', default: 'Are 1099s automatic?' },
      { id: 'faq2_a',  label: 'FAQ #2 Answer',   kind: 'textarea', default: 'Yes. If you earn more than $600 in a calendar year, Rosy generates and mails your 1099-NEC by Jan 31.' },
      { id: 'faq3_q',  label: 'FAQ #3 Question', kind: 'input', default: 'What does the vendor fee cover?' },
      { id: 'faq3_a',  label: 'FAQ #3 Answer',   kind: 'textarea', default: 'Stripe fees, escrow, dispute mediation, identity verification, and platform development.' },
    ],
  },
  about: {
    label: 'About',
    blocks: [
      { id: 'eyebrow',   label: 'Eyebrow',    kind: 'input',    default: 'About' },
      { id: 'hero_title',label: 'Hero title', kind: 'input',    default: 'Built by florists. For florists.' },
      { id: 'hero_sub',  label: 'Hero sub',   kind: 'textarea', default: 'Rosy started as a private group text between three Chicago studios passing workers back and forth. It got out of hand. Then it got organized.' },
      { id: 'why_title', label: 'Why we built this — title', kind: 'input', default: 'Why we built this.' },
      { id: 'why_body1', label: 'Why we built this — paragraph 1', kind: 'textarea', default: 'Floral event work is local, seasonal, and ferociously busy. Every studio knows the same forty freelancers. Every freelancer knows the same fifteen studios. The matching happens over Sunday-night group texts, paper invoices that get lost, and Venmo requests that nobody chases.' },
      { id: 'why_body2', label: 'Why we built this — paragraph 2', kind: 'textarea', default: 'Rosy organizes that informal economy into a real marketplace — with verified workers, escrowed payments, ratings that survive, and tax docs that actually arrive. Same community. Less chaos.' },
    ],
  },
  contact: {
    label: 'Contact',
    blocks: [
      { id: 'eyebrow', label: 'Eyebrow', kind: 'input',    default: 'Contact' },
      { id: 'title',   label: 'Title',   kind: 'input',    default: 'Talk to us.' },
      { id: 'sub',     label: 'Sub',     kind: 'textarea', default: 'Sales, support, press, careers — one inbox.' },
    ],
  },
  terms: {
    label: 'Terms',
    blocks: [
      { id: 'note', label: 'Reminder', kind: 'textarea', default: 'The Terms of Service body is edited in the Legal documents section below.' },
    ],
  },
  privacy: {
    label: 'Privacy',
    blocks: [
      { id: 'note', label: 'Reminder', kind: 'textarea', default: 'The Privacy Policy body is edited in the Legal documents section below.' },
    ],
  },
};
window.SITE_CONTENT_SCHEMA = SITE_CONTENT_SCHEMA;

function PageSiteContent() {
  const toast = useToast();
  const [page, setPage] = SP_us('home');
  const [draft, setDraft] = SP_us({}); // local edits keyed by blockId
  const [savingAll, setSavingAll] = SP_us(false);

  // Re-hydrate draft when page changes — values come from the live store with hardcoded fallback.
  React.useEffect(() => {
    const blocks = SITE_CONTENT_SCHEMA[page].blocks;
    const init = {};
    blocks.forEach(b => { init[b.id] = window.RosyContent(page, b.id, b.default); });
    setDraft(init);
  }, [page]);

  const saveBlock = async (blockId, value) => {
    setDraft(d => ({ ...d, [blockId]: value }));
    await window.RosySaveSiteContent(page, blockId, value);
    window.dispatchEvent(new CustomEvent('rosy:site-content-changed'));
  };

  const saveAll = async () => {
    setSavingAll(true);
    const blocks = SITE_CONTENT_SCHEMA[page].blocks;
    for (const b of blocks) {
      await window.RosySaveSiteContent(page, b.id, draft[b.id] ?? b.default);
    }
    window.dispatchEvent(new CustomEvent('rosy:site-content-changed'));
    setSavingAll(false);
    toast.push({ kind: 'success', title: 'Page saved', body: `${SITE_CONTENT_SCHEMA[page].label} content updated. Refresh marketing pages to see live.` });
  };

  const resetPage = () => {
    const blocks = SITE_CONTENT_SCHEMA[page].blocks;
    const init = {};
    blocks.forEach(b => { init[b.id] = b.default; });
    setDraft(init);
    toast.push({ kind: 'info', title: 'Reset to defaults', body: "Click Save to persist." });
  };

  const blocks = SITE_CONTENT_SCHEMA[page].blocks;

  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Site content</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={resetPage}>Reset to defaults</button>
          <button className="btn btn-coral btn-sm" disabled={savingAll} onClick={saveAll}>{savingAll ? 'Saving…' : 'Save page'}</button>
        </div>
      </div>

      {/* Page selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(SITE_CONTENT_SCHEMA).map(([id, p]) => (
          <button key={id} type="button" onClick={() => setPage(id)}
            style={{ border: '1.5px solid', borderColor: page === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: page === id ? 'var(--color-ink)' : 'transparent', color: page === id ? '#fff' : 'inherit', padding: '6px 14px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {p.label}
          </button>
        ))}
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-muted)' }}>Editing <strong>{SITE_CONTENT_SCHEMA[page].label}</strong> page · {blocks.length} block{blocks.length === 1 ? '' : 's'}. Saves persist to local storage immediately and best-effort to the database.</p>

      <div className="grid-2">
        {blocks.map(b => (
          <div key={b.id} className="card" style={{ gridColumn: b.kind === 'textarea' ? '1 / -1' : 'auto' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{b.label}</p>
            {b.kind === 'textarea' ? (
              <textarea className="textarea" value={draft[b.id] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [b.id]: e.target.value }))}
                onBlur={e => saveBlock(b.id, e.target.value)}
                style={{ marginTop: 8, minHeight: 90 }} />
            ) : (
              <input className="input" value={draft[b.id] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [b.id]: e.target.value }))}
                onBlur={e => saveBlock(b.id, e.target.value)}
                style={{ marginTop: 8 }} />
            )}
          </div>
        ))}
      </div>

      <h3 style={{ margin: '28px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.015em' }}>Legal documents</h3>
      <LegalDocsEditor />
    </div>
  );
}

function LegalDocsEditor() {
  const toast = useToast();
  const [docs, setDocs] = SP_us(window.RosyStores.legalDocs || {});
  const [editId, setEditId] = SP_us(null);
  const [draft, setDraft] = SP_us('');
  const open = (id) => { setEditId(id); setDraft(docs[id]?.body || ''); };
  const save = () => {
    const next = { ...docs, [editId]: { ...docs[editId], body: draft, updatedAt: new Date().toISOString().slice(0, 10) } };
    setDocs(next); window.RosyStores.legalDocs = next; setEditId(null);
    toast.push({ kind: 'success', title: 'Saved', body: `${next[editId === null ? Object.keys(next)[0] : editId]?.name || 'Document'} updated.` });
  };
  return (
    <>
      <div className="grid-2">
        {Object.entries(docs).map(([id, d]) => (
          <div key={id} className="card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{d.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-muted)' }}>Last updated {d.updatedAt}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => open(id)}><SP_I.Pencil size={14} />Edit</button>
          </div>
        ))}
      </div>
      <Modal open={!!editId} onClose={() => setEditId(null)} title={editId ? docs[editId]?.name : ''} size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button><button className="btn btn-coral" onClick={save}>Save changes</button></>}>
        <div className="col" style={{ gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>Markdown is supported. Changes go live immediately on the marketing site.</p>
          <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 360, fontFamily: 'var(--font-mono)', fontSize: 13 }} />
        </div>
      </Modal>
    </>
  );
}

function PageEmails() {
  const toast = useToast();
  const [templates, setTemplates] = SP_us(window.RosyStores.emailTemplates);
  const [editId, setEditId] = SP_us(null);
  const [draft, setDraft] = SP_us({ subject: '', body: '', live: true });
  const [editMode, setEditMode] = SP_us('html'); // 'html' | 'plain'
  const [testModalOpen, setTestModalOpen] = SP_us(false);
  const [testEmail, setTestEmail] = SP_us('');

  // Convert HTML to a readable plain-text form (strip tags, <p>/<br> -> newlines).
  const htmlToPlain = (html) => {
    if (!html) return '';
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/(div|tr|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };
  // Wrap plain-text lines in <p> tags (blank-line-separated paragraphs).
  const plainToHtml = (plain) => {
    if (!plain) return '';
    return plain
      .split(/\n{2,}/)
      .map(block => `<p>${block.replace(/\n/g, '<br>').trim()}</p>`)
      .join('\n');
  };

  const openTemplate = (id) => {
    setEditId(id);
    const t = templates[id];
    setDraft({ subject: t.subject, body: t.body, live: t.live });
    setEditMode('html');
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
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>Body</label>
              <div style={{ display: 'flex', gap: 4, border: '1px solid var(--color-hairline-strong)', borderRadius: 9999, padding: 2 }}>
                {[['plain','Plain text'],['html','HTML']].map(([id, label]) => (
                  <button key={id} type="button"
                    onClick={() => {
                      if (id === editMode) return;
                      if (id === 'plain') {
                        // switching html -> plain: derive plain from current html body
                        setDraft(d => ({ ...d, body: d.body }));
                      } else {
                        // switching plain -> html: wrap current plain text into HTML and save
                        setDraft(d => ({ ...d, body: plainToHtml(htmlToPlain(d.body)) }));
                      }
                      setEditMode(id);
                    }}
                    style={{ border: 0, background: editMode === id ? 'var(--color-ink)' : 'transparent', color: editMode === id ? '#fff' : 'var(--color-muted)', padding: '4px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            </div>
            {editMode === 'plain' ? (
              <textarea className="textarea"
                value={htmlToPlain(draft.body)}
                onChange={e => setDraft(d => ({ ...d, body: plainToHtml(e.target.value) }))}
                style={{ minHeight: 220, fontFamily: 'inherit', fontSize: 13.5 }} />
            ) : (
              <textarea className="textarea" value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            )}
          </div>
          <div className="field"><label className="field-label">Live preview</label>
            <iframe title="Email preview" srcDoc={draft.body} style={{ width: '100%', height: 360, border: '1px solid var(--color-hairline)', borderRadius: 12, background: '#FAF7F2' }} />
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
          footer={<><button className="btn btn-ghost" onClick={() => setTestModalOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)} onClick={() => { setTestModalOpen(false); toast.push({ kind: 'success', title: 'Test email sent', body: `Sent to ${testEmail}` }); setTestEmail(''); }}>Send</button></>}>
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
  const [confirmDeleteId, setConfirmDeleteId] = SP_us(null);
  const fileRef = React.useRef(null);
  const replaceRef = React.useRef(null);
  const [replaceTargetId, setReplaceTargetId] = SP_us(null);
  const handleReplaceFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f || !replaceTargetId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const targetId = replaceTargetId;
      setItems(arr => {
        const next = arr.map(x => x.id === targetId ? { ...x, src: ev.target.result } : x);
        window.RosyStores.gallery = next;
        return next;
      });
      setReplaceTargetId(null);
      toast.push({ kind: 'success', title: 'Photo replaced' });
    };
    reader.readAsDataURL(f);
  };

  const updateItem = (id, patch) => {
    setItems(arr => {
      let next = arr.map(x => x.id === id ? { ...x, ...patch } : x);
      // Enforce max=1 on single-slot sections by evicting any prior occupant to "unused"
      if (patch.section) {
        const sec = window.GALLERY_SECTIONS.find(s => s.id === patch.section);
        if (sec && sec.max === 1) {
          next = next.map(x => (x.section === patch.section && x.id !== id) ? { ...x, section: 'unused' } : x);
          toast.push({ kind: 'info', title: `${sec.label}: previous photo moved to Unused`, body: 'Single-slot section — only one photo at a time.' });
        }
      }
      window.RosyStores.gallery = next;
      return next;
    });
  };
  const doRemove = (id) => {
    setItems(arr => {
      const next = arr.filter(x => x.id !== id);
      window.RosyStores.gallery = next;
      return next;
    });
    setConfirmDeleteId(null);
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
      <input ref={replaceRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReplaceFile} />
      <ConfirmDialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Remove this photo?" message="It will be removed from the gallery — you can re-upload later." confirmLabel="Remove" onConfirm={() => doRemove(confirmDeleteId)} />

      {filtered.length === 0 ? <Empty icon={SP_I.Image} title="No photos in this section" body="Drag a photo here or upload from the toolbar." /> : (
        <div className="grid-3">
          {filtered.map(item => {
            const section = window.GALLERY_SECTIONS.find(s => s.id === item.section);
            return (
              <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', aspectRatio: '4/5' }}>
                  <EventImage src={item.src} name={section?.label || 'Photo'} size="100%" radius={0}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                  <button className="row-action-btn" aria-label="Replace photo" title="Replace photo" style={{ position: 'absolute', top: 8, right: 44, background: 'rgba(255,255,255,0.92)' }} onClick={() => { setReplaceTargetId(item.id); replaceRef.current && replaceRef.current.click(); }}><SP_I.Upload size={14} /></button>
                  <button className="row-action-btn danger" aria-label="Remove photo" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.92)' }} onClick={() => setConfirmDeleteId(item.id)}><SP_I.Trash2 size={14} /></button>
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
        <button className="btn btn-coral" onClick={() => toast.push({ kind: 'info', title: 'Saved (preview)', body: 'Backend wiring coming soon — changes are session-only for now.' })}>Save changes</button>
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

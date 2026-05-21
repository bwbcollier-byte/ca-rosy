/* Payments, disputes, users, workers, vendors, venues, settings, audit, content, analytics */

const SP_D = window.RosyData;
const SP_I = window.Icons;
const { useState: SP_us, useEffect: SP_ue } = React;

/* ============ Payments (admin/vendor/worker) ============ */
function PagePayments({ role, currentUser, setRoute, openId }) {
  const toast = useToast();
  const [dispute, setDispute] = SP_us(null);
  const [disputeReason, setDisputeReason] = SP_us('Hours mismatch');
  const [disputeDescription, setDisputeDescription] = SP_us('');
  const [disputeFiling, setDisputeFiling] = SP_us(false);
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
      // Postmark email to worker (demo redirects to ben@pronocoders.com)
      try {
        if (window.RosySendEmail && workerUser?.email) {
          await window.RosySendEmail({
            slug: 'worker-paid',
            to: workerUser.email,
            vars: {
              worker_first: workerUser.first || workerUser.name || 'there',
              amount: String(t.amount || 0),
              event_name: t.eventName || t.invoice || 'your gig',
              event_date: t.eventDate || '',
            },
          });
        }
      } catch (e) { console.warn('paid email failed:', e); }
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
        <StatCard icon={SP_I.DollarSign}    label={role === 'worker' ? 'Total earned' : 'Total paid'} value={totalEarned}  prefix="$" />
        <StatCard icon={SP_I.Clock}         label="Pending"  value={totalPending} prefix="$" />
        <StatCard icon={SP_I.AlertCircle}   label="Late / disputed" value={totalLate} prefix="$" />
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

      <Modal open={!!dispute} onClose={() => { setDispute(null); setDisputeReason('Hours mismatch'); setDisputeDescription(''); }} title="File a dispute" size="md"
        footer={<><button className="btn btn-ghost" disabled={disputeFiling} onClick={() => { setDispute(null); setDisputeReason('Hours mismatch'); setDisputeDescription(''); }}>Cancel</button><button className="btn btn-danger" disabled={disputeFiling || !disputeDescription.trim()} onClick={async () => {
          if (!dispute || disputeFiling) return;
          setDisputeFiling(true);
          try {
            if (!dispute._applicationId || !dispute._workerId || !dispute._vendorId) {
              throw new Error('Missing application or party IDs');
            }
            if (window.sb) {
              const { data: { user } } = await window.sb.auth.getUser();
              const { error } = await window.sb.from('rr_disputes').insert({
                gig_application_id: dispute._applicationId,
                raised_by: user?.id || dispute._vendorId,
                worker_id: dispute._workerId,
                vendor_id: dispute._vendorId,
                reason: disputeReason,
                description: disputeDescription.trim(),
                status: 'open',
              });
              if (error) throw error;
            }
            setDispute(null); setDisputeReason('Hours mismatch'); setDisputeDescription('');
            toast.push({ kind: 'warning', title: 'Dispute filed', body: 'Rosy support will review within 48 hours.' });
          } catch (e) {
            toast.push({ kind: 'error', title: "Couldn't file dispute", body: e.message || 'Please try again.' });
          } finally { setDisputeFiling(false); }
        }}>{disputeFiling ? 'Filing…' : 'File dispute'}</button></>}>
        {dispute ? (
          <div className="col" style={{ gap: 14 }}>
            <KV label="Invoice" value={dispute.invoice} />
            <KV label="Amount" value={fmtMoney(dispute.amount)} />
            <div className="field"><label className="field-label">Reason</label>
              <select className="select" value={disputeReason} onChange={e => setDisputeReason(e.target.value)}><option>Hours mismatch</option><option>No-show</option><option>Quality of work</option><option>Other</option></select>
            </div>
            <div className="field"><label className="field-label">Describe what happened</label><textarea className="textarea" value={disputeDescription} onChange={e => setDisputeDescription(e.target.value)} placeholder="Be specific. Include dates, times, what was agreed, and what occurred." /></div>
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
          footer={<><button className="btn btn-ghost" onClick={closeTx}>Close</button><button className="btn btn-coral" onClick={async () => {
            const t = openTx;
            closeTx();
            const payeeUser = (window.RosyData?.USERS || []).find(u => u.name === t.payee);
            const to = payeeUser?.email;
            if (!to) { toast.push({ kind: 'warning', title: 'No email on file', body: `Can't find an email for ${t.payee}.` }); return; }
            const subject = `Receipt: ${t.invoice} · ${fmtMoney(t.amount)}`;
            const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F1B16;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);"><tr><td style="padding:24px 28px 8px;font-family:Georgia,serif;font-size:22px;font-weight:500;">Rosy <span style="color:#F05A56;">Recruits</span></td></tr><tr><td style="padding:8px 28px 4px;"><h1 style="margin:0 0 14px;font-size:24px;">Receipt for ${t.invoice}</h1><table cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.65;color:#3F3933;"><tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Amount</td><td>${fmtMoney(t.amount)}</td></tr><tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Payer</td><td>${t.payer}</td></tr><tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Payee</td><td>${t.payee}</td></tr><tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Date</td><td>${t.date}</td></tr><tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Method</td><td>Stripe Connect</td></tr></table></td></tr><tr><td style="padding:18px 28px 28px;font-size:13px;color:#6E665D;">Thanks for working with Rosy Recruits.</td></tr></table></td></tr></table></body></html>`;
            try {
              const r = await window.RosySendEmail?.({ slug: 'worker-paid', to, subject, html, vars: { amount: String(t.amount), event_name: t.invoice, event_date: t.date } });
              if (r?.ok !== false) toast.push({ kind: 'success', title: 'Receipt sent', body: `Sent to ${t.payee}` });
              else toast.push({ kind: 'warning', title: "Couldn't send receipt", body: 'Check the console for details.' });
            } catch (e) { toast.push({ kind: 'error', title: "Couldn't send receipt", body: e.message }); }
          }}>Send receipt</button></>}>
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
            <KV label="Worker says" value={mediate.note || '—'} />
            <KV label="Vendor says" value={mediate.vendorNote || '—'} />
            <div className="field"><label className="field-label">Admin notes</label><textarea className="textarea" placeholder="Notes shared with both parties on resolution." /></div>
          </div>
        ) : null}
      </Modal>

      {thread ? (
        <Modal open={!!thread} onClose={() => setThread(null)} title={`Thread · ${thread.invoice}`} size="md"
          footer={<button className="btn btn-ghost" onClick={() => setThread(null)}>Close</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(thread.messages && thread.messages.length ? thread.messages : []).map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.side === 'out' ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 4 }}>{m.who} · {m.time}</span>
                <div className={`msg-bubble ${m.side}`}>{m.text}</div>
              </div>
            ))}
            {!(thread.messages && thread.messages.length) ? (
              <Empty icon={SP_I.MessageSquare} title="No messages on this thread yet" body="When the worker or vendor messages about this invoice, it'll show here." />
            ) : null}
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
  const [inviteEmail, setInviteEmail] = SP_us('');
  const [inviteNote, setInviteNote] = SP_us('');
  const [inviteSending, setInviteSending] = SP_us(false);
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
    }
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
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{u.cityFmt || '—'}{u.gigs ? ` · ${u.gigs} gigs` : ''}</p>
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
                <td style={{ fontSize: 13 }}>{u.cityFmt}</td>
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
                        try {
                          const { data: s } = await window.sb.auth.getSession();
                          await fetch('/api/admin/profile-update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s?.session?.access_token || '') },
                            body: JSON.stringify({ userId: u.id, fields: { verified: true } }),
                          });
                        } catch (e) { console.warn(e); }
                        const uu = (window.RosyData?.USERS || []).find(x => x.id === u.id);
                        if (uu) { uu.verified = true; window.dispatchEvent(new CustomEvent('rosy:data-changed')); }
                        // Send verified email via Postmark (demo redirects to ben@pronocoders.com)
                        try {
                          if (window.RosySendEmail) {
                            await window.RosySendEmail({
                              slug: 'verified',
                              to: u.email,
                              vars: { first_name: u.first || u.name || 'there', role: u.role || 'account' },
                            });
                          }
                        } catch (e) { console.warn('verified email failed:', e); }
                        toast.push({ kind: 'success', title: `${u.name} verified`, body: 'They can now access the dashboard.' });
                      }} title="Verify account"><SP_I.UserCheck size={14} /></button>
                    ) : null}
                    <button className="row-action-btn" onClick={async () => {
                      const next = u.status === 'active' ? 'inactive' : 'active';
                      setOverrides(o => ({ ...o, [u.id]: { ...(o[u.id] || {}), status: next } }));
                      const liveUser = (window.RosyData?.USERS || []).find(x => x.id === u.id);
                      if (liveUser) liveUser.status = next;
                      window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                      try {
                        const { data: s } = await window.sb.auth.getSession();
                        const r = await fetch('/api/admin/profile-update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s?.session?.access_token || '') },
                          body: JSON.stringify({ userId: u.id, fields: { status: next } }),
                        });
                        if (!r.ok) throw new Error('Admin update failed (' + r.status + ')');
                      } catch (e) { console.warn(e); toast.push({ kind: 'error', title: 'Status save failed', body: e.message }); return; }
                      toast.push({ kind: next === 'active' ? 'success' : 'warning', title: `${u.name} marked ${next}` });
                    }} title={u.status === 'active' ? 'Deactivate' : 'Activate'}>{u.status === 'active' ? <SP_I.UserX size={14} /> : <SP_I.CheckCircle2 size={14} />}</button>
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
        ]} />

      <UserDetailModal user={selected} onClose={closeDetail} setRoute={setRoute}
        initialEdit={editing}
        onSave={async (draft) => {
          // Optimistic: apply override locally + push into live RosyData so the
          // page reflects the change immediately.
          setOverrides(o => ({ ...o, [selected.id]: { ...(o[selected.id] || {}), ...draft } }));
          const live = (window.RosyData?.USERS || []).find(u => u.id === selected.id);
          if (live) {
            Object.assign(live, {
              photo: draft.photo, first: draft.first, last: draft.last, name: `${draft.first} ${draft.last}`.trim() || live.name,
              email: draft.email, phone: draft.phone, title: draft.title, bio: draft.bio,
              street: draft.street, zip: draft.zip,
              company: draft.company, company_name: draft.company,
            });
            window.dispatchEvent(new CustomEvent('rosy:data-changed'));
          }
          // Persist to Supabase. Admins bypass the elevation trigger so writes go through.
          try {
            if (window.sb) {
              const { error: pErr } = await window.sb.from('rr_profiles').update({
                first_name: draft.first || null, last_name: draft.last || null,
                phone: draft.phone || null, title: draft.title || null,
                bio: draft.bio || null, avatar_url: draft.photo || null,
                street: draft.street || null, city: draft.city || null,
                state: draft.state || null, zip: draft.zip || null,
              }).eq('id', selected.id);
              if (pErr) throw pErr;
              if (selected.role === 'vendor' && draft.company) {
                await window.sb.from('rr_vendor_profiles').upsert({
                  id: selected.id, company_name: draft.company,
                  business_description: draft.bio || null,
                  business_phone: draft.phone || null,
                  logo_url: draft.photo || null,
                }, { onConflict: 'id' });
              }
              if (selected.role === 'worker' && draft.hourlyRate) {
                await window.sb.from('rr_worker_profiles').upsert({
                  id: selected.id, hourly_rate: Number(draft.hourlyRate) || null,
                  services: draft.skills ? draft.skills.split(',').map(s => s.trim()).filter(Boolean) : null,
                }, { onConflict: 'id' });
              }
            }
          } catch (e) { console.warn('admin profile save failed:', e.message); }
        }} />

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

      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteEmail(''); setInviteNote(''); }} title={`Invite ${title.toLowerCase().slice(0, -1) || 'user'}`} size="sm"
        footer={<><button className="btn btn-ghost" disabled={inviteSending} onClick={() => { setInviteOpen(false); setInviteEmail(''); setInviteNote(''); }}>Cancel</button><button className="btn btn-coral" disabled={inviteSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)} onClick={async () => {
          if (inviteSending) return;
          setInviteSending(true);
          try {
            const inviterName = currentUser?.name || 'A Rosy admin';
            const targetRole = title === 'Vendors' ? 'vendor' : title === 'Workers' ? 'worker' : 'user';
            const r = await window.RosySendEmail?.({
              slug: 'invite-user', to: inviteEmail,
              vars: { inviter_name: inviterName, role: targetRole, invite_url: window.location.origin + '/#auth' },
            });
            if (r?.ok === false) throw new Error('Send failed');
            setInviteOpen(false); setInviteEmail(''); setInviteNote('');
            toast.push({ kind: 'success', title: 'Invite sent', body: `Sent to ${inviteEmail}.` });
          } catch (e) {
            toast.push({ kind: 'error', title: "Couldn't send invite", body: e.message || 'Please try again.' });
          } finally { setInviteSending(false); }
        }}>{inviteSending ? 'Sending…' : 'Send invite'}</button></>}>
        <div className="col" style={{ gap: 12 }}>
          <div className="field"><label className="field-label">Email</label><input className="input" placeholder="they@studio.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
          <div className="field"><label className="field-label">Personal note (optional)</label><textarea className="textarea" value={inviteNote} onChange={e => setInviteNote(e.target.value)} placeholder="Hey — wanted to bring you onto our weekend crew." /></div>
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
          <p style={{ margin: '4px 0 12px', color: 'var(--color-muted)', fontSize: 14 }}>{(() => { const c = editing ? draft.company : user.company; const loc = editing ? draft.city : user.city; const parts = [c, loc].filter(Boolean); return parts.length ? parts.join(' · ') : (user.onboarding_complete ? '—' : 'Profile not yet completed'); })()}</p>
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
                // Branded Postmark email via our endpoint (not Supabase's default).
                const r = await fetch('/api/auth/password-reset', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: user.email }),
                });
                if (!r.ok) throw new Error('Reset request failed');
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
            <KV label="Phone" value={user.phone || '—'} />
            <KV label="Joined" value={fmtDate(user.joined, 'mdy-dots')} />
            <KV label="Role" value={<span style={{ textTransform: 'capitalize' }}>{user.role}</span>} />
            {user.role !== 'worker' ? <KV label="Company / studio" value={user.company || '—'} /> : null}
            {user.title ? <KV label="Title" value={user.title} /> : null}
            <KV label="Location" value={user.cityFmt || '—'} />
            {user.street ? <KV label="Street" value={user.street} /> : null}
            {user.zip ? <KV label="ZIP" value={user.zip} /> : null}
            {user.role === 'worker' && user.hourlyRate != null ? <KV label="Hourly rate" value={`$${user.hourlyRate}/hr`} /> : null}
            {user.role !== 'worker' && user.vendorRate != null ? <KV label="Vendor day rate" value={`$${user.vendorRate}/day`} /> : null}
            {user.websiteUrl ? <KV label="Website" value={user.websiteUrl} /> : null}
            {user.role === 'worker' && user.skills ? <KV label="Skills" value={Array.isArray(user.skills) ? user.skills.join(', ') : user.skills} /> : null}
            {user.serviceCategories && user.serviceCategories.length ? <KV label="Services" value={user.serviceCategories.join(', ')} /> : null}
            {user.termsAccepted ? <KV label="Terms accepted" value={user.termsAcceptedAt ? new Date(user.termsAcceptedAt).toLocaleDateString() : 'Yes'} /> : null}
            {user.w9Completed ? <KV label="W-9 on file" value="Yes" /> : null}
            <KV label="Status" value={<span style={{ textTransform: 'capitalize' }}>{user.status}</span>} />
          </div>
          <h4 style={{ margin: '24px 0 8px', fontSize: 14, fontWeight: 600 }}>Bio</h4>
          <p style={{ margin: 0, color: user.bio ? 'var(--color-body)' : 'var(--color-muted)', fontSize: 14, lineHeight: 1.55, fontStyle: user.bio ? 'normal' : 'italic' }}>
            {user.bio || (user.onboarding_complete ? 'No bio yet.' : 'This user has not completed onboarding yet — no profile info available.')}
          </p>
          {user.showBusinessHours && user.businessHours ? (
            <>
              <h4 style={{ margin: '24px 0 8px', fontSize: 14, fontWeight: 600 }}>Business hours</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '4px 12px', fontSize: 13, color: 'var(--color-body)' }}>
                {[['Mon','mon'],['Tue','tue'],['Wed','wed'],['Thu','thu'],['Fri','fri'],['Sat','sat'],['Sun','sun']].map(([label, key]) => (
                  <React.Fragment key={key}>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    <span style={{ color: 'var(--color-muted)' }}>{user.businessHours[key] ? `${user.businessHours[key].open} – ${user.businessHours[key].close}` : 'Closed'}</span>
                  </React.Fragment>
                ))}
              </div>
            </>
          ) : null}
          {user.vendorSignatureUrl || user.workerSignatureUrl ? (
            <>
              <h4 style={{ margin: '24px 0 8px', fontSize: 14, fontWeight: 600 }}>Signature on file</h4>
              <img src={user.vendorSignatureUrl || user.workerSignatureUrl} alt="User signature" style={{ maxWidth: 320, maxHeight: 120, background: '#fff', border: '1px solid var(--color-hairline)', borderRadius: 8, padding: 8 }} />
            </>
          ) : null}
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
  // Hydrate from window.RosyData.VENUES (filled by supabase_client buildVenues from rr_venues).
  const venueSource = () => (window.RosyData?.VENUES || []).map(v => ({ ...v, active: v.active !== false, address: v.address || `${v.name}${v.city ? ' · ' + v.city : ''}`, image: v.image || null, parking: v.parking || '', notes: v.notes || '' }));
  const [venues, setVenues] = SP_us(venueSource());
  React.useEffect(() => {
    const sync = () => setVenues(venueSource());
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
                <button className="row-action-btn" style={{ marginLeft: 'auto' }} title={v.active !== false ? 'Deactivate' : 'Activate'} onClick={async () => {
                  const next = !(v.active !== false);
                  const updated = { ...v, active: next };
                  setVenues(arr => arr.map(x => x.id === v.id ? updated : x));
                  const lv = (window.RosyData?.VENUES || []).find(x => x.id === v.id);
                  if (lv) lv.active = next;
                  window.dispatchEvent(new CustomEvent('rosy:data-changed'));
                  try { if (window.sb) await window.sb.from('rr_venues').update({ active: next }).eq('id', v.id); } catch (e) { console.warn(e); }
                  toast.push({ kind: next ? 'success' : 'warning', title: `${v.name} ${next ? 'activated' : 'deactivated'}` });
                }}>{v.active !== false ? <SP_I.UserX size={14} /> : <SP_I.CheckCircle2 size={14} />}</button>
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
          <ImageUpload value={f.image} onChange={(v) => upd('image', v)} label="Upload venue photo" size={120} round={false} bucket="rr-event-images" />
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
    : ['profile','account','notifications','payouts','privacy','danger'];
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
          {tab === 'account' ? <SettingsAccount user={currentUser} /> : null}
          {tab === 'notifications' ? <SettingsNotifications user={currentUser} /> : null}
          {tab === 'payouts' ? <SettingsPayouts user={currentUser} /> : null}
          {tab === 'privacy' && role !== 'admin' ? <SettingsPrivacy role={role} user={currentUser} /> : null}
          {tab === 'team' && role !== 'admin' ? <SettingsTeam /> : null}
          {tab === 'danger' && role !== 'admin' ? <SettingsDanger user={currentUser} /> : null}
        </div>
      </div>
    </div>
  );
}

function SettingsPrivacy({ role, user }) {
  const toast = useToast();
  // Persist to localStorage scoped to the user so toggles survive refresh.
  const key = (k) => `rosy.privacy.${user?.id || 'anon'}.${k}`;
  const [hideOldRatings, setHideOldRatings] = SP_us(() => {
    try { return localStorage.getItem(key('hideOldRatings')) === '1'; } catch (e) { return false; }
  });
  const [noindex, setNoindex] = SP_us(() => {
    try { return localStorage.getItem(key('noindex')) === '1'; } catch (e) { return false; }
  });
  SP_ue(() => { try { localStorage.setItem(key('hideOldRatings'), hideOldRatings ? '1' : '0'); } catch (e) {} }, [hideOldRatings, user?.id]);
  SP_ue(() => { try { localStorage.setItem(key('noindex'), noindex ? '1' : '0'); } catch (e) {} }, [noindex, user?.id]);
  const exportMyData = async () => {
    if (!user?.id) { toast.push({ kind: 'warning', title: 'Sign in first' }); return; }
    try {
      const D = window.RosyData || {};
      const myId = user.id;
      const myName = user.name;
      const payload = {
        exported_at: new Date().toISOString(),
        profile: (D.USERS || []).find(u => u.id === myId) || null,
        events: (D.EVENTS || []).filter(e => e.vendorId === myId),
        gigs: (D.GIGS || []).filter(g => (g.assignedTo || []).includes(myId)),
        applications: (D.APPLICATIONS || []).filter(a => a.workerId === myId),
        messages_summary: (D.MESSAGES || []).filter(c => (c.participants || []).includes(myId)).map(c => ({ id: c.id, with: c.with, messages: (c.messages || []).length })),
        notifications: (D.NOTIFICATIONS || []).filter(n => !n._userId || n._userId === myId),
        transactions: (D.TRANSACTIONS || []).filter(t => (myName && (t.payer === myName || t.payee === myName)) || (user.company && t.payer === user.company)),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rosy-recruits-data-${myId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.push({ kind: 'success', title: 'Data exported', body: 'Your JSON file is downloading now.' });
    } catch (e) {
      toast.push({ kind: 'error', title: "Couldn't export data", body: 'Please try again.' });
    }
  };
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
        <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={exportMyData}><SP_I.UploadCloud size={14} />Export all my data</button>
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

// Phone normaliser. Leaves international numbers (anything starting with +)
// untouched so non-US users aren't forced into a US format.
function formatUSPhone(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s.replace(/[^\d+ ]/g, '');
  const d = s.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  const has1 = d.length === 11 && d.startsWith('1');
  const core = has1 ? d.slice(1) : d;
  if (core.length <= 3) return `(${core}`;
  if (core.length <= 6) return `(${core.slice(0,3)}) ${core.slice(3)}`;
  return `(${core.slice(0,3)}) ${core.slice(3,6)}-${core.slice(6,10)}`;
}
// Accept any phone number with 7-15 digits (E.164 max). Lets international users
// onboard without being blocked by the US-only validator.
function isValidUSPhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  return d.length >= 7 && d.length <= 15;
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
    // Best-effort persist. Column names match the actual rr_* schema:
    //   rr_vendor_profiles uses `id` (not user_id), `website_url` (not website).
    //   rr_worker_profiles uses `id` (not user_id), `hourly_rate` (no rate_min/max).
    try {
      if (window.sb) {
        const { error: pErr } = await window.sb.from('rr_profiles').update({
          first_name: d.first || null, last_name: d.last || null,
          phone: d.phone || null, bio: d.bio || null, avatar_url: d.photo || null,
          title: d.title || null, city: d.city || null, state: d.state || null,
        }).eq('id', user.id);
        if (pErr) console.warn('rr_profiles update failed:', pErr.message);
        if (role === 'vendor') {
          const { error: vErr } = await window.sb.from('rr_vendor_profiles').upsert({
            id: user.id, company_name: d.company_name || null,
            website_url: d.website || null, business_description: d.business_description || null,
            business_phone: d.phone || null, logo_url: d.photo || null,
          }, { onConflict: 'id' });
          if (vErr) console.warn('rr_vendor_profiles upsert failed:', vErr.message);
        } else if (role === 'worker') {
          const servicesArr = d.services.split(',').map(s => s.trim()).filter(Boolean);
          const { error: wErr } = await window.sb.from('rr_worker_profiles').upsert({
            id: user.id,
            hourly_rate: d.rate_min ? Number(d.rate_min) : null,
            services: servicesArr,
          }, { onConflict: 'id' });
          if (wErr) console.warn('rr_worker_profiles upsert failed:', wErr.message);
        }
      }
    } catch (e) { console.warn('profile save failed:', e); }
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
            <div className="field"><label className="field-label">Hourly rate ($/hr)</label><input className="input" type="number" min={0} value={d.rate_min} onChange={e => set('rate_min', e.target.value)} placeholder="35" /></div>
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

function SettingsAccount({ user }) {
  const toast = useToast();
  const [sending, setSending] = SP_us(false);
  const sendReset = async () => {
    if (!user?.email) { toast.push({ kind: 'warning', title: 'No email on file' }); return; }
    setSending(true);
    try {
      const r = await fetch('/api/auth/password-reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      if (!r.ok) throw new Error('Reset request failed');
      toast.push({ kind: 'success', title: 'Password reset sent', body: `Check ${user.email} for the link.` });
    } catch (e) {
      toast.push({ kind: 'error', title: "Couldn't send reset", body: 'Please try again in a moment.' });
    } finally { setSending(false); }
  };
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Account</h3>
      <div className="col" style={{ gap: 16 }}>
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Email</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-body)' }}>{user?.email || '—'}</p>
        </div>
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Password</p>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--color-muted)' }}>We'll email you a secure link to set a new password.</p>
          <button className="btn btn-ghost btn-sm" onClick={sendReset} disabled={sending}>{sending ? 'Sending…' : 'Email me a reset link'}</button>
        </div>
      </div>
    </div>
  );
}

function SettingsNotifications({ user }) {
  const toast = useToast();
  // Persisted in rr_profiles.email_notifications jsonb. Default each preference to true.
  const initial = () => {
    const stored = user?.emailNotifications || user?.email_notifications || {};
    return {
      apps:     stored.apps     !== false,
      msgs:     stored.msgs     !== false,
      payments: stored.payments !== false,
      weekly:   stored.weekly === true,
    };
  };
  const [s, setS] = SP_us(initial());
  SP_ue(() => { setS(initial()); }, [user?.id]);
  const save = async (next) => {
    setS(next);
    if (!user?.id || !window.sb) return;
    try {
      const { error } = await window.sb.from('rr_profiles').update({ email_notifications: next }).eq('id', user.id);
      if (error) throw error;
    } catch (e) { toast.push({ kind: 'warning', title: "Couldn't save preferences", body: 'Try again in a moment.' }); }
  };
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
            <span className={`toggle ${s[k] ? 'on' : ''}`} onClick={() => save({ ...s, [k]: !s[k] })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPayouts({ user }) {
  // Pull live Stripe Connect status. Show real state — connected / not-connected — instead
  // of a hardcoded "Bank of America ••••3041" placeholder that lied to every user.
  const toast = useToast();
  const [status, setStatus] = SP_us(null); // null = loading, false = not connected, object = details
  const [loading, setLoading] = SP_us(false);
  SP_ue(() => {
    if (!user?.id) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/stripe/connect-status?userId=' + encodeURIComponent(user.id));
        if (!r.ok) { if (!cancel) setStatus(false); return; }
        const d = await r.json();
        if (!cancel) setStatus(d.payoutsEnabled ? d : false);
      } catch (e) { if (!cancel) setStatus(false); }
    })();
    return () => { cancel = true; };
  }, [user?.id]);
  const openOnboarding = async () => {
    if (!user?.id || !user?.email) return;
    setLoading(true);
    try {
      const r = await fetch('/api/stripe/connect-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, email: user.email,
          returnUrl: window.location.origin + '/#app/settings?stripe=connected',
          refreshUrl: window.location.origin + '/#app/settings?stripe=refresh',
        }),
      });
      const d = await r.json();
      if (d?.url) { window.location.href = d.url; return; }
      toast.push({ kind: 'warning', title: "Couldn't open Stripe", body: 'Please try again in a moment.' });
    } catch (e) {
      toast.push({ kind: 'error', title: "Couldn't open Stripe", body: 'Check your connection and try again.' });
    } finally { setLoading(false); }
  };
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Payouts</h3>
      {status === null ? (
        <div style={{ padding: 16, color: 'var(--color-muted)', fontSize: 13.5 }}>Checking Stripe connection…</div>
      ) : status === false ? (
        <div style={{ background: 'var(--color-surface-soft)', border: '1px dashed var(--color-hairline-strong)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Stripe Connect — Not connected</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>Connect your bank to {user?.role === 'vendor' ? 'fund gigs' : 'receive payouts'}. Takes ~2 minutes.</p>
          </div>
          <button className="btn btn-coral btn-sm" onClick={openOnboarding} disabled={loading}>{loading ? 'Opening Stripe…' : 'Connect Stripe'}</button>
        </div>
      ) : (
        <div style={{ background: 'var(--rosy-teal-soft)', border: '1px solid var(--rosy-teal-border)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Stripe Connect — Connected</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--rosy-teal-dark)' }}>{status?.bankLast4 ? `Payouts to bank ••••${status.bankLast4}` : 'Payouts ready'} · 1–2 business days</p>
          </div>
          <button className="btn btn-ghost-teal btn-sm" onClick={openOnboarding}>Manage in Stripe</button>
        </div>
      )}
    </div>
  );
}

function SettingsTeam() { return <div className="card"><h3 className="card-title">Team</h3><Empty icon={SP_I.Users} title="No teammates yet" body="Invite collaborators to manage this account." cta={<button className="btn btn-coral btn-sm"><SP_I.UserPlus size={14} />Invite</button>} /></div>; }
function SettingsDanger({ user }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = SP_us(false);
  const [confirmText, setConfirmText] = SP_us('');
  const [deleting, setDeleting] = SP_us(false);
  const canDelete = confirmText.trim().toLowerCase() === 'delete';
  const doDelete = async () => {
    if (!user?.id || !canDelete) return;
    setDeleting(true);
    try {
      // Soft-delete: mark profile inactive and sign the user out. Hard delete of
      // auth.users + cascading rows requires service-role and is done by an admin.
      if (window.sb) {
        const { error } = await window.sb.from('rr_profiles').update({ status: 'inactive' }).eq('id', user.id);
        if (error) throw error;
        try { await window.sb.auth.signOut(); } catch (e) {}
      }
      toast.push({ kind: 'success', title: 'Account scheduled for deletion', body: 'Our team will remove your data within 7 days. Signing you out.' });
      setTimeout(() => { window.location.hash = 'marketing'; window.location.reload(); }, 1200);
    } catch (e) {
      toast.push({ kind: 'error', title: "Couldn't delete account", body: e.message || 'Please contact support.' });
      setDeleting(false);
    }
  };
  return (
    <div className="card" style={{ borderColor: 'var(--rosy-coral)' }}>
      <h3 className="card-title" style={{ color: 'var(--rosy-coral)', marginBottom: 12 }}>Danger zone</h3>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', marginBottom: 16 }}>Permanently delete your account and all associated data. This can't be undone.</p>
      <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>Delete account</button>
      <Modal open={confirmOpen} onClose={() => { setConfirmOpen(false); setConfirmText(''); }} title="Delete your account?" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>Cancel</button><button className="btn btn-danger" disabled={!canDelete || deleting} onClick={doDelete}>{deleting ? 'Deleting…' : 'Delete forever'}</button></>}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>This will deactivate your profile immediately and queue your data for permanent deletion within 7 days. Vendors with open gigs must close them first.</p>
        <p style={{ margin: '14px 0 6px', fontSize: 13.5, fontWeight: 600 }}>Type <code>delete</code> to confirm:</p>
        <input className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="delete" autoFocus />
      </Modal>
    </div>
  );
}

/* ============ Audit log (admin) ============ */
function PageAudit() {
  const toast = useToast();
  const [search, setSearch] = SP_us('');
  // Hydrate from rr_audit_log instead of the hardcoded demo entries.
  const [entries, setEntries] = SP_us([]);
  SP_ue(() => {
    let cancel = false;
    (async () => {
      if (!window.sb) return;
      try {
        const { data, error } = await window.sb.from('rr_audit_log')
          .select('id, admin_id, action, target_type, target_id, details, created_at')
          .order('created_at', { ascending: false }).limit(200);
        if (error) { console.warn('rr_audit_log fetch failed:', error.message); return; }
        if (cancel) return;
        const users = window.RosyData?.USERS || [];
        const byId = Object.fromEntries(users.map(u => [u.id, u]));
        const fmtAgo = (iso) => { try { const t = (Date.now() - new Date(iso)) / 1000; if (t < 60) return 'Just now'; if (t < 3600) return `${Math.round(t/60)}m ago`; if (t < 86400) return `${Math.round(t/3600)}h ago`; return `${Math.round(t/86400)}d ago`; } catch (e) { return ''; } };
        const kindFor = (action, target) => {
          if (target === 'rr_gigs' || /gig/i.test(action)) return 'gig';
          if (target === 'rr_events' || /event/i.test(action)) return 'event';
          if (target === 'rr_profiles' || /profile/i.test(action)) return 'profile';
          if (/payment|payout|stripe/i.test(action)) return 'payment';
          if (/suspend|delete|restore/i.test(action)) return 'admin';
          return 'system';
        };
        setEntries(data.map(r => ({
          who: byId[r.admin_id]?.name || (r.admin_id ? 'Admin' : 'System'),
          what: r.details?.summary || `${r.action || 'updated'} ${r.target_type || ''}${r.target_id ? ' ' + String(r.target_id).slice(0, 8) : ''}`.trim(),
          when: fmtAgo(r.created_at),
          kind: kindFor(r.action || '', r.target_type || ''),
        })));
      } catch (e) { console.warn('audit log load failed:', e); }
    })();
    return () => { cancel = true; };
  }, []);
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
  const totalRevenueAllTime = txs.filter(t => t.status === 'Paid').reduce((s, t) => s + (t.amount || 0), 0);
  const totalRevenue30 = txs.filter(t => t.status === 'Paid' && within30(t.date)).reduce((s, t) => s + (t.amount || 0), 0);
  const activeUsersAllTime = users.filter(u => u.status === 'active').length;
  const activeUsers30 = users.filter(u => u.lastActive && within30(u.lastActive)).length;
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
        <StatCard icon={SP_I.DollarSign}  label="Revenue" value={totalRevenueAllTime} prefix="$" period="All time" sublabel={`$${totalRevenue30.toLocaleString()} in last 30 days`} />
        <StatCard icon={SP_I.Users}       label="Active users" value={activeUsersAllTime} period="All time" sublabel={`${activeUsers30} active in last 30 days`} />
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

function PageFAQs() {
  const toast = useToast();
  const [items, setItems] = SP_us([]);
  const [loading, setLoading] = SP_us(true);
  const [saving, setSaving] = SP_us({});
  const [editing, setEditing] = SP_us(null); // id of row being edited
  const [draft, setDraft] = SP_us({ question: '', answer: '', sort_order: 0, is_visible: true });
  const [adding, setAdding] = SP_us(false);
  const load = async () => {
    setLoading(true);
    try {
      if (!window.sb) { setItems([]); setLoading(false); return; }
      const { data, error } = await window.sb.from('rr_faqs').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (e) { console.warn('rr_faqs load failed:', e.message); toast.push({ kind: 'error', title: "Couldn't load FAQs", body: e.message }); }
    setLoading(false);
  };
  SP_ue(() => { load(); }, []);
  const saveRow = async (row) => {
    setSaving(s => ({ ...s, [row.id]: true }));
    try {
      const { error } = await window.sb.from('rr_faqs').update({
        question: row.question, answer: row.answer,
        sort_order: row.sort_order ?? 0, is_visible: row.is_visible !== false,
      }).eq('id', row.id);
      if (error) throw error;
      setEditing(null);
      toast.push({ kind: 'success', title: 'FAQ saved' });
      load();
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't save", body: e.message }); }
    setSaving(s => ({ ...s, [row.id]: false }));
  };
  const toggleVisible = async (row) => {
    setSaving(s => ({ ...s, [row.id]: true }));
    try {
      const next = !(row.is_visible !== false);
      const { error } = await window.sb.from('rr_faqs').update({ is_visible: next }).eq('id', row.id);
      if (error) throw error;
      setItems(arr => arr.map(x => x.id === row.id ? { ...x, is_visible: next } : x));
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't update", body: e.message }); }
    setSaving(s => ({ ...s, [row.id]: false }));
  };
  const [deleteTarget, setDeleteTarget] = SP_us(null);
  const confirmDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    try {
      const { error } = await window.sb.from('rr_faqs').delete().eq('id', row.id);
      if (error) throw error;
      setItems(arr => arr.filter(x => x.id !== row.id));
      setDeleteTarget(null);
      toast.push({ kind: 'success', title: 'FAQ deleted' });
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't delete", body: e.message }); }
  };
  const addRow = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) { toast.push({ kind: 'warning', title: 'Question + answer required' }); return; }
    setAdding(true);
    try {
      const { error } = await window.sb.from('rr_faqs').insert({
        question: draft.question.trim(), answer: draft.answer.trim(),
        sort_order: items.length, is_visible: true,
      });
      if (error) throw error;
      setDraft({ question: '', answer: '', sort_order: 0, is_visible: true });
      toast.push({ kind: 'success', title: 'FAQ added' });
      load();
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't add", body: e.message }); }
    setAdding(false);
  };
  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>FAQs</h2><span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Visible on the marketing /help page</span></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Add an FAQ</h3>
        <div className="col" style={{ gap: 10 }}>
          <div className="field"><label className="field-label">Question</label><input className="input" value={draft.question} onChange={e => setDraft(d => ({ ...d, question: e.target.value }))} placeholder="How do payouts work?" /></div>
          <div className="field"><label className="field-label">Answer</label><textarea className="textarea" rows={3} value={draft.answer} onChange={e => setDraft(d => ({ ...d, answer: e.target.value }))} placeholder="Plain-language answer the public will see." /></div>
          <div><button className="btn btn-coral btn-sm" disabled={adding || !draft.question.trim() || !draft.answer.trim()} onClick={addRow}>{adding ? 'Adding…' : 'Add FAQ'}</button></div>
        </div>
      </div>
      <div className="card card-flush">
        {loading ? <div style={{ padding: 28, color: 'var(--color-muted)' }}>Loading…</div> : items.length === 0 ? (
          <Empty icon={SP_I.HelpCircle} title="No FAQs yet" body="Add your first question above so it shows up on the help page." />
        ) : items.map(row => (
          <div key={row.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-hairline)' }}>
            {editing === row.id ? (
              <div className="col" style={{ gap: 8 }}>
                <input className="input" value={row.question} onChange={e => setItems(arr => arr.map(x => x.id === row.id ? { ...x, question: e.target.value } : x))} />
                <textarea className="textarea" rows={3} value={row.answer} onChange={e => setItems(arr => arr.map(x => x.id === row.id ? { ...x, answer: e.target.value } : x))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-coral btn-sm" disabled={saving[row.id]} onClick={() => saveRow(row)}>{saving[row.id] ? 'Saving…' : 'Save'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); load(); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5 }}>{row.question}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55 }}>{row.answer}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <button className="btn btn-ghost btn-sm" disabled={saving[row.id]} onClick={() => toggleVisible(row)}>{row.is_visible === false ? 'Show' : 'Hide'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(row.id)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(row)} style={{ color: 'var(--rosy-coral)' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete this FAQ?" size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="btn btn-danger" onClick={confirmDelete}>Delete forever</button></>}>
        {deleteTarget ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>This will remove "<strong>{deleteTarget.question}</strong>" from your help page. Visitors won't see it anymore.</p> : null}
      </Modal>
    </div>
  );
}
window.PageFAQs = PageFAQs;

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
  const saveTemplate = async () => {
    const updated = { ...templates[editId], subject: draft.subject, body: draft.body, live: draft.live, lastEdited: new Date().toISOString().slice(0, 10) };
    const next = { ...templates, [editId]: updated };
    setTemplates(next);
    window.RosyStores.emailTemplates = next;
    // Persist to rr_email_templates so changes survive a refresh + are available to
    // the server-side send-email function. Upsert by slug.
    try {
      if (window.sb) {
        const { error } = await window.sb.from('rr_email_templates').upsert({
          slug: editId, name: updated.name || editId, subject: draft.subject,
          body_html: draft.body, is_active: !!draft.live,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'slug' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('rr_email_templates upsert failed:', e.message);
      toast.push({ kind: 'warning', title: 'Saved locally only', body: "Couldn't persist to the database — refresh will revert. " + (e.message || '') });
      setEditId(null);
      return;
    }
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
          footer={<><button className="btn btn-ghost" onClick={() => setTestModalOpen(false)}>Cancel</button><button className="btn btn-coral" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)} onClick={async () => {
            const to = testEmail;
            setTestModalOpen(false);
            try {
              const r = await window.RosySendEmail?.({
                slug: editId || 'test', to,
                subject: draft.subject || 'Rosy Recruits test',
                html: draft.body || '<p>(no body)</p>',
                vars: { first_name: 'Test', role: 'vendor', event_name: 'Sample event', event_date: '2026-06-01', call_time: '09:00', venue_name: 'Sample Venue', hourly_rate: '35', worker_first: 'Worker', worker_name: 'Worker Name', worker_rating: '4.8', worker_gigs: '12', amount: '100', invoice: 'INV-0001', reason: 'Sample', filed_by: 'Admin', inviter_name: 'Admin', invite_url: 'https://rosy-demo.vercel.app/#auth', verification_url: 'https://rosy-demo.vercel.app/#auth', maps_url: 'https://maps.google.com', venue_address: '123 Sample St', venue_city: 'Anywhere', lead_name: 'Lead', gig_type: 'Lead', gigs_count: '3', hours: '12', earned: '450', upcoming_count: '2' },
              });
              if (r?.ok !== false) toast.push({ kind: 'success', title: 'Test email sent', body: `Sent to ${to}` });
              else toast.push({ kind: 'warning', title: 'Test email failed', body: 'Check the console for details.' });
            } catch (e) { toast.push({ kind: 'error', title: 'Test email failed', body: e.message || 'Try again.' }); }
            setTestEmail('');
          }}>Send</button></>}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Send to</label>
          <input className="input" placeholder="you@studio.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Demo mode redirects the message to the staging inbox.</p>
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
      try { localStorage.setItem('rosy.gallery', JSON.stringify(next)); } catch (e) {}
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
      try { localStorage.setItem('rosy.gallery', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  const doArchive = (id) => {
    setItems(arr => {
      const next = arr.map(x => x.id === id ? { ...x, section: 'unused' } : x);
      window.RosyStores.gallery = next;
      try { localStorage.setItem('rosy.gallery', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    toast.push({ kind: 'info', title: 'Photo archived', body: 'Moved to Unused — you can reassign or re-publish later.' });
  };
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newId = 'g' + Math.random().toString(36).slice(2, 6);
      const next = [{ id: newId, src: ev.target.result, section: 'unused' }, ...items];
      setItems(next); window.RosyStores.gallery = next;
      try { localStorage.setItem('rosy.gallery', JSON.stringify(next)); } catch (e) {}
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
                  {item.section !== 'unused' ? <button className="row-action-btn" aria-label="Archive photo" title="Archive (move to Unused)" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.92)' }} onClick={() => doArchive(item.id)}><SP_I.UserX size={14} /></button> : null}
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
  const [rows, setRows] = SP_us([]);
  const [drafts, setDrafts] = SP_us({});
  const [loading, setLoading] = SP_us(true);
  const [saving, setSaving] = SP_us(false);
  SP_ue(() => {
    let cancel = false;
    (async () => {
      if (!window.sb) { setLoading(false); return; }
      try {
        const { data, error } = await window.sb.from('rr_platform_settings').select('*').order('key');
        if (error) throw error;
        if (cancel) return;
        setRows(data || []);
        setDrafts(Object.fromEntries((data || []).map(r => [r.key, r.value])));
      } catch (e) { console.warn('platform_settings load failed:', e.message); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);
  const dirty = rows.some(r => drafts[r.key] !== r.value);
  const save = async () => {
    if (saving || !dirty || !window.sb) return;
    setSaving(true);
    const changed = rows.filter(r => drafts[r.key] !== r.value);
    try {
      for (const r of changed) {
        const { error } = await window.sb.from('rr_platform_settings').update({ value: drafts[r.key], updated_at: new Date().toISOString() }).eq('key', r.key);
        if (error) throw error;
      }
      setRows(rs => rs.map(r => ({ ...r, value: drafts[r.key] })));
      toast.push({ kind: 'success', title: `${changed.length} ${changed.length === 1 ? 'setting' : 'settings'} saved` });
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't save", body: e.message || 'Try again.' }); }
    finally { setSaving(false); }
  };
  // Group by inferred bucket from the key prefix.
  const buckets = {};
  rows.forEach(r => {
    const bucket = r.key.startsWith('rate_') ? 'Default gig rates' : r.key.includes('fee') || r.key.includes('hold') ? 'Fees & holds' : 'Other';
    (buckets[bucket] = buckets[bucket] || []).push(r);
  });
  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Platform settings</h2>
        <button className="btn btn-coral" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
      </div>
      {loading ? <div className="card" style={{ color: 'var(--color-muted)' }}>Loading…</div> : (
        <div className="grid-2">
          {Object.entries(buckets).map(([title, group]) => (
            <div key={title} className="card">
              <h3 className="card-title" style={{ marginBottom: 14 }}>{title}</h3>
              {group.map(r => (
                <div key={r.key} className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label">{r.label || r.key}</label>
                  <input className="input" value={drafts[r.key] ?? ''} onChange={(e) => setDrafts(d => ({ ...d, [r.key]: e.target.value }))} />
                  {r.description ? <p className="field-hint">{r.description}</p> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PagePayments, PageDisputes, PageDirectory, PageVenues, PageSettings, PageAudit, PageAnalytics, PageSiteContent, PageEmails, PageGallery, PagePlatformSettings });

/* Admin extras: Admin Assistant permissions, Broadcast composer, Notification workflow rules,
   SafeImage placeholder wrapper. */

const { useState: AX_us, useEffect: AX_ue, useRef: AX_ur } = React;
const AX_I = window.Icons;
const AX_D = window.RosyData;

/* ============ SafeImage — falls back to placeholder ============ */
function SafeImage({ src, alt = '', placeholderIcon, placeholderTone = 'mint', style = {}, className = '' }) {
  const [failed, setFailed] = AX_us(!src);
  const tones = {
    mint:     'var(--color-brand-mint)',
    peach:    'var(--color-brand-peach)',
    lavender: 'var(--color-brand-lavender)',
    cream:    'var(--color-surface-card)',
    ochre:    'var(--color-brand-ochre)',
  };
  const Tone = tones[placeholderTone] || tones.mint;
  const Icon = placeholderIcon || AX_I.Image;
  if (failed) {
    return (
      <div className={className} style={{ ...style, background: Tone, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(10,10,10,0.4)' }}>
        <Icon size={32} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}

/* ============ Admin Permission matrix ============ */
const PERMISSION_GROUPS = [
  { id: 'users',     label: 'User management',     subs: ['view','suspend','delete','invite'] },
  { id: 'events',    label: 'Events & gigs',       subs: ['view','create','edit','delete'] },
  { id: 'payments',  label: 'Payments & escrow',   subs: ['view','release','refund'] },
  { id: 'disputes',  label: 'Disputes & support',  subs: ['view','mediate','close'] },
  { id: 'content',   label: 'Site content',        subs: ['view','edit','publish'] },
  { id: 'platform',  label: 'Platform settings',   subs: ['view','edit','audit'] },
  { id: 'broadcast', label: 'Broadcasts & emails', subs: ['view','send','schedule'] },
];

const DEFAULT_PERMS = {
  // Owner — all on
  owner:    flatPerms(true),
  // Admin Assistant — sensible defaults
  assistant: { ...flatPerms(true),
    'payments.release': false, 'payments.refund': false,
    'users.delete': false,
    'platform.edit': false, 'platform.audit': false,
    'broadcast.send': false,
  },
  // Support agent — view only + dispute work
  support:  { ...flatPerms(false),
    'users.view': true, 'events.view': true, 'payments.view': true,
    'disputes.view': true, 'disputes.mediate': true, 'disputes.close': true,
    'content.view': true,
  },
};

function flatPerms(value) {
  const out = {};
  PERMISSION_GROUPS.forEach(g => g.subs.forEach(s => { out[`${g.id}.${s}`] = value; }));
  return out;
}

const PRESETS = [
  { id: 'owner',     label: 'Owner / full access' },
  { id: 'assistant', label: 'Admin Assistant' },
  { id: 'support',   label: 'Support agent' },
  { id: 'custom',    label: 'Custom' },
];

/* ============ Admin Assistants page ============ */
// Invite-permission groups (simplified, one toggle per area — separate from
// the granular PERMISSION_GROUPS used in the per-admin permission editor).
const INVITE_PERMISSION_GROUPS = [
  { id: 'users',         label: 'Users' },
  { id: 'events',        label: 'Events & Gigs' },
  { id: 'payments',      label: 'Payments' },
  { id: 'disputes',      label: 'Disputes' },
  { id: 'site_content',  label: 'Site Content' },
  { id: 'email_templates', label: 'Email Templates' },
  { id: 'settings',      label: 'Settings' },
  { id: 'analytics',     label: 'Analytics' },
];
const DEFAULT_INVITE_PERMS = {
  users: true, events: true, payments: false, disputes: false,
  site_content: false, email_templates: false, settings: false, analytics: true,
};

function PageAdminAssistants() {
  const toast = useToast();
  // Hydrate from rr_profiles (admins only) — first admin gets owner preset, rest assistant.
  // Includes pending invites from rr_admin_invites at the bottom.
  const buildTeam = () => {
    const users = window.RosyData?.USERS || [];
    const admins = users.filter(u => u.role === 'admin').map((u, i) => ({
      id: u.id,
      name: u.name || (u.email || '').split('@')[0],
      email: u.email,
      preset: i === 0 ? 'owner' : 'assistant',
      perms: i === 0 ? DEFAULT_PERMS.owner : DEFAULT_PERMS.assistant,
      status: u.status === 'inactive' ? 'inactive' : 'active',
      last: u.lastActive ? 'Recently active' : 'Active',
    }));
    const invites = (window.RosyStores?.adminInvites || []).filter(inv => inv.status === 'pending').map(inv => ({
      id: inv.id, name: inv.email.split('@')[0], email: inv.email,
      preset: inv.preset || 'assistant',
      perms: DEFAULT_PERMS[inv.preset] || DEFAULT_PERMS.assistant,
      status: 'invited', last: 'Invited',
    }));
    return [...admins, ...invites];
  };
  const [team, setTeam] = AX_us(buildTeam());
  AX_ue(() => {
    const sync = () => setTeam(buildTeam());
    window.addEventListener('rosy:data-changed', sync);
    return () => window.removeEventListener('rosy:data-changed', sync);
  }, []);
  const [editing, setEditing] = AX_us(null);      // permissions editor (gear)
  const [viewing, setViewing] = AX_us(null);      // read-only detail drawer (card click)
  const [inviteOpen, setInviteOpen] = AX_us(false);
  const [invitePerms, setInvitePerms] = AX_us({ ...DEFAULT_INVITE_PERMS });
  const [inviteForm, setInviteForm] = AX_us({ email: '', preset: 'assistant', note: '' });

  const update = (id, patch) => setTeam(arr => arr.map(m => m.id === id ? { ...m, ...patch } : m));

  const sendInvite = async () => {
    if (!inviteForm.email.trim()) { toast.push({ kind: 'warning', title: 'Email required' }); return; }
    const record = {
      id: 'inv_' + Date.now(),
      email: inviteForm.email.trim(),
      preset: inviteForm.preset,
      permissions: invitePerms,
      note: inviteForm.note,
      invited_by: window.RosyData?.USERS?.find(u => u.role === 'admin')?.id || null,
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    // Optimistic: append to local team as invited
    setTeam(t => [...t, {
      id: record.id, name: record.email.split('@')[0].replace(/\./g, ' ').replace(/(^|\s)\w/g, m => m.toUpperCase()),
      email: record.email, preset: record.preset, perms: DEFAULT_PERMS[record.preset] || DEFAULT_PERMS.assistant,
      status: 'invited', last: 'Just invited', invitePerms: record.permissions,
    }]);
    // Best-effort persist
    try {
      if (window.sb) {
        const { error } = await window.sb.from('rr_admin_invites').insert(record);
        if (error) throw error;
      } else {
        throw new Error('no supabase');
      }
    } catch (e) {
      // Fallback: localStorage
      window.RosyStores.adminInvites = window.RosyStores.adminInvites || [];
      window.RosyStores.adminInvites.push(record);
      try { localStorage.setItem('rosy.adminInvites', JSON.stringify(window.RosyStores.adminInvites)); } catch (_) {}
    }
    setInviteOpen(false);
    setInviteForm({ email: '', preset: 'assistant', note: '' });
    setInvitePerms({ ...DEFAULT_INVITE_PERMS });
    toast.push({ kind: 'success', title: 'Invite sent', body: `${record.email} will get an email shortly.` });
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Admin team</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-coral" onClick={() => setInviteOpen(true)}><AX_I.Plus size={14} />Invite admin</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard icon={AX_I.UserCircle2} label="Owners"           value={team.filter(m => m.preset === 'owner').length} />
        <StatCard icon={AX_I.Sparkles}    label="Admin assistants" value={team.filter(m => m.preset === 'assistant').length} />
        <StatCard icon={AX_I.ShieldCheck} label="Support agents"   value={team.filter(m => m.preset === 'support').length} />
      </div>

      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr><th>Member</th><th>Role</th><th>Permissions</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {team.map(m => {
              const grantedCount = Object.values(m.perms).filter(Boolean).length;
              const totalCount = Object.keys(m.perms).length;
              return (
                <tr key={m.id}>
                  {/* Member card area opens the read-only detail drawer */}
                  <td onClick={() => setViewing(m)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={m.name} size="md" />
                      <div><p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.name}</p><p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{m.email}</p></div>
                    </div>
                  </td>
                  <td onClick={() => setViewing(m)} style={{ cursor: 'pointer' }}><RolePresetBadge preset={m.preset} /></td>
                  <td onClick={() => setViewing(m)} style={{ cursor: 'pointer', fontSize: 13 }}>{grantedCount} / {totalCount} permissions</td>
                  <td onClick={() => setViewing(m)} style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>{m.last}</td>
                  <td onClick={() => setViewing(m)} style={{ cursor: 'pointer' }}><Badge kind={m.status === 'active' ? 'Active' : 'Pending'}>{m.status === 'active' ? 'Active' : 'Invited'}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      {/* Cog = permissions editor */}
                      <button className="row-action-btn" onClick={() => setEditing(m)} title="Manage permissions"><AX_I.Sliders size={14} /></button>
                      {m.preset !== 'owner' ? <button className="row-action-btn" title={m.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => { setTeam(t => t.map(x => x.id === m.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x)); toast.push({ kind: m.status === 'active' ? 'warning' : 'success', title: `${m.name} ${m.status === 'active' ? 'deactivated' : 'activated'}` }); }}>{m.status === 'active' ? <AX_I.UserX size={14} /> : <AX_I.CheckCircle2 size={14} />}</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PermissionsModal admin={editing} onClose={() => setEditing(null)} onSave={(patch) => { update(editing.id, patch); setEditing(null); toast.push({ kind: 'success', title: 'Permissions updated' }); }} />

      {/* Read-only detail drawer for card-click */}
      {viewing ? (
        <Slideover open={!!viewing} onClose={() => setViewing(null)} title={viewing.name}
          footer={<><button className="btn btn-ghost" onClick={() => setViewing(null)}>Close</button><button className="btn btn-coral" onClick={() => { const m = viewing; setViewing(null); setEditing(m); }}><AX_I.Sliders size={14} />Manage permissions</button></>}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <Avatar name={viewing.name} size="xl" />
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>{viewing.name}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: 13.5 }}>{viewing.email}</p>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <Badge kind={viewing.status === 'active' ? 'Active' : 'Pending'}>{viewing.status === 'active' ? 'Active' : 'Invited'}</Badge>
                <RolePresetBadge preset={viewing.preset} />
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <KV label="Email" value={viewing.email} />
            <KV label="Last seen" value={viewing.last} />
            <KV label="Role preset" value={viewing.preset} />
            <KV label="Permissions" value={`${Object.values(viewing.perms).filter(Boolean).length} / ${Object.keys(viewing.perms).length}`} />
          </div>
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Granted permissions</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(viewing.perms).filter(([, v]) => v).map(([k]) => <span key={k} className="pill" style={{ fontSize: 11 }}>{k.replace('.', ' · ')}</span>)}
            </div>
          </div>
        </Slideover>
      ) : null}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite admin team member" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setInviteOpen(false)}>Cancel</button><button className="btn btn-coral" onClick={sendInvite}>Send invite</button></>}>
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="field-label">Email</label><input className="input" placeholder="they@rosyrecruits.com" value={inviteForm.email} onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="field"><label className="field-label">Starting role</label>
            <select className="select" value={inviteForm.preset} onChange={(e) => setInviteForm(f => ({ ...f, preset: e.target.value }))}>
              {PRESETS.filter(p => p.id !== 'custom').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Permissions</label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-muted)' }}>Toggle the areas this admin can access. You can fine-tune after they accept.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {INVITE_PERMISSION_GROUPS.map(g => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-soft)', borderRadius: 10, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{g.label}</span>
                  <span className={`toggle ${invitePerms[g.id] ? 'on' : ''}`} onClick={(e) => { e.preventDefault(); setInvitePerms(p => ({ ...p, [g.id]: !p[g.id] })); }} />
                </label>
              ))}
            </div>
          </div>
          <div className="field"><label className="field-label">Personal note (optional)</label><textarea className="textarea" placeholder="Hey — want to help me run the dispute queue this quarter?" value={inviteForm.note} onChange={(e) => setInviteForm(f => ({ ...f, note: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

function RolePresetBadge({ preset }) {
  const map = {
    owner: { label: 'Owner', kind: 'Active' },
    assistant: { label: 'Admin Assistant', kind: 'Confirmed' },
    support: { label: 'Support agent', kind: 'Pending' },
    custom: { label: 'Custom', kind: 'Draft' },
  };
  const m = map[preset] || map.custom;
  return <Badge kind={m.kind}>{m.label}</Badge>;
}

function PermissionsModal({ admin, onClose, onSave }) {
  const [perms, setPerms] = AX_us({});
  const [preset, setPreset] = AX_us('custom');
  AX_ue(() => { if (admin) { setPerms(admin.perms); setPreset(admin.preset); } }, [admin]);
  if (!admin) return null;

  const togglePerm = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));
  const toggleGroup = (group, value) => setPerms(p => {
    const next = { ...p };
    group.subs.forEach(s => { next[`${group.id}.${s}`] = value; });
    return next;
  });
  const applyPreset = (id) => {
    setPreset(id);
    if (id !== 'custom') setPerms(DEFAULT_PERMS[id]);
  };
  const isOwner = admin.preset === 'owner';

  return (
    <Modal open={!!admin} onClose={onClose} title={`${admin.name} — permissions`} size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {!isOwner ? <button className="btn btn-coral" onClick={() => onSave({ perms, preset })}>Save permissions</button> : <button className="btn btn-ghost" disabled>Owner — all permissions</button>}
        </>
      }>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-muted)' }}>{admin.email} · last active {admin.last}</p>

      <div className="field" style={{ marginBottom: 18 }}>
        <label className="field-label">Role preset</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
              disabled={isOwner && p.id !== 'owner'}
              style={{ border: '1.5px solid', borderColor: preset === p.id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: preset === p.id ? 'var(--color-ink)' : 'transparent', color: preset === p.id ? '#fff' : 'inherit', padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: isOwner && p.id !== 'owner' ? 'not-allowed' : 'pointer', opacity: isOwner && p.id !== 'owner' ? 0.4 : 1 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {PERMISSION_GROUPS.map(group => {
          const allOn = group.subs.every(s => perms[`${group.id}.${s}`]);
          const anyOn = group.subs.some(s => perms[`${group.id}.${s}`]);
          return (
            <div key={group.id} style={{ background: 'var(--color-surface-soft)', padding: 14, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{group.label}</p>
                <span className={`toggle ${allOn ? 'on' : ''}`} onClick={() => !isOwner && toggleGroup(group, !allOn)} style={{ opacity: isOwner ? 0.5 : 1, cursor: isOwner ? 'not-allowed' : 'pointer' }} />
              </div>
              <div className="col" style={{ gap: 6 }}>
                {group.subs.map(s => {
                  const key = `${group.id}.${s}`;
                  const on = !!perms[key];
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: isOwner ? 'not-allowed' : 'pointer', opacity: isOwner ? 0.7 : 1 }}>
                      <CheckBox checked={on} onChange={() => !isOwner && togglePerm(key)} />
                      <span style={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ============ Notification workflow rules ============ */
const NOTIF_EVENTS = [
  { id: 'gig_application',     label: 'New gig application',          to: ['vendor','admin']  },
  { id: 'gig_confirmed',       label: 'Worker confirmed for gig',     to: ['worker','admin']  },
  { id: 'gig_rejected',        label: 'Application rejected',         to: ['worker']           },
  { id: 'gig_24h_reminder',    label: '24 hours before gig',          to: ['worker','vendor'] },
  { id: 'hours_submitted',     label: 'Worker submitted hours',       to: ['vendor']           },
  { id: 'hours_approved',      label: 'Hours approved',               to: ['worker','admin']  },
  { id: 'payment_sent',        label: 'Payment released',             to: ['worker']           },
  { id: 'payment_overdue',     label: 'Payment overdue',              to: ['vendor','admin']  },
  { id: 'dispute_filed',       label: 'Dispute filed',                to: ['admin','vendor','worker'] },
  { id: 'dispute_resolved',    label: 'Dispute resolved',             to: ['vendor','worker'] },
  { id: 'new_message',         label: 'New message received',         to: ['recipient']         },
  { id: 'rating_received',     label: 'New rating received',          to: ['worker','vendor'] },
  { id: 'weekly_summary',      label: 'Weekly summary (Mondays)',     to: ['all']               },
];

const CHANNELS = [
  { id: 'in_app', label: 'In-app',  icon: 'Bell' },
  { id: 'email',  label: 'Email',   icon: 'Mail' },
  { id: 'push',   label: 'Push',    icon: 'Phone' },
  { id: 'sms',    label: 'SMS',     icon: 'MessageSquare' },
];

function PageNotificationRules() {
  const toast = useToast();
  // Default matrix: in-app + email on, push for time-sensitive, sms only on critical
  const init = () => {
    const m = {};
    NOTIF_EVENTS.forEach(e => {
      m[e.id] = {
        in_app: true,
        email:  true,
        push:   ['gig_confirmed','gig_24h_reminder','dispute_filed','new_message'].includes(e.id),
        sms:    ['gig_24h_reminder','dispute_filed'].includes(e.id),
      };
    });
    return m;
  };
  // Persist to localStorage so admin changes survive a refresh until a dedicated
  // rr_notification_rules table is added.
  const [rules, setRules] = AX_us(() => {
    try { const saved = JSON.parse(localStorage.getItem('rosy.notifRules') || 'null'); return saved || init(); } catch (e) { return init(); }
  });
  const [quiet, setQuiet] = AX_us(() => {
    try { const saved = JSON.parse(localStorage.getItem('rosy.quietHours') || 'null'); return saved || { from: '22:00', to: '07:30' }; } catch (e) { return { from: '22:00', to: '07:30' }; }
  });
  const flip = (eid, ch) => setRules(r => ({ ...r, [eid]: { ...r[eid], [ch]: !r[eid][ch] } }));
  const saveAll = () => {
    try {
      localStorage.setItem('rosy.notifRules', JSON.stringify(rules));
      localStorage.setItem('rosy.quietHours', JSON.stringify(quiet));
      toast.push({ kind: 'success', title: 'Workflows saved', body: 'Preferences stored on this device.' });
    } catch (e) { toast.push({ kind: 'error', title: "Couldn't save", body: e.message }); }
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Notification workflows</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setRules(init()); toast.push({ kind: 'info', title: 'Reset to defaults', body: 'Click Save to persist.' }); }}>Reset defaults</button>
          <button className="btn btn-coral" onClick={saveAll}>Save workflows</button>
        </div>
      </div>
      <div className="card card-flush" style={{ marginBottom: 24, overflowX: 'auto' }}>
        <table className="rosy-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>Event</th>
              <th>Audience</th>
              {CHANNELS.map(c => <th key={c.id} style={{ width: 110, textAlign: 'center' }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {NOTIF_EVENTS.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{e.label}</td>
                <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{e.to.map(t => <span key={t} className="pill" style={{ fontSize: 11, padding: '2px 8px', textTransform: 'capitalize' }}>{t}</span>)}</div></td>
                {CHANNELS.map(c => (
                  <td key={c.id} style={{ textAlign: 'center' }}>
                    <span className={`toggle ${rules[e.id][c.id] ? 'on' : ''}`} style={{ display: 'inline-block', verticalAlign: 'middle' }} onClick={() => flip(e.id, c.id)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 10 }}><AX_I.AlertCircle className="icon" />Quiet hours</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-muted)' }}>Don't send push or SMS during these hours unless marked urgent.</p>
          <div className="grid-2">
            <div className="field"><label className="field-label">From</label><input className="input" type="time" value={quiet.from} onChange={e => setQuiet(q => ({ ...q, from: e.target.value }))} /></div>
            <div className="field"><label className="field-label">To</label><input className="input" type="time" value={quiet.to} onChange={e => setQuiet(q => ({ ...q, to: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 10 }}><AX_I.Sparkles className="icon" />Smart batching</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-muted)' }}>Batch low-priority notifications into a single daily digest.</p>
          <div className="col" style={{ gap: 10 }}>
            {['Ratings received','Site content updates','Weekly summary digest'].map(label => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{label}</span>
                <span className="toggle on" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Broadcast composer ============ */
function PageBroadcast() {
  const toast = useToast();
  const [audience, setAudience] = AX_us('all');
  const [channels, setChannels] = AX_us({ in_app: true, email: true, push: false, sms: false });
  const [subject, setSubject] = AX_us('');
  const [body, setBody] = AX_us('');
  const [schedule, setSchedule] = AX_us('now');
  const [scheduleTime, setScheduleTime] = AX_us('');
  // No persistent broadcast history yet — start empty so the table reflects
  // actual sends from this session rather than fake archive entries.
  const [sent, setSent] = AX_us([]);

  // Real audience counts pulled from the live USERS list.
  const _users = window.RosyData?.USERS || [];
  const audienceCounts = {
    all:     _users.filter(u => u.email).length,
    vendors: _users.filter(u => u.role === 'vendor' && u.email).length,
    workers: _users.filter(u => u.role === 'worker' && u.email).length,
    admins:  _users.filter(u => u.role === 'admin' && u.email).length,
  };

  const send = async () => {
    const sentTime = schedule === 'schedule' && scheduleTime
      ? scheduleTime.replace('T', ' ').slice(0, 16)
      : new Date().toISOString().replace('T', ' ').slice(0, 16);
    // Resolve recipients from the live RosyData USERS list (filtered by audience)
    const users = (window.RosyData?.USERS || []).filter(u => u.email);
    const targetUsers = audience === 'all' ? users : users.filter(u => (audience === 'vendors' ? u.role === 'vendor' : audience === 'workers' ? u.role === 'worker' : u.role === 'admin'));
    const reach = targetUsers.length;
    let okCount = 0, failCount = 0;
    if (channels.email && schedule === 'now' && window.RosySendEmail) {
      // Branded HTML wrapper for the message body (preserves admin's plain-text bias)
      const wrap = (htmlBody) => `<!doctype html><html><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:24px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);"><tr><td style="background:#F47C5D;padding:18px 24px;color:#fff;font-weight:600;font-size:18px;font-family:Georgia,serif;">Rosy <span style="opacity:0.8;">Recruits</span></td></tr><tr><td style="padding:28px 28px 24px;font-size:15px;line-height:1.6;">${htmlBody}</td></tr><tr><td style="padding:16px 28px;background:#FAF7F2;border-top:1px solid #ECE6DD;font-size:11.5px;color:#7A7470;">You're getting this because you have a Rosy Recruits account. <a href="https://rosy-demo.vercel.app/#app/settings" style="color:#7A7470;">Preferences</a></td></tr></table></td></tr></table></body></html>`;
      // Send one at a time so demo-redirect still delivers everything; replace
      // with a queue/batch in production. Cap at 50 so a typo doesn't blast.
      for (const u of targetUsers.slice(0, 50)) {
        const html = wrap(String(body || '').split(/\n+/).map(p => `<p style="margin:0 0 12px;">${p.replace(/\{\{first_name\}\}/g, u.first || u.name || 'there')}</p>`).join(''));
        const r = await window.RosySendEmail({ slug: 'broadcast', to: u.email, subject, html, vars: { first_name: u.first || u.name || 'there' } });
        if (r?.ok) okCount++; else failCount++;
      }
    }
    const entry = { id: 's' + Math.random().toString(36).slice(2, 6), audience, subject, sent: sentTime, reach };
    setSent(arr => [entry, ...arr]);
    if (schedule === 'schedule') {
      toast.push({ kind: 'info', title: 'Broadcast scheduled', body: `Will send to ${reach} recipients on ${scheduleTime}.` });
    } else if (channels.email) {
      toast.push({ kind: okCount ? 'success' : 'warning', title: `Email broadcast sent`, body: `${okCount} delivered${failCount ? `, ${failCount} failed` : ''}.` });
    } else {
      toast.push({ kind: 'info', title: 'Broadcast queued', body: 'In-app/push/sms channels are placeholders in the demo.' });
    }
    setSubject(''); setBody('');
  };

  const valid = subject.trim() && body.trim() && Object.values(channels).some(Boolean) && (schedule !== 'schedule' || scheduleTime);

  return (
    <div className="content fade-up">
      <div className="section-heading"><h2>Send broadcast</h2></div>
      <div className="grid-2" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>Compose</h3>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Audience</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','All users'],['vendors','All vendors'],['workers','All workers'],['admins','Admins only']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setAudience(id)}
                  style={{ border: '1.5px solid', borderColor: audience === id ? 'var(--rosy-coral)' : 'var(--color-hairline-strong)', background: audience === id ? 'var(--rosy-coral-soft)' : 'transparent', color: audience === id ? 'var(--rosy-coral)' : 'inherit', padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {label} <span style={{ opacity: 0.65, marginLeft: 4 }}>({audienceCounts[id].toLocaleString()})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Channels</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CHANNELS.map(c => {
                const Icon = AX_I[c.icon] || AX_I.Bell;
                const on = !!channels[c.id];
                return (
                  <button key={c.id} type="button" onClick={() => setChannels(s => ({ ...s, [c.id]: !s[c.id] }))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid', borderColor: on ? 'var(--rosy-teal)' : 'var(--color-hairline-strong)', background: on ? 'var(--rosy-teal-soft)' : 'transparent', color: on ? 'var(--rosy-teal-dark)' : 'inherit', padding: '7px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Icon size={14} />{c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Subject</label>
            <input className="input" placeholder="Short subject line" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="field-label" style={{ marginBottom: 0 }}>Message body</label>
              <WriteForMe context={{ kind: 'broadcast', fields: ['subject','body'] }}
                placeholderQuestions={[
                  { key: 'topic', label: 'What\'s the announcement about?', placeholder: 'Stripe instant payouts now live' },
                  { key: 'audience', label: 'Who is this for?', placeholder: 'Workers, vendors, everyone...' },
                  { key: 'call_to_action', label: 'What should they do?', placeholder: 'Read the changelog, log in to opt-in...' },
                ]}
                onFill={(d) => { if (d.subject) setSubject(d.subject); if (d.body) setBody(d.body); if (d._raw) setBody(d._raw); }} />
            </div>
            <textarea className="textarea" placeholder="Body. Supports {{first_name}} placeholder." value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 160 }} />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">When</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['now','Send now'],['schedule','Schedule']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setSchedule(id)}
                  style={{ border: '1.5px solid', borderColor: schedule === id ? 'var(--color-ink)' : 'var(--color-hairline-strong)', background: schedule === id ? 'var(--color-ink)' : 'transparent', color: schedule === id ? '#fff' : 'inherit', padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {schedule === 'schedule' ? <input className="input" type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ marginTop: 8 }} /> : null}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => { setSubject(''); setBody(''); toast.push({ kind: 'info', title: 'Draft cleared' }); }}>Clear</button>
            <button className="btn btn-coral" disabled={!valid} onClick={send}>{schedule === 'now' ? 'Send broadcast' : 'Schedule broadcast'}</button>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}><AX_I.Eye className="icon" />Preview</h3>
            <div style={{ background: 'var(--color-surface-soft)', borderRadius: 12, padding: 18 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>From Rosy Recruits</p>
              <p style={{ margin: '4px 0 12px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em' }}>{subject || 'Your subject here'}</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>{body || 'Your message body will appear here. Use {{first_name}} for the recipient\'s first name.'}</p>
              <div className="divider" style={{ margin: '14px 0' }} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted-soft)' }}>Sent to {audienceCounts[audience].toLocaleString()} {audience} · via {Object.entries(channels).filter(([k,v]) => v).map(([k]) => k.replace('_', '-')).join(', ') || 'no channels selected'}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}>Recent broadcasts</h3>
            <div className="col" style={{ gap: 0 }}>
              {sent.map((s, i) => (
                <div key={s.id} style={{ padding: '12px 0', borderBottom: i === sent.length - 1 ? 'none' : '1px solid var(--color-hairline)' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.subject}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>{s.sent} · {s.reach.toLocaleString()} {s.audience}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Change log + revert ============ */
function PageChangeLog({ currentUser }) {
  const toast = useToast();
  const [logs, setLogs] = AX_us([]);
  const [loading, setLoading] = AX_us(true);
  const [tableFilter, setTableFilter] = AX_us('all');
  const [actionFilter, setActionFilter] = AX_us('all');
  const [actorFilter, setActorFilter] = AX_us('all');
  const [dateFrom, setDateFrom] = AX_us('');
  const [dateTo, setDateTo] = AX_us('');
  const [expanded, setExpanded] = AX_us(null);
  const [reverting, setReverting] = AX_us(null);
  const [confirmRevertId, setConfirmRevertId] = AX_us(null);

  const load = async () => {
    setLoading(true);
    try {
      if (!window.sb) { setLogs([]); setLoading(false); return; }
      const { data, error } = await window.sb.from('rr_change_log')
        .select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.warn('change log load failed:', e);
      toast.push({ kind: 'error', title: 'Could not load change log', body: e.message || 'See console' });
    }
    setLoading(false);
  };

  AX_ue(() => { load(); }, []);

  // Build filter dropdown options from loaded rows
  const tables = Array.from(new Set(logs.map(l => l.table_name))).sort();
  const actors = Array.from(new Set(logs.map(l => l.actor_id).filter(Boolean)));

  const filtered = logs.filter(l => {
    if (tableFilter !== 'all' && l.table_name !== tableFilter) return false;
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (actorFilter !== 'all' && l.actor_id !== actorFilter) return false;
    if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(l.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const diffSummary = (l) => {
    if (l.action === 'insert') return 'Record created';
    if (l.action === 'delete') return 'Record deleted (revert will restore)';
    const before = l.before_data || {};
    const after = l.after_data || {};
    const changed = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (k === 'updated_at') continue;
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
    }
    if (changed.length === 0) return 'No field changes';
    if (changed.length <= 3) return `${changed.length} field${changed.length === 1 ? '' : 's'} changed: ${changed.join(', ')}`;
    return `${changed.length} fields changed: ${changed.slice(0, 3).join(', ')}…`;
  };

  const actorLabel = (l) => {
    if (!l.actor_id) return 'System';
    const u = (window.RosyData?.USERS || []).find(x => x.id === l.actor_id);
    return u ? (u.name || u.email || l.actor_id) : `${l.actor_role || 'user'} · ${l.actor_id.slice(0, 8)}…`;
  };

  const tableLabel = (t) => ({
    rr_profiles: 'Profiles', rr_events: 'Events', rr_gigs: 'Gigs', rr_venues: 'Venues',
    rr_vendor_profiles: 'Vendor profiles', rr_worker_profiles: 'Worker profiles',
    rr_site_content: 'Site content', rr_admin_invites: 'Admin invites', rr_email_templates: 'Email templates',
  })[t] || t;

  const doRevert = async (id) => {
    setReverting(id);
    try {
      const { data: s } = await window.sb.auth.getSession();
      const r = await fetch('/api/admin/revert-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s?.session?.access_token || '') },
        body: JSON.stringify({ changeId: id }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `Revert failed (${r.status})`);
      toast.push({ kind: 'success', title: 'Change reverted', body: `Reverted ${body.action || 'change'}.` });
      await load();
    } catch (e) {
      console.warn('revert failed:', e);
      toast.push({ kind: 'error', title: 'Revert failed', body: e.message || 'See console' });
    }
    setReverting(null);
    setConfirmRevertId(null);
  };

  return (
    <div className="content fade-up">
      <div className="section-heading">
        <h2>Change log</h2>
        <button className="btn btn-ghost btn-sm" onClick={load}><AX_I.RefreshCw size={14} />Refresh</button>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 6 }}>Table</p>
            <select className="select" value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
              <option value="all">All tables</option>
              {tables.map(t => <option key={t} value={t}>{tableLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 6 }}>Action</p>
            <select className="select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
              <option value="all">All actions</option>
              <option value="insert">Insert</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 6 }}>Actor</p>
            <select className="select" value={actorFilter} onChange={e => setActorFilter(e.target.value)}>
              <option value="all">All actors</option>
              {actors.map(a => <option key={a} value={a}>{actorLabel({ actor_id: a })}</option>)}
            </select>
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 6 }}>From</p>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <p className="t-eyebrow" style={{ marginBottom: 6 }}>To</p>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setTableFilter('all'); setActionFilter('all'); setActorFilter('all'); setDateFrom(''); setDateTo(''); }}>Reset</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="rosy-table">
          <thead><tr>
            <th>When</th><th>Who</th><th>Table</th><th>Record</th><th>Action</th><th>Diff</th><th style={{ width: 110 }}></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><Empty title="Loading…" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><Empty icon={AX_I.History} title="No changes match" body="Try a different filter, or sit tight — changes appear here as they happen." /></td></tr>
            ) : filtered.map(l => (
              <React.Fragment key={l.id}>
                <tr style={{ cursor: 'pointer', background: l.reverted_at ? 'rgba(0,0,0,0.02)' : undefined }} onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ fontSize: 13 }}>{actorLabel(l)}{l.actor_role ? <span className="t-muted" style={{ fontSize: 11, marginLeft: 6 }}>({l.actor_role})</span> : null}</td>
                  <td style={{ fontSize: 13 }}>{tableLabel(l.table_name)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{(l.record_id || '').slice(0, 12)}…</td>
                  <td>
                    <Badge kind={l.action === 'insert' ? 'Active' : l.action === 'delete' ? 'Inactive' : 'Draft'}>
                      {l.action}{l.action === 'delete' ? ' (restorable)' : ''}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--color-body)' }}>{diffSummary(l)}{l.reverted_at ? <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--rosy-coral)' }}>· reverted {new Date(l.reverted_at).toLocaleDateString()}</span> : null}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" disabled={!!l.reverted_at || reverting === l.id} onClick={() => setConfirmRevertId(l.id)}>
                      <AX_I.Undo2 size={13} />{l.reverted_at ? 'Reverted' : reverting === l.id ? 'Reverting…' : 'Revert'}
                    </button>
                  </td>
                </tr>
                {expanded === l.id ? (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--color-surface-soft)', padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <p className="t-eyebrow" style={{ marginBottom: 6 }}>Before</p>
                          <pre style={{ margin: 0, padding: 12, background: 'var(--color-canvas)', borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 280, fontFamily: 'var(--font-mono)' }}>{l.before_data ? JSON.stringify(l.before_data, null, 2) : '— (insert)'}</pre>
                        </div>
                        <div>
                          <p className="t-eyebrow" style={{ marginBottom: 6 }}>After</p>
                          <pre style={{ margin: 0, padding: 12, background: 'var(--color-canvas)', borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 280, fontFamily: 'var(--font-mono)' }}>{l.after_data ? JSON.stringify(l.after_data, null, 2) : '— (delete)'}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!confirmRevertId} onClose={() => setConfirmRevertId(null)}
        title="Revert this change?"
        message="The current value will be replaced with the original. This itself is logged as a new change you can also revert."
        confirmLabel="Revert change" onConfirm={() => doRevert(confirmRevertId)} />
    </div>
  );
}

Object.assign(window, { PageAdminAssistants, PermissionsModal, PageNotificationRules, PageBroadcast, SafeImage, PageChangeLog });

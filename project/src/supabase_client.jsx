/* Supabase hydrator — fetches all rr_* tables on boot and replaces window.RosyData
   with live data, keeping the same shape the screens expect. Falls back to seed
   data on error so the app always renders. Configure via window.SUPABASE_CONFIG. */

window.SUPABASE_CONFIG = {
  url: 'https://vwweyepknzgruobadlwf.supabase.co',
  anonKey: 'sb_publishable_ilFDBPmFOsPy9xswDmIIhQ_9R5IFPzm',
};

(function initClient() {
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('Supabase JS not loaded — staying on seed data.');
    return;
  }
  window.sb = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey,
    { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rosy.auth' } }
  );
})();

/* ---------- helpers ---------- */
function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60)        return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)        return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30)        return `${d}d ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

function dayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString())     return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function timeLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function statusForUI(s) {
  // Map DB enums to the seed's UI-facing labels
  if (s === 'filled')  return 'confirmed';
  return s;
}

function paymentStatusForUI(s) {
  if (!s) return 'Pending';
  if (s === 'late')      return 'Late';
  if (s === 'disputed')  return 'Disputed';
  if (s === 'paid')      return 'Paid';
  if (s === 'pending')   return 'Pending';
  if (s === 'not_due')   return 'Not Due';
  if (s === 'processing')return 'Processing';
  if (s === 'refunded')  return 'Refunded';
  if (s === 'partial')   return 'Partial';
  return capitalize(s);
}

/* ---------- single-table fetchers (parallelizable) ---------- */
async function fetchAll(table, options = {}) {
  const { select = '*', orderBy } = options;
  let q = window.sb.from(table).select(select);
  if (orderBy) q = q.order(orderBy.col, { ascending: orderBy.asc !== false });
  const { data, error } = await q;
  if (error) { console.warn(`[supabase] ${table} fetch error:`, error.message); return []; }
  return data || [];
}

/* ---------- address helpers ---------- */
// Normalise the jsonb array stored on rr_worker_profiles.addresses. Accepts
// legacy "string[]" rows and converts each entry to the structured shape.
// Returns [] when input is null/empty.
function normalizeAddresses(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((a, i) => {
    if (typeof a === 'string') {
      return { id: 'addr_legacy_' + i, label: 'Home', address: a, city: '', state: '', country: '', lat: null, lng: null, start_date: null, end_date: null, is_default: i === 0 };
    }
    return {
      id: a.id || ('addr_' + Math.random().toString(36).slice(2, 9)),
      label: a.label || (a.is_default ? 'Home' : 'Travel'),
      address: a.address || '',
      city: a.city || '',
      state: a.state || '',
      country: a.country || '',
      lat: a.lat ?? null,
      lng: a.lng ?? null,
      start_date: a.start_date || null,
      end_date: a.end_date || null,
      is_default: a.is_default === true,
    };
  });
}

// Return the worker's effective address for today (or a given ISO date).
// Priority: an address with start_date <= date <= end_date wins. Falls back
// to the address marked is_default, then to the first entry.
function effectiveWorkerAddress(addresses, isoDate) {
  const list = normalizeAddresses(addresses);
  if (list.length === 0) return null;
  const today = (isoDate || new Date().toISOString().slice(0, 10));
  const active = list.find(a => a.start_date && a.end_date && a.start_date <= today && today <= a.end_date);
  if (active) return active;
  return list.find(a => a.is_default) || list[0];
}

// Expose to other modules so the gigs page + profile card can use them.
window.normalizeAddresses = normalizeAddresses;
window.effectiveWorkerAddress = effectiveWorkerAddress;

/* ---------- transforms ---------- */
function buildUsers(profiles, vendors, workers) {
  const vById = Object.fromEntries(vendors.map(v => [v.id, v]));
  const wById = Object.fromEntries(workers.map(w => [w.id, w]));
  return profiles.map(p => {
    const v = vById[p.id];
    const w = wById[p.id];
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || (p.email || '').split('@')[0];
    const cityFmt = p.city ? `${p.city}, ${p.state || ''}`.replace(/, $/, '') : null;
    return {
      id:      p.id,
      name,
      first:   p.first_name || name.split(' ')[0],
      last:    p.last_name  || '',
      email:   p.email,
      role:    p.role,
      photo:   p.avatar_url || v?.logo_url || null,
      phone:   p.phone || v?.business_phone || null,
      title:   p.title || null,
      bio:     p.bio || v?.business_description || null,
      description: p.description || v?.business_description || null,
      company: v?.company_name || p.title || (p.role === 'admin' ? 'Rosy Recruits' : null),
      status:  p.status || 'active',
      verified: p.verified === false ? false : (p.verified === true ? true : null),
      onboarding_complete: !!p.onboarding_complete,
      // Full ISO timestamp — fmtDate renders in the viewer's local timezone.
      // Pre-slicing to YYYY-MM-DD here caused dates to drift back a day for
      // users west of UTC because JS parses bare date strings as UTC midnight.
      joined:  p.created_at || null,
      // Address fields — keep raw + formatted so the admin edit form has separate inputs
      // while the read view can still show "City, State".
      street:  p.street || null,
      city:    p.city || null,
      cityFmt,
      state:   p.state || null,
      zip:     p.zip || null,
      geoAddress: p.geo_address || v?.business_address || null,
      websiteUrl: v?.website_url || null,
      website:    v?.website_url || null,
      businessHours: v?.business_hours || null,
      showBusinessHours: v?.show_business_hours === true,
      termsAccepted: p.terms_accepted === true,
      termsAcceptedAt: p.terms_accepted_at || null,
      vendorSignatureUrl: p.vendor_signature_url || null,
      workerSignatureUrl: p.worker_signature_url || null,
      w9Completed: p.w9_completed === true,
      w9Data: p.w9_data || null,
      emailNotifications: p.email_notifications || null,
      // Worker-specific
      hourlyRate: w?.hourly_rate ?? null,
      skills:  w?.skills || null,
      services: w?.services || null,
      // Normalise addresses to the structured shape. Legacy rows hold
      // `["123 Main St, Chicago, IL"]` (array of strings); new rows hold an
      // array of {id, label, address, city, state, country, lat, lng,
      // start_date, end_date, is_default}.
      addresses: normalizeAddresses(w?.addresses),
      // Vendor-specific
      vendorRate: v?.vendor_rate ?? null,
      businessAddress: v?.business_address || null,
      businessPhone: v?.business_phone || null,
      serviceCategories: v?.service_categories || null,
      // Shared
      rating:  v?.rating || w?.rating || null,
      gigs:    v?.gigs_completed || w?.gigs_completed || null,
    };
  });
}

function buildVenues(rows, fallbackImages) {
  return rows.map((v, i) => ({
    id:       v.id,
    name:     v.name,
    city:     v.city ? `${v.city}, ${v.state || ''}`.replace(/, $/, '') : '',
    capacity: 200, // not in schema; sensible default for the UI
    type:     v.event_types?.[0] ? capitalize(v.event_types[0]) : 'Venue',
    address:  v.address || '',
    image:    v.image_url || fallbackImages[i % fallbackImages.length],
  }));
}

function buildEvents(rows, gigs, fallbackImages) {
  const byEvent = {};
  gigs.forEach(g => {
    const e = byEvent[g.event_id] || (byEvent[g.event_id] = { count: 0, filled: 0, types: new Set() });
    e.count  += 1;
    e.filled += g.spots_filled || 0;
    if (g.gig_type) e.types.add(g.gig_type);
  });
  return rows.map((e, i) => {
    const stats = byEvent[e.id] || { count: 0, filled: 0, types: new Set() };
    return {
      id:          e.id,
      name:        e.title,
      date:        e.event_date,
      start:       (e.start_time || '').slice(0, 5),
      end:         (e.end_time   || '').slice(0, 5),
      venueId:     e.venue_id,
      vendorId:    e.vendor_id,
      image:       e.image_url || fallbackImages[i % fallbackImages.length],
      desc:        e.description || '',
      status:      e.status,
      types:       (e.gig_types && e.gig_types.length) ? e.gig_types : Array.from(stats.types),
      gigCount:    stats.count,
      filledCount: stats.filled,
    };
  });
}

function buildGigs(rows, applications) {
  // assignedTo = worker_ids of confirmed/completed applications for this gig
  const byGig = {};
  applications.forEach(a => {
    if (a.status === 'confirmed' || a.status === 'completed') {
      (byGig[a.gig_id] || (byGig[a.gig_id] = [])).push(a.worker_id);
    }
  });
  return rows.map(g => ({
    id:          g.id,
    eventId:     g.event_id,
    type:        g.gig_type,
    date:        g.gig_date,
    start:       (g.start_time || '').slice(0, 5),
    end:         (g.end_time   || '').slice(0, 5),
    spots:       g.spots_total,
    spotsFilled: g.spots_filled,
    rate:        Number(g.hourly_rate),
    priority:    capitalize(g.priority || 'medium'),
    status:      statusForUI(g.status),
    assignedTo:  byGig[g.id] || [],
    description: g.description || '',
  }));
}

function buildTransactions(applications, usersById) {
  return applications
    // Show on Payments table when there's an actual money dimension —
    // confirmed/completed app OR a payment_status that isn't the default 'not_due'.
    // A freshly-applied row (status='applied', payment_status='not_due', no
    // amount) is NOT a payment yet and shouldn't pollute the vendor's totals.
    .filter(a => {
      if (a.amount_due != null && Number(a.amount_due) > 0) return true;
      if (a.payment_status && a.payment_status !== 'not_due') return true;
      if (['confirmed', 'completed'].includes(a.status)) return true;
      return false;
    })
    .map(a => {
      const worker = usersById[a.worker_id];
      const vendor = usersById[a.vendor_id];
      return {
        id:      a.id,
        invoice: a.request_code || a.id.slice(0, 8),
        payer:   vendor?.company || vendor?.name || 'Vendor',
        payee:   worker?.name || 'Worker',
        amount:  Number(a.amount_due || a.estimated_amount || 0),
        status:  paymentStatusForUI(a.payment_status),
        date:    (a.paid_at || a.completed_at || a.confirmed_at || a.applied_at || '').slice(0, 10),
        note:    a.cancellation_reason || null,
        // Raw IDs for downstream actions (e.g. filing a dispute).
        _applicationId: a.id,
        _workerId: a.worker_id,
        _vendorId: a.vendor_id,
      };
    });
}

function buildNotifications(rows) {
  return rows.map(n => ({
    id:      n.id,
    type:    n.type,
    title:   n.title,
    body:    n.body,
    time:    timeAgo(n.created_at),
    link:    n.link || '',
    unread:  !n.read,
    _userId: n.user_id,                        // kept for per-user filtering in NotificationCenter
  }));
}

function buildMessages(conversations, messages, usersById) {
  // Stash sender_id + recipient_id raw on each message so the Inbox screen
  // can compute who="me"/"them" against the live session user at render time.
  const msgsByConv = {};
  messages.forEach(m => {
    (msgsByConv[m.conversation_id] || (msgsByConv[m.conversation_id] = [])).push(m);
  });
  Object.values(msgsByConv).forEach(arr =>
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  );

  return conversations.map(c => {
    const ms = msgsByConv[c.id] || [];
    // Default "with" = first participant that isn't the conversation starter
    const otherId = (c.participants || []).find(p => p !== c.started_by) || c.started_by;
    const other = usersById[otherId] || {};
    const last = ms[ms.length - 1];
    return {
      id:           c.id,
      with:         otherId,
      participants: c.participants || [],
      startedBy:    c.started_by,
      name:         other.name || c.subject || 'Conversation',
      online:       false,
      unread:       ms.filter(m => !m.read_at).length,
      preview:      last?.content || '',
      messages:     ms.map(m => ({
        senderId:        m.sender_id,
        recipientId:     m.recipient_id,
        text:            m.content || '',
        time:            timeLabel(m.created_at),
        day:             dayLabel(m.created_at),
        attachment_url:  m.attachment_url || null,
        attachment_name: m.attachment_name || null,
        attachment_type: m.attachment_type || null,
      })),
    };
  });
}

function buildFaqs(rows) {
  // Keep both shapes — UI expects {q, a}; admin page needs raw rr_faqs columns.
  return rows.map(f => ({
    q: f.question, a: f.answer,
    id: f.id, question: f.question, answer: f.answer,
    sort_order: f.sort_order, is_visible: f.is_visible,
    // Carry audiences through so consumer pages can filter (vendor/worker/marketing).
    audiences: Array.isArray(f.audiences) ? f.audiences : [],
    // Per-audience sort order (jsonb { vendor: 2, worker: 0, marketing: 4 }).
    audience_orders: f.audience_orders && typeof f.audience_orders === 'object' ? f.audience_orders : {},
  }));
}

function buildTestimonials(rows) {
  return rows.map(t => ({
    id: t.id, quote: t.quote, who: t.reviewer_name,
    role: t.reviewer_role || t.reviewer_company || '',
  }));
}

/* ---------- the boot ---------- */
window.bootRosyFromSupabase = async function bootRosyFromSupabase() {
  if (!window.sb) return null;
  const t0 = performance.now();
  try {
    const [
      profiles, vendors, workers, venues, events, gigs,
      applications, notifications, conversations, messages,
      faqs, testimonials,
    ] = await Promise.all([
      // Bulk read via the safe view. The base rr_profiles table is now
      // owner-or-admin-only at the RLS layer, so a SELECT * across all users
      // would only return the caller's own row. The view exposes non-sensitive
      // columns (name, role, status, avatar, city/state, bio, title) for
      // every user, but omits stripe_*, w9_*, signatures, phone, email,
      // street/zip, push tokens, etc.
      fetchAll('rr_profiles_public',  { orderBy: { col: 'created_at', asc: false } }),
      fetchAll('rr_vendor_profiles'),
      fetchAll('rr_worker_profiles'),
      fetchAll('rr_venues',           { orderBy: { col: 'name' } }),
      fetchAll('rr_events',           { orderBy: { col: 'event_date' } }),
      fetchAll('rr_gigs',             { orderBy: { col: 'gig_date' } }),
      fetchAll('rr_gig_applications', { orderBy: { col: 'created_at', asc: false } }),
      fetchAll('rr_notifications',    { orderBy: { col: 'created_at', asc: false } }),
      fetchAll('rr_conversations',    { orderBy: { col: 'last_message_at', asc: false } }),
      fetchAll('rr_messages',         { orderBy: { col: 'created_at' } }),
      fetchAll('rr_faqs',             { orderBy: { col: 'sort_order' } }),
      fetchAll('rr_testimonials',     { orderBy: { col: 'sort_order' } }),
    ]);

    if (profiles.length === 0) {
      console.warn('[supabase] No profiles returned — staying on seed.');
      return null;
    }

    const USERS = buildUsers(profiles, vendors, workers);
    const usersById = Object.fromEntries(USERS.map(u => [u.id, u]));

    const seed = window.RosyData || {};
    const live = {
      USERS,
      VENUES:        buildVenues(venues, seed.IMAGES?.events || []),
      EVENTS:        buildEvents(events, gigs, seed.IMAGES?.events || []),
      GIGS:          buildGigs(gigs, applications),
      GIG_TYPES:     seed.GIG_TYPES,                              // static
      TRANSACTIONS:  buildTransactions(applications, usersById),
      // Expose raw applications so admin / vendor screens can render applicant lists,
      // approve/reject, etc. without re-querying. Keys are snake_case from the DB.
      APPLICATIONS:  applications.map(a => ({
        id: a.id, gigId: a.gig_id, workerId: a.worker_id, vendorId: a.vendor_id,
        status: a.status, paymentStatus: a.payment_status,
        appliedAt: a.applied_at, confirmedAt: a.confirmed_at, completedAt: a.completed_at,
        hoursWorked: a.hours_worked, workerNotes: a.worker_notes, vendorNotes: a.vendor_notes,
      })),
      NOTIFICATIONS: buildNotifications(notifications),
      MESSAGES:      buildMessages(conversations, messages, usersById),
      IMAGES:        seed.IMAGES,                                 // static
      TESTIMONIALS:  testimonials.length ? buildTestimonials(testimonials) : seed.TESTIMONIALS,
      FAQS:          faqs.length          ? buildFaqs(faqs)          : seed.FAQS,
    };

    // Mutate existing window.RosyData rather than replace, so files that captured
    // `const SP_D = window.RosyData` at module load still see the live data.
    Object.assign(window.RosyData, live);
    window.__rosyDataSource = 'supabase';
    console.info(`[supabase] hydrated in ${Math.round(performance.now() - t0)}ms — ${USERS.length} users, ${live.EVENTS.length} events, ${live.GIGS.length} gigs.`);
    return live;
  } catch (e) {
    console.warn('[supabase] hydration failed, falling back to seed:', e.message);
    window.__rosyDataSource = 'seed';
    return null;
  }
};

Object.assign(window, { bootRosyFromSupabase: window.bootRosyFromSupabase });

/* ======================================================================
   RosyMutate — UI-shape ↔ DB-shape mutation helpers.
   Each helper writes to Supabase, mutates window.RosyData in place so
   other screens stay in sync, and falls back to local-only when offline.
   Returns the (live) UI-shape record on success.
   ====================================================================== */

const isLive = () => !!window.sb && window.__rosyDataSource === 'supabase';
// Block real mutations when nobody is signed in. The role-switcher demo (vendor/worker/admin tabs in
// the header) is for visual exploration only — without this guard, an anonymous visitor clicking
// "New event" or "Approve payment" would issue real INSERTs/UPDATEs against the seed Supabase rows.
const hasRealSession = () => {
  try {
    const raw = localStorage.getItem('rosy.auth');
    return !!raw && raw.includes('access_token');
  } catch (e) { return false; }
};
const guardMutation = (op) => {
  if (isLive() && !hasRealSession()) {
    console.warn('[RosyMutate]', op, 'blocked — no signed-in session (demo mode is read-only)');
    const err = new Error('Sign in to make changes. The role-switcher demo is read-only.');
    err.code = 'NOT_AUTHENTICATED';
    throw err;
  }
};

function genId(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10); }

// Replace-or-append in an array by id (in-place)
function upsertById(arr, item) {
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.unshift(item);
}
function removeById(arr, id) {
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}

// Map UI event ↔ DB rr_events
function eventUiToDb(p) {
  return {
    title:        p.name,
    description:  p.desc,
    event_date:   p.date,
    start_time:   p.start || null,
    end_time:     p.end   || null,
    venue_id:     p.venueId || null,
    vendor_id:    p.vendorId,
    location:     p.location || null,
    image_url:    p.image || null,
    status:       p.status || 'open',
    gig_types:    p.types || [],
    is_public:    p.is_public ?? true,
  };
}
function eventDbToUi(row, fallbackImages = []) {
  return {
    id:          row.id,
    name:        row.title,
    date:        row.event_date,
    start:       (row.start_time || '').slice(0, 5),
    end:         (row.end_time   || '').slice(0, 5),
    venueId:     row.venue_id,
    vendorId:    row.vendor_id,
    image:       row.image_url || fallbackImages[0] || '',
    desc:        row.description || '',
    status:      row.status,
    types:       row.gig_types || [],
    // Preserve the DB row creation timestamp — Sidebar badges use it to count
    // items added since the user's last login. Without this the count fell
    // back to event_date (a future date), so badges always stuck at 1.
    created_at:  row.created_at || null,
    gigCount:    0,
    filledCount: 0,
  };
}

function gigUiToDb(p) {
  return {
    event_id:     p.eventId,
    vendor_id:    p.vendorId,
    title:        p.title || (`${p.type} crew`),
    description:  p.description || '',
    gig_type:     p.type,
    gig_date:     p.date,
    start_time:   p.start || null,
    end_time:     p.end   || null,
    hourly_rate:  Number(p.rate || 0),
    spots_total:  Number(p.spots || 1),
    spots_filled: Number(p.spotsFilled || 0),
    status:       p.status === 'confirmed' ? 'filled' : (p.status || 'open'),
    priority:     (p.priority || 'medium').toLowerCase(),
    is_public:    p.is_public ?? true,
  };
}
function gigDbToUi(row) {
  return {
    id:          row.id,
    eventId:     row.event_id,
    type:        row.gig_type,
    date:        row.gig_date,
    start:       (row.start_time || '').slice(0, 5),
    end:         (row.end_time   || '').slice(0, 5),
    spots:       row.spots_total,
    spotsFilled: row.spots_filled,
    rate:        Number(row.hourly_rate),
    priority:    capitalize(row.priority || 'medium'),
    status:      statusForUI(row.status),
    assignedTo:  [],
    description: row.description || '',
    // Preserve creation timestamp — Sidebar badges use it for "new since login".
    created_at:  row.created_at || null,
  };
}

function venueUiToDb(p) {
  return {
    name:        p.name,
    description: p.notes || p.description || null,
    address:     p.address || null,
    city:        p.city ? p.city.split(',')[0].trim() : null,
    state:       p.city && p.city.includes(',') ? p.city.split(',')[1].trim() : null,
    zip:         p.zip || null,
    country:     p.country || 'US',
    image_url:   p.image || null,
    event_types: Array.isArray(p.event_types) ? p.event_types : (p.type ? [p.type.toLowerCase()] : []),
    status:      'open',
  };
}
function venueDbToUi(row, fallbackImages = []) {
  return {
    id:       row.id,
    name:     row.name,
    city:     row.city ? `${row.city}, ${row.state || ''}`.replace(/, $/, '') : '',
    capacity: 200,
    type:     row.event_types?.[0] ? capitalize(row.event_types[0]) : 'Venue',
    address:  row.address || '',
    image:    row.image_url || fallbackImages[0] || '',
    notes:    row.description || '',
  };
}

function notifyChange() {
  try { window.dispatchEvent(new CustomEvent('rosy:data-changed')); } catch (e) {}
}

window.RosyMutate = {
  events: {
    async create(patch) {
      guardMutation('create');
      const tempId = genId('e');
      const optimistic = { id: tempId, gigCount: 0, filledCount: 0, ...patch };
      window.RosyData.EVENTS.unshift(optimistic);
      notifyChange();
      if (!isLive()) return optimistic;
      const { data, error } = await window.sb.from('rr_events').insert(eventUiToDb(patch)).select().single();
      if (error) { removeById(window.RosyData.EVENTS, tempId); notifyChange(); throw error; }
      const live = { ...eventDbToUi(data, window.RosyData.IMAGES?.events), gigCount: 0, filledCount: 0 };
      removeById(window.RosyData.EVENTS, tempId);
      window.RosyData.EVENTS.unshift(live);
      notifyChange();
      return live;
    },
    async update(id, patch) {
      guardMutation('update');
      const before = window.RosyData.EVENTS.find(e => e.id === id);
      if (before) Object.assign(before, patch);
      notifyChange();
      if (!isLive()) return before;
      const dbPatch = {};
      const map = { name: 'title', desc: 'description', date: 'event_date', start: 'start_time', end: 'end_time', venueId: 'venue_id', image: 'image_url', status: 'status', types: 'gig_types', location: 'location', is_public: 'is_public' };
      Object.entries(patch).forEach(([k, v]) => { if (map[k]) dbPatch[map[k]] = v; });
      const { error } = await window.sb.from('rr_events').update(dbPatch).eq('id', id);
      if (error) throw error;
      return before;
    },
    async delete(id) {
      guardMutation('delete');
      const before = window.RosyData.EVENTS.find(e => e.id === id);
      removeById(window.RosyData.EVENTS, id);
      notifyChange();
      if (!isLive()) return true;
      const { error } = await window.sb.from('rr_events').delete().eq('id', id);
      if (error) { if (before) window.RosyData.EVENTS.unshift(before); notifyChange(); throw error; }
      return true;
    },
  },

  gigs: {
    async create(patch) {
      guardMutation('create');
      const tempId = genId('g');
      const optimistic = { id: tempId, assignedTo: [], spotsFilled: 0, ...patch };
      window.RosyData.GIGS.unshift(optimistic);
      notifyChange();
      if (!isLive()) return optimistic;
      const { data, error } = await window.sb.from('rr_gigs').insert(gigUiToDb(patch)).select().single();
      if (error) { removeById(window.RosyData.GIGS, tempId); notifyChange(); throw error; }
      const live = gigDbToUi(data);
      removeById(window.RosyData.GIGS, tempId);
      window.RosyData.GIGS.unshift(live);
      notifyChange();
      return live;
    },
    async update(id, patch) {
      guardMutation('update');
      const before = window.RosyData.GIGS.find(g => g.id === id);
      if (before) Object.assign(before, patch);
      notifyChange();
      if (!isLive()) return before;
      const dbPatch = {};
      const map = { type: 'gig_type', date: 'gig_date', start: 'start_time', end: 'end_time', rate: 'hourly_rate', spots: 'spots_total', spotsFilled: 'spots_filled', priority: null, status: null, description: 'description' };
      Object.entries(patch).forEach(([k, v]) => {
        if (k === 'priority') dbPatch.priority = (v || 'medium').toLowerCase();
        else if (k === 'status') dbPatch.status = v === 'confirmed' ? 'filled' : v;
        else if (map[k]) dbPatch[map[k]] = (k === 'rate' || k === 'spots' || k === 'spotsFilled') ? Number(v) : v;
      });
      const { error } = await window.sb.from('rr_gigs').update(dbPatch).eq('id', id);
      if (error) throw error;
      return before;
    },
    async delete(id) {
      guardMutation('delete');
      const before = window.RosyData.GIGS.find(g => g.id === id);
      removeById(window.RosyData.GIGS, id);
      notifyChange();
      if (!isLive()) return true;
      const { error } = await window.sb.from('rr_gigs').delete().eq('id', id);
      if (error) { if (before) window.RosyData.GIGS.unshift(before); notifyChange(); throw error; }
      return true;
    },
  },

  venues: {
    async create(patch) {
      guardMutation('create');
      const tempId = genId('v');
      const optimistic = { id: tempId, ...patch };
      window.RosyData.VENUES.unshift(optimistic);
      notifyChange();
      if (!isLive()) return optimistic;
      const { data, error } = await window.sb.from('rr_venues').insert(venueUiToDb(patch)).select().single();
      if (error) { removeById(window.RosyData.VENUES, tempId); notifyChange(); throw error; }
      const live = venueDbToUi(data, window.RosyData.IMAGES?.events);
      removeById(window.RosyData.VENUES, tempId);
      window.RosyData.VENUES.unshift(live);
      notifyChange();
      return live;
    },
    async update(id, patch) {
      guardMutation('update');
      const before = window.RosyData.VENUES.find(v => v.id === id);
      if (before) Object.assign(before, patch);
      notifyChange();
      if (!isLive()) return before;
      const { error } = await window.sb.from('rr_venues').update(venueUiToDb(patch)).eq('id', id);
      if (error) throw error;
      return before;
    },
    async delete(id) {
      guardMutation('delete');
      const before = window.RosyData.VENUES.find(v => v.id === id);
      removeById(window.RosyData.VENUES, id);
      notifyChange();
      if (!isLive()) return true;
      const { error } = await window.sb.from('rr_venues').delete().eq('id', id);
      if (error) { if (before) window.RosyData.VENUES.unshift(before); notifyChange(); throw error; }
      return true;
    },
  },

  applications: {
    async apply({ gigId, workerId }) {
      // Worker creates an application for a gig. Returns optimistic record locally + persists to DB.
      guardMutation('apply');
      const gig = window.RosyData.GIGS.find(g => g.id === gigId);
      const worker = window.RosyData.USERS.find(u => u.id === workerId);
      const vendorId = window.RosyData.EVENTS.find(e => e.id === gig?.eventId)?.vendorId;
      const tempId = genId('r');
      // Only push into APPLICATIONS — TRANSACTIONS is for payments-with-money,
      // not "intent to apply". Previously a $0 Applied row was leaking into the
      // vendor's Payments table for every fresh application.
      const apps = window.RosyData.APPLICATIONS = window.RosyData.APPLICATIONS || [];
      const appOptimistic = { id: tempId, gigId, workerId, vendorId, status: 'applied', appliedAt: new Date().toISOString() };
      apps.unshift(appOptimistic);
      notifyChange();
      if (!isLive()) return appOptimistic;
      const { data, error } = await window.sb.from('rr_gig_applications').insert({
        gig_id:    gigId,
        worker_id: workerId,
        vendor_id: vendorId,
        status:    'applied',
        applied_at: new Date().toISOString(),
        skill:     gig?.type || null,
      }).select().single();
      if (error) { removeById(apps, tempId); notifyChange(); throw error; }
      const ai = apps.findIndex(a => a.id === tempId);
      if (ai >= 0) apps[ai] = { ...appOptimistic, id: data.id, status: data.status || 'applied' };
      notifyChange();
      // In-app notification for the vendor so the bell badge + Notifications
      // page light up. (Previously only Postmark fired — vendor saw nothing in
      // the UI until they happened to open their inbox.)
      try {
        const event = window.RosyData.EVENTS.find(e => e.id === gig?.eventId);
        if (vendorId) {
          await window.sb.from('rr_notifications').insert({
            user_id: vendorId,
            type: 'application_received',
            title: 'New application',
            body: `${worker?.name || 'A worker'} applied for the ${gig?.type || 'gig'} role on ${event?.name || 'your event'}.`,
            link: `#app/events:${gig?.eventId}`,
            read: false,
          });
        }
      } catch (e) { console.warn('application notification insert failed:', e); }
      // Postmark — notify vendor of new application (demo redirects to ben@pronocoders.com)
      try {
        const vendor = window.RosyData.USERS.find(u => u.id === vendorId);
        const event = window.RosyData.EVENTS.find(e => e.id === gig?.eventId);
        if (window.RosySendEmail && vendor?.email) {
          await window.RosySendEmail({
            slug: 'application-received',
            to: vendor.email,
            vars: {
              vendor_first: vendor.first || vendor.name || 'there',
              worker_name: worker?.name || 'A worker',
              worker_rating: String(worker?.rating || 5),
              worker_gigs: String(worker?.gigs || 0),
              gig_type: gig?.type || 'gig',
              event_name: event?.name || 'your event',
              event_date: event?.date || '',
              hourly_rate: String(gig?.rate || 0),
            },
          });
        }
      } catch (e) { console.warn('application-received email failed:', e); }
      return { ...optimistic, id: data.id };
    },
    async withdraw({ gigId, workerId }) {
      // Cancel applications for this worker on this gig.
      guardMutation('withdraw');
      const before = window.RosyData.TRANSACTIONS
        .filter(t => t._gigId === gigId && t._workerId === workerId);
      // Local optimistic delete (best-effort by application linkage)
      if (!isLive()) return true;
      const { error } = await window.sb.from('rr_gig_applications')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('gig_id', gigId).eq('worker_id', workerId).eq('status', 'applied');
      if (error) console.warn('[withdraw]', error.message);
      return true;
    },
    async markComplete({ id, hoursWorked, notes }) {
      // Worker submits hours; vendor will approve later.
      guardMutation('markComplete');
      const before = window.RosyData.TRANSACTIONS.find(t => t.id === id);
      if (before) before.status = 'Completed';
      notifyChange();
      if (!isLive()) return before;
      const { error } = await window.sb.from('rr_gig_applications').update({
        status: 'completed',
        worker_completed: true,
        completed_at: new Date().toISOString(),
        hours_worked: hoursWorked != null ? Number(hoursWorked) : undefined,
        worker_notes: notes || null,
      }).eq('id', id);
      if (error) throw error;
      return before;
    },
    async setStatus(id, status) {
      // status: 'confirmed' | 'completed' | 'rejected' | 'cancelled' | 'paid'
      guardMutation('setStatus');
      const before = window.RosyData.TRANSACTIONS.find(t => t.id === id);
      if (before) before.status = capitalize(status);
      notifyChange();
      if (!isLive()) return before;
      const patch = { status };
      if (status === 'confirmed') patch.confirmed_at = new Date().toISOString();
      if (status === 'completed') patch.completed_at = new Date().toISOString();
      if (status === 'paid')      { patch.payment_status = 'paid'; patch.paid_at = new Date().toISOString(); }
      const { error } = await window.sb.from('rr_gig_applications').update(patch).eq('id', id);
      if (error) throw error;
      // Notify the worker on confirm / reject so they don't have to refresh to see the decision.
      if (status === 'confirmed' || status === 'rejected') {
        try {
          const { data: app } = await window.sb.from('rr_gig_applications')
            .select('worker_id, gig_id, gigs:gig_id(event_id, gig_type, rate, gig_date, events:event_id(title, venue_id, venues:venue_id(name, city)))')
            .eq('id', id).maybeSingle();
          const worker = (window.RosyData.USERS || []).find(u => u.id === app?.worker_id);
          if (worker?.email && window.RosySendEmail) {
            const ev = app?.gigs?.events;
            const venue = ev?.venues;
            const vars = {
              worker_first: worker.first || worker.name || 'there',
              worker_name:  worker.name || worker.email,
              event_name:   ev?.title || 'your gig',
              event_date:   app?.gigs?.gig_date || '',
              call_time:    '',
              venue_name:   venue?.name || '',
              venue_city:   venue?.city || '',
              hourly_rate:  app?.gigs?.rate || '',
              lead_name:    '',
              gig_type:     app?.gigs?.gig_type || '',
            };
            window.RosySendEmail({
              slug: status === 'confirmed' ? 'worker-confirmed' : 'worker-rejected',
              to: worker.email, vars,
            }).catch(e => console.warn('status email failed:', e.message));
          }
        } catch (e) { console.warn('status email lookup failed:', e.message); }
      }
      return before;
    },
    async setPaymentStatus(id, paymentStatus) {
      guardMutation('setPaymentStatus');
      const before = window.RosyData.TRANSACTIONS.find(t => t.id === id);
      if (before) before.status = paymentStatusForUI(paymentStatus);
      notifyChange();
      if (!isLive()) return before;
      const patch = { payment_status: paymentStatus };
      if (paymentStatus === 'paid') patch.paid_at = new Date().toISOString();
      const { error } = await window.sb.from('rr_gig_applications').update(patch).eq('id', id);
      if (error) throw error;
      return before;
    },
  },

  messages: {
    async send({ conversationId, senderId, recipientId, content, attachmentUrl, attachmentName, attachmentType }) {
      guardMutation('send');
      if (!isLive()) return { id: genId('m'), text: content, who: 'me', time: 'Just now', day: 'Today' };
      const { data, error } = await window.sb.from('rr_messages').insert({
        conversation_id: conversationId,
        sender_id:       senderId,
        recipient_id:    recipientId,
        content,
        attachment_url:  attachmentUrl || null,
        attachment_name: attachmentName || null,
        attachment_type: attachmentType || null,
      }).select().single();
      if (error) throw error;
      // Also bump conversation last_message_at
      window.sb.from('rr_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId).then(() => {});
      // Fire the throttled email notification in the background — the endpoint
      // dedupes so a burst of 10 messages from the same sender = 1 email.
      (async () => {
        try {
          const { data: s } = await window.sb.auth.getSession();
          await fetch('/api/message-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.session?.access_token || ''}` },
            body: JSON.stringify({ conversationId, senderId, recipientId }),
          });
        } catch (e) { /* don't surface email errors to the chat UI */ }
      })();
      return { id: data.id, text: data.content, who: 'me', time: 'Just now', day: 'Today' };
    },
    async markSeen({ conversationId, userId }) {
      // Two responsibilities:
      //   1) Stamp seen_by[userId] so the email-notify throttle can re-arm.
      //   2) Flip read_at on every unread message addressed to this user in
      //      this conversation. Without #2 the Inbox sidebar badge never
      //      clears even after the user has visibly viewed the thread.
      guardMutation('markSeen');
      if (!isLive() || !conversationId || !userId) return;
      try {
        const nowIso = new Date().toISOString();
        const { data } = await window.sb.from('rr_conversations').select('seen_by').eq('id', conversationId).maybeSingle();
        const seen = { ...(data?.seen_by || {}), [userId]: nowIso };
        await window.sb.from('rr_conversations').update({ seen_by: seen }).eq('id', conversationId);
        await window.sb.from('rr_messages')
          .update({ read_at: nowIso })
          .eq('conversation_id', conversationId)
          .eq('recipient_id', userId)
          .is('read_at', null);
        // Optimistically update local cache so the sidebar badge reflects the
        // change immediately (realtime echo arrives a heartbeat later).
        const conv = (window.RosyData?.MESSAGES || []).find(c => c.id === conversationId);
        if (conv) {
          (conv.messages || []).forEach(m => {
            if (m.recipientId === userId && !m.read_at) m.read_at = nowIso;
          });
          conv.unread = 0;
          notifyChange();
        }
      } catch (e) { console.warn('markSeen failed:', e); }
    },
  },

  conversations: {
    async create({ subject, startedBy, participants, eventId, gigAppId }) {
      guardMutation('create');
      // Defensive dedupe: for 1:1 DMs with no event/gig context, look up an
      // existing thread between the same two people and return it instead of
      // inserting a duplicate row. Without this, two clients clicking
      // "Message" near-simultaneously would each create a new thread.
      if (isLive() && Array.isArray(participants) && participants.length === 2 && !eventId && !gigAppId) {
        const sortedTwo = [...participants].sort();
        const { data: hits } = await window.sb
          .from('rr_conversations')
          .select('id, subject, participants, started_by')
          .contains('participants', sortedTwo)
          .is('event_id', null)
          .is('gig_app_id', null)
          .limit(5);
        const match = (hits || []).find(c => {
          const parts = [...(c.participants || [])].sort();
          return parts.length === 2 && parts[0] === sortedTwo[0] && parts[1] === sortedTwo[1];
        });
        if (match) {
          const other = participants.find(p => p !== startedBy) || participants[0];
          const live = { id: match.id, with: other, name: match.subject, online: false, unread: 0, preview: '', messages: [] };
          if (!window.RosyData.MESSAGES.find(m => m.id === live.id)) window.RosyData.MESSAGES.unshift(live);
          notifyChange();
          return live;
        }
      }
      const tempId = genId('c');
      const optimistic = { id: tempId, with: participants[0], name: subject, online: false, unread: 0, preview: '', messages: [] };
      window.RosyData.MESSAGES.unshift(optimistic);
      notifyChange();
      if (!isLive()) return optimistic;
      const { data, error } = await window.sb.from('rr_conversations').insert({
        subject, started_by: startedBy, participants,
        event_id: eventId || null, gig_app_id: gigAppId || null,
        is_visible: true, last_message_at: new Date().toISOString(),
      }).select().single();
      if (error) { removeById(window.RosyData.MESSAGES, tempId); notifyChange(); throw error; }
      const live = { id: data.id, with: participants[0], name: subject, online: false, unread: 0, preview: '', messages: [] };
      removeById(window.RosyData.MESSAGES, tempId);
      window.RosyData.MESSAGES.unshift(live);
      notifyChange();
      return live;
    },
  },

  ratings: {
    async create({ raterId, ratedId, gigAppId, raterRole, score, comment }) {
      guardMutation('create');
      if (!isLive()) return { id: genId('rt'), score };
      const { data, error } = await window.sb.from('rr_ratings').insert({
        rater_id: raterId,
        rated_id: ratedId,
        gig_app_id: gigAppId,
        rater_role: raterRole,
        score: Number(score),
        comment: comment || null,
        is_public: true,
      }).select().single();
      if (error) throw error;
      return data;
    },
  },

  notifications: {
    async markRead(id) {
      guardMutation('markRead');
      const n = window.RosyData.NOTIFICATIONS.find(x => x.id === id);
      if (n) n.unread = false;
      notifyChange();
      if (!isLive()) return;
      const { error } = await window.sb.from('rr_notifications').update({ read: true, read_at: new Date().toISOString() }).eq('id', id);
      if (error) console.warn('[RosyMutate.notifications.markRead]', error.message);
    },
    async markAllRead(userId) {
      guardMutation('markAllRead');
      window.RosyData.NOTIFICATIONS.forEach(n => { n.unread = false; });
      notifyChange();
      if (!isLive()) return;
      const q = window.sb.from('rr_notifications').update({ read: true, read_at: new Date().toISOString() }).eq('read', false);
      const { error } = userId ? await q.eq('user_id', userId) : await q;
      if (error) console.warn('[RosyMutate.notifications.markAllRead]', error.message);
    },
  },
};

Object.assign(window, { RosyMutate: window.RosyMutate });

/* ======================================================================
   Realtime — subscribe to postgres_changes on the live tables and mirror
   them into window.RosyData so other tabs see edits instantly.
   ====================================================================== */

let __realtimeChannel = null;
let __selfOriginIds = new Set(); // ids the current tab just wrote — skip echo

function rememberSelf(id) {
  if (!id) return;
  __selfOriginIds.add(id);
  setTimeout(() => __selfOriginIds.delete(id), 4000); // expire after a few seconds
}

// Patch RosyMutate ops to register their own writes so the realtime echo doesn't double-apply.
['events','gigs','venues','conversations'].forEach(group => {
  const ops = window.RosyMutate[group];
  if (!ops) return;
  ['create','update','delete'].forEach(op => {
    const orig = ops[op];
    if (typeof orig !== 'function') return;
    ops[op] = async function (...args) {
      const out = await orig.apply(this, args);
      if (out && out.id) rememberSelf(out.id);
      else if (typeof args[0] === 'string') rememberSelf(args[0]); // delete(id)
      return out;
    };
  });
});

function applyEventChange(payload) {
  const { eventType, new: row, old } = payload;
  const arr = window.RosyData.EVENTS;
  if (eventType === 'DELETE') { removeById(arr, old.id); }
  else {
    if (__selfOriginIds.has(row.id)) return false; // skip echo of our own write
    const ui = eventDbToUi(row, window.RosyData.IMAGES?.events || []);
    const existing = arr.find(e => e.id === row.id);
    if (existing) Object.assign(existing, ui);
    else arr.unshift({ ...ui, gigCount: 0, filledCount: 0 });
  }
  return true;
}
function applyGigChange(payload) {
  const { eventType, new: row, old } = payload;
  const arr = window.RosyData.GIGS;
  if (eventType === 'DELETE') { removeById(arr, old.id); }
  else {
    if (__selfOriginIds.has(row.id)) return false;
    const ui = gigDbToUi(row);
    const existing = arr.find(g => g.id === row.id);
    if (existing) Object.assign(existing, ui);
    else arr.unshift(ui);
  }
  return true;
}
function applyVenueChange(payload) {
  const { eventType, new: row, old } = payload;
  const arr = window.RosyData.VENUES;
  if (eventType === 'DELETE') { removeById(arr, old.id); }
  else {
    if (__selfOriginIds.has(row.id)) return false;
    const ui = venueDbToUi(row, window.RosyData.IMAGES?.events || []);
    const existing = arr.find(v => v.id === row.id);
    if (existing) Object.assign(existing, ui);
    else arr.unshift(ui);
  }
  return true;
}
function applyApplicationChange(payload) {
  const { eventType, new: row, old } = payload;
  const arr = window.RosyData.TRANSACTIONS;
  const apps = window.RosyData.APPLICATIONS = window.RosyData.APPLICATIONS || [];
  if (eventType === 'DELETE') {
    removeById(arr, old.id);
    removeById(apps, old.id);
    return true;
  }
  if (__selfOriginIds.has(row.id)) return false;
  // Mirror into APPLICATIONS so UI predicates (`hasApplied`, "Applied" badge,
  // My Gigs filter) see the new row immediately. Previously only TRANSACTIONS
  // got updated, so the worker's apply screen kept showing the Apply button
  // even after a successful insert.
  const appUi = {
    id: row.id, gigId: row.gig_id, workerId: row.worker_id, vendorId: row.vendor_id,
    status: row.status, paymentStatus: row.payment_status,
    appliedAt: row.applied_at, confirmedAt: row.confirmed_at, completedAt: row.completed_at,
    hoursWorked: row.hours_worked, workerNotes: row.worker_notes, vendorNotes: row.vendor_notes,
  };
  const appIdx = apps.findIndex(a => a.id === row.id);
  if (appIdx >= 0) apps[appIdx] = appUi; else apps.unshift(appUi);
  const usersById = Object.fromEntries(window.RosyData.USERS.map(u => [u.id, u]));
  const worker = usersById[row.worker_id];
  const vendor = usersById[row.vendor_id];
  // TRANSACTIONS row only when the app has a real money dimension — matches
  // buildTransactions' filter. Default-state 'applied'+'not_due' rows DO NOT
  // belong in the vendor's Payments table.
  const hasPaymentDim = (row.amount_due != null && Number(row.amount_due) > 0)
    || (row.payment_status && row.payment_status !== 'not_due')
    || ['confirmed', 'completed'].includes(row.status);
  if (hasPaymentDim) {
    const ui = {
      id:      row.id,
      invoice: row.request_code || row.id.slice(0, 8).toUpperCase(),
      payer:   vendor?.company || vendor?.name || 'Vendor',
      payee:   worker?.name || 'Worker',
      amount:  Number(row.amount_due || row.estimated_amount || 0),
      status:  paymentStatusForUI(row.payment_status),
      date:    (row.paid_at || row.completed_at || row.confirmed_at || row.applied_at || '').slice(0, 10),
      note:    row.cancellation_reason || null,
    };
    const existing = arr.find(t => t.id === row.id);
    if (existing) Object.assign(existing, ui);
    else arr.unshift(ui);
  } else {
    // App lost its payment dimension — drop the row.
    removeById(arr, row.id);
  }
  // Also bump the gig's spotsFilled if status moved to 'confirmed'
  if (eventType !== 'DELETE' && row.status === 'confirmed') {
    const gig = window.RosyData.GIGS.find(g => g.id === row.gig_id);
    if (gig && !gig.assignedTo.includes(row.worker_id)) {
      gig.assignedTo = [...gig.assignedTo, row.worker_id];
      gig.spotsFilled = Math.min((gig.spotsFilled || 0) + 1, gig.spots || 99);
    }
  }
  return true;
}
function applyMessageChange(payload) {
  const { eventType, new: row } = payload;
  if (eventType === 'DELETE') return false;
  if (__selfOriginIds.has(row.id)) return false;
  const conv = window.RosyData.MESSAGES.find(c => c.id === row.conversation_id);
  if (!conv) return false;
  conv.messages = [...(conv.messages || []), {
    who:  row.sender_id === conv.with ? 'them' : 'me',
    text: row.content || '',
    time: timeLabel(row.created_at),
    day:  dayLabel(row.created_at),
  }];
  conv.preview = row.content || conv.preview;
  return true;
}
// Rebuild a single USERS entry from its rr_profiles + rr_vendor_profiles + rr_worker_profiles
// rows. Used by the rr_profiles / rr_vendor_profiles / rr_worker_profiles realtime
// handlers so an admin's already-loaded session picks up new signups + edits
// without a page reload. Async — fires a notifyChange after splicing in.
async function refreshUserById(id) {
  if (!id || !window.sb || !window.RosyData) return false;
  try {
    // Use the safe view so non-admin sessions can refresh USERS rows for OTHER
    // users (e.g. when a vendor sees an updated worker name). Admins reading
    // their own user-detail drawer go through their own dedicated path
    // (screen_admin.jsx user fetch) which uses the base table for full data.
    const myId = window.sb?.auth?.getSession ? null : null; // placeholder
    const baseTable = (id === window.RosyData?.__currentUserId) ? 'rr_profiles' : 'rr_profiles_public';
    const [{ data: p }, { data: v }, { data: w }] = await Promise.all([
      window.sb.from(baseTable).select('*').eq('id', id).maybeSingle(),
      window.sb.from('rr_vendor_profiles').select('*').eq('id', id).maybeSingle(),
      window.sb.from('rr_worker_profiles').select('*').eq('id', id).maybeSingle(),
    ]);
    const users = window.RosyData.USERS = window.RosyData.USERS || [];
    if (!p) {
      // Profile deleted — drop from USERS.
      const i = users.findIndex(u => u.id === id);
      if (i >= 0) users.splice(i, 1);
      notifyChange();
      return true;
    }
    const [rebuilt] = buildUsers([p], v ? [v] : [], w ? [w] : []);
    const i = users.findIndex(u => u.id === id);
    if (i >= 0) users[i] = rebuilt;
    else users.unshift(rebuilt);
    notifyChange();
    return true;
  } catch (e) { console.warn('[realtime refreshUserById]', e); return false; }
}

function applyProfileChange(payload) {
  const id = payload?.new?.id || payload?.old?.id;
  if (!id) return false;
  refreshUserById(id);
  return false; // async refresh handles its own notifyChange
}

function applyVendorProfileChange(payload) {
  const id = payload?.new?.id || payload?.old?.id;
  if (!id) return false;
  refreshUserById(id);
  return false;
}

function applyWorkerProfileChange(payload) {
  const id = payload?.new?.id || payload?.old?.id;
  if (!id) return false;
  refreshUserById(id);
  return false;
}

function applyFaqChange(payload) {
  const { eventType, new: row } = payload;
  const arr = window.RosyData.FAQS = window.RosyData.FAQS || [];
  if (eventType === 'DELETE') { removeById(arr, payload.old.id); return true; }
  // Use the same mapper as initial hydration so the row shape stays consistent.
  const [mapped] = buildFaqs([row]);
  const existing = arr.find(f => f.id === mapped.id);
  if (existing) Object.assign(existing, mapped);
  else arr.push(mapped);
  // Resort by sort_order so admin's manual ordering is reflected immediately.
  arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return true;
}

function applyNotificationChange(payload) {
  const { eventType, new: row } = payload;
  const arr = window.RosyData.NOTIFICATIONS;
  if (eventType === 'DELETE') { removeById(arr, payload.old.id); return true; }
  if (__selfOriginIds.has(row.id)) return false;
  const ui = { id: row.id, type: row.type, title: row.title, body: row.body, time: timeAgo(row.created_at), link: row.link || '', unread: !row.read };
  const existing = arr.find(n => n.id === row.id);
  if (existing) Object.assign(existing, ui);
  else arr.unshift(ui);
  return true;
}

window.subscribeRealtime = function subscribeRealtime() {
  if (!window.sb || __realtimeChannel) return __realtimeChannel;
  const ch = window.sb.channel('rr-prototype', { config: { broadcast: { self: false } } });
  const tables = [
    ['rr_events',           applyEventChange],
    ['rr_gigs',             applyGigChange],
    ['rr_venues',           applyVenueChange],
    ['rr_gig_applications', applyApplicationChange],
    ['rr_messages',         applyMessageChange],
    ['rr_notifications',    applyNotificationChange],
    // User-data tables — needed so admins see new signups + profile edits
    // immediately (was missing, caused new vendor signups to not appear in
    // admin dashboard until a full page reload).
    ['rr_profiles',         applyProfileChange],
    ['rr_vendor_profiles',  applyVendorProfileChange],
    ['rr_worker_profiles',  applyWorkerProfileChange],
    // FAQs — without this, new/edited/deleted FAQs only appear on other
    // tabs after a hard refresh, and audience-only FAQs leak through to the
    // wrong consumer surfaces until the cache settles.
    ['rr_faqs',             applyFaqChange],
  ];
  tables.forEach(([table, handler]) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      try {
        const changed = handler(payload);
        if (changed) notifyChange();
      } catch (e) { console.warn(`[realtime ${table}]`, e); }
    });
  });
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.info('[realtime] connected — listening on 9 tables');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[realtime] status:', status);
  });
  __realtimeChannel = ch;
  return ch;
};

Object.assign(window, { subscribeRealtime: window.subscribeRealtime });

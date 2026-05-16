/* Seed data for Rosy Recruits prototype.
   Rich, story-driven floral-event data with edge cases. */

const IMG = 'https://images.unsplash.com';

const IMAGES = {
  authFloral:     `${IMG}/photo-1561181286-d3fee7d55364?w=900&q=80`,
  marketingHero:  `${IMG}/photo-1487530811176-3780de880c2d?w=1200&q=80`,
  marketingAbout: `${IMG}/photo-1490750967868-88aa4486c946?w=900&q=80`,
  marketingWorker:`${IMG}/photo-1558618666-fcd25c85cd64?w=600&q=80`,
  marketingVendor:`${IMG}/photo-1606041008023-472dfb5e530f?w=600&q=80`,
  gallery: [
    `${IMG}/photo-1519225421980-715cb0215aed?w=600&q=80`,
    `${IMG}/photo-1606041011872-596597976b25?w=600&q=80`,
    `${IMG}/photo-1561181286-d3fee7d55364?w=600&q=80`,
    `${IMG}/photo-1487070183336-b863922373d4?w=600&q=80`,
    `${IMG}/photo-1455659817273-f96807779a8a?w=600&q=80`,
    `${IMG}/photo-1469371670807-013ccf25f16a?w=600&q=80`,
  ],
  events: [
    `${IMG}/photo-1519741497674-611481863552?w=800&q=80`,
    `${IMG}/photo-1464366400600-7168b8af9bc3?w=800&q=80`,
    `${IMG}/photo-1518895949257-7621c3c786d7?w=800&q=80`,
    `${IMG}/photo-1530023367847-a683933f4172?w=800&q=80`,
    `${IMG}/photo-1519671482749-fd09be7ccebf?w=800&q=80`,
    `${IMG}/photo-1525310072745-f49212b5ac6d?w=800&q=80`,
  ],
  avatar: (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`,
};

const USERS = [
  { id: 'u1', name: 'Mariana Cruz',   first: 'Mariana', last: 'Cruz',   email: 'mariana@bloomandfern.co',   role: 'vendor', company: 'Bloom & Fern Studio',  status: 'active',   joined: '2024-08-12', city: 'Chicago, IL', rating: 4.9, gigs: 47 },
  { id: 'u2', name: 'Ben Reyes',      first: 'Ben',     last: 'Reyes',  email: 'ben@rosyrecruits.com',       role: 'admin',  company: 'Rosy Recruits',        status: 'active',   joined: '2023-01-04', city: 'Austin, TX' },
  { id: 'u3', name: 'Naomi Park',     first: 'Naomi',   last: 'Park',   email: 'naomi.park@gmail.com',        role: 'worker', company: 'Freelance Designer',   status: 'active',   joined: '2024-03-22', city: 'Chicago, IL', rating: 4.95, gigs: 88 },
  { id: 'u4', name: 'Theo Akande',    first: 'Theo',    last: 'Akande', email: 'theo@floralforge.io',         role: 'vendor', company: 'Floral Forge',         status: 'active',   joined: '2024-11-02', city: 'Atlanta, GA', rating: 4.7 },
  { id: 'u5', name: 'Sasha Iversen',  first: 'Sasha',   last: 'Iversen',email: 'sasha.i@protonmail.com',      role: 'worker', company: 'Lead Installer',       status: 'inactive', joined: '2023-09-18', city: 'Evanston, IL', rating: 4.6, gigs: 32 },
  { id: 'u6', name: 'Priya Mehta',    first: 'Priya',   last: 'Mehta',  email: 'priya@thistleandhoney.com',   role: 'vendor', company: 'Thistle & Honey',      status: 'active',   joined: '2025-02-14', city: 'Oak Park, IL' },
  { id: 'u7', name: 'Marcus Chen',    first: 'Marcus',  last: 'Chen',   email: 'marcus.chen@gmail.com',       role: 'worker', company: 'Strike Specialist',    status: 'active',   joined: '2025-01-09', city: 'Chicago, IL', rating: 4.8, gigs: 21 },
  { id: 'u8', name: 'Olivia Greene',  first: 'Olivia',  last: 'Greene', email: 'olivia@wildivory.com',        role: 'vendor', company: 'Wild & Ivory',         status: 'active',   joined: '2024-05-30', city: 'Chicago, IL' },
  { id: 'u9', name: 'Jasper Wu',      first: 'Jasper',  last: 'Wu',     email: 'jasper.wu@icloud.com',        role: 'worker', company: 'Onsite Designer',      status: 'active',   joined: '2025-03-15', city: 'Chicago, IL', rating: 4.85, gigs: 14 },
  { id: 'u10',name: 'Daniela Soto',   first: 'Daniela', last: 'Soto',   email: 'daniela.s@gmail.com',         role: 'worker', company: 'Floral Assistant',     status: 'active',   joined: '2025-04-01', city: 'Chicago, IL', rating: 4.9, gigs: 9 },
  { id: 'u11',name: 'Henry Lim',      first: 'Henry',   last: 'Lim',    email: 'henry.lim@yahoo.com',         role: 'worker', company: 'Freelance D.I.Y. Coach',status: 'inactive',joined: '2023-12-11', city: 'Chicago, IL', rating: 4.2, gigs: 3 },
];

const VENUES = [
  { id: 'v1', name: 'The Foundry',        city: 'Chicago, IL', capacity: 280, type: 'Industrial loft' },
  { id: 'v2', name: 'Lincoln Park Conservatory',   city: 'Chicago, IL',         capacity: 400, type: 'Garden' },
  { id: 'v3', name: 'West Loop Loft',    city: 'Chicago, IL',         capacity: 120, type: 'Loft' },
  { id: 'v4', name: 'The Glasshouse',     city: 'Chicago, IL',        capacity: 350, type: 'Skyline venue' },
  { id: 'v5', name: 'Wave Hill',          city: 'Chicago, IL',            capacity: 180, type: 'Estate' },
  { id: 'v6', name: 'Lakeshore Warehouse',  city: 'Chicago, IL',         capacity: 500, type: 'Waterfront' },
];

const EVENTS = [
  { id: 'e1', name: 'Wheeler Wedding',          date: '2026-06-23', start: '14:00', end: '23:00', venueId: 'v6', vendorId: 'u1', image: IMAGES.events[0], desc: 'Sunset waterfront ceremony for 220, ivory + ranunculus install across a 14-ft archway, repeating low garden tables, cocktail-hour blooms in the warehouse loft.', status: 'open',     types: ['Lead','Design','Assist','Strike'], gigCount: 9, filledCount: 7 },
  { id: 'e2', name: 'Garden Society Gala',      date: '2026-05-30', start: '17:00', end: '00:00', venueId: 'v2', vendorId: 'u4', image: IMAGES.events[1], desc: 'Annual benefit gala in the Cherry Esplanade — overhead suspended floral chandeliers, 32 dinner tables in deep peach + bordeaux palette.',                              status: 'open',     types: ['Lead','Design','Assist'],          gigCount: 12, filledCount: 12 },
  { id: 'e3', name: 'Atelier Press Preview',    date: '2026-05-28', start: '11:00', end: '17:00', venueId: 'v3', vendorId: 'u6', image: IMAGES.events[2], desc: 'Quiet press day for a French perfumer launch. Single statement installation in the lobby + minimal table compositions for tasting flights.',                  status: 'open',     types: ['Design','Assist'],                 gigCount: 4,  filledCount: 3 },
  { id: 'e4', name: 'Carter–Liang Reception',   date: '2026-06-08', start: '16:30', end: '23:30', venueId: 'v4', vendorId: 'u1', image: IMAGES.events[3], desc: 'Skyline reception, 180 guests. Hanging asymmetric installation over the dance floor, 18 tablescapes, ceremony aisle markers.',                              status: 'open',     types: ['Lead','Assist','Strike'],          gigCount: 8,  filledCount: 5 },
  { id: 'e5', name: 'Wave Hill Garden Brunch',  date: '2026-05-18', start: '10:00', end: '15:00', venueId: 'v5', vendorId: 'u8', image: IMAGES.events[4], desc: 'Intimate 60-guest brunch on the estate lawn — bud vases, single-stem ikebana on each plate, no installs.',                                                  status: 'completed',types: ['Assist'],                          gigCount: 3,  filledCount: 3 },
  { id: 'e6', name: 'Foundry Vow Renewal',      date: '2026-07-12', start: '15:00', end: '22:00', venueId: 'v1', vendorId: 'u1', image: IMAGES.events[5], desc: 'Intimate vow renewal in the boiler-room courtyard. Single arch + 12 table compositions in a moody peach + chocolate cosmos palette.',                       status: 'draft',    types: ['Lead','Design','Assist'],          gigCount: 5,  filledCount: 0 },
];

const GIG_TYPES = {
  Strike: { hourly: 26, blurb: 'Tear down, pack out, leave the venue spotless.', icon: 'X' },
  Lead:   { hourly: 48, blurb: 'Own the room. Direct the team. Talk to the planner.', icon: 'Star' },
  Design: { hourly: 38, blurb: 'Build the installations. Set the visual standard.', icon: 'Flower' },
  Assist: { hourly: 22, blurb: 'Prep stems, build arrangements, support the lead.', icon: 'HardHat' },
};

const GIGS = [
  // Wheeler Wedding (e1)
  { id: 'g1', eventId: 'e1', type: 'Lead',   date: '2026-06-23', start: '12:00', end: '23:30', spots: 1, spotsFilled: 1, rate: 50, priority: 'High',   status: 'confirmed', assignedTo: ['u3'], description: 'Lead designer onsite. Owns timeline, vendor relationships, and final approval of every installation.' },
  { id: 'g2', eventId: 'e1', type: 'Design', date: '2026-06-23', start: '08:00', end: '17:00', spots: 3, spotsFilled: 2, rate: 38, priority: 'High',   status: 'open',      assignedTo: ['u9','u10'], description: 'Build the 14-ft archway + suspended cocktail-hour cloud. Heavy structural work. Senior designers only.' },
  { id: 'g3', eventId: 'e1', type: 'Assist', date: '2026-06-23', start: '08:00', end: '15:00', spots: 4, spotsFilled: 3, rate: 22, priority: 'Medium', status: 'open',      assignedTo: ['u7','u10','u3'], description: 'Stem prep, water buckets, transport blooms to install zone, support build leads.' },
  { id: 'g4', eventId: 'e1', type: 'Strike', date: '2026-06-23', start: '22:30', end: '02:00', spots: 5, spotsFilled: 4, rate: 28, priority: 'High',   status: 'open',      assignedTo: ['u7','u9','u5','u11'], description: 'Strike crew. Must lift 50 lbs. Truck loading + venue restoration.' },

  // Garden Society Gala (e2)
  { id: 'g5', eventId: 'e2', type: 'Lead',   date: '2026-05-30', start: '13:00', end: '00:00', spots: 1, spotsFilled: 1, rate: 50, priority: 'High',   status: 'confirmed', assignedTo: ['u3'], description: 'Lead designer for benefit gala. Liaison with venue + production.' },
  { id: 'g6', eventId: 'e2', type: 'Design', date: '2026-05-30', start: '09:00', end: '19:00', spots: 4, spotsFilled: 4, rate: 38, priority: 'High',   status: 'confirmed', assignedTo: ['u9','u10','u5','u7'], description: 'Suspended floral chandeliers + central runner installs across 32 tables.' },
  { id: 'g7', eventId: 'e2', type: 'Assist', date: '2026-05-30', start: '08:00', end: '18:00', spots: 7, spotsFilled: 7, rate: 24, priority: 'Medium', status: 'confirmed', assignedTo: ['u10','u7','u11','u5','u3','u9','u4'], description: 'Stem prep and tablescape assembly. Long day.' },

  // Atelier Press Preview (e3)
  { id: 'g8', eventId: 'e3', type: 'Design', date: '2026-05-28', start: '07:00', end: '12:00', spots: 2, spotsFilled: 2, rate: 42, priority: 'High',   status: 'confirmed', assignedTo: ['u3','u9'], description: 'Lobby statement installation for press photo backdrop. Minimal palette, white + bone.' },
  { id: 'g9', eventId: 'e3', type: 'Assist', date: '2026-05-28', start: '07:00', end: '13:00', spots: 2, spotsFilled: 1, rate: 22, priority: 'Low',    status: 'open',      assignedTo: ['u10'], description: 'Tasting flight compositions, single-stem only.' },

  // Carter-Liang (e4)
  { id: 'g10',eventId: 'e4', type: 'Lead',   date: '2026-06-08', start: '13:00', end: '00:00', spots: 1, spotsFilled: 1, rate: 50, priority: 'High',   status: 'confirmed', assignedTo: ['u9'], description: 'Lead onsite. Manages 5-person build crew.' },
  { id: 'g11',eventId: 'e4', type: 'Assist', date: '2026-06-08', start: '09:00', end: '20:00', spots: 5, spotsFilled: 3, rate: 22, priority: 'Medium', status: 'open',      assignedTo: ['u10','u7','u3'], description: 'Tablescape + ceremony aisle prep. Skyline venue, beautiful day for it.' },
  { id: 'g12',eventId: 'e4', type: 'Strike', date: '2026-06-08', start: '23:00', end: '02:30', spots: 4, spotsFilled: 1, rate: 28, priority: 'High',   status: 'open',      assignedTo: ['u7'], description: 'Late strike crew. Truck load-out.' },

  // Wave Hill (e5) — completed
  { id: 'g13',eventId: 'e5', type: 'Assist', date: '2026-05-18', start: '07:00', end: '15:30', spots: 3, spotsFilled: 3, rate: 22, priority: 'Low',    status: 'completed', assignedTo: ['u10','u3','u9'], description: 'Bud vase staging and ikebana plating, 60 covers.' },
];

const TRANSACTIONS = [
  { id: 't1',  invoice: 'Wheeler #4012',     status: 'Not Due',  amount: 4800, date: '2026-06-30', payee: 'Naomi Park',    payer: 'Bloom & Fern Studio' },
  { id: 't2',  invoice: 'Gala #4008',        status: 'Paid',     amount: 9200, date: '2026-06-02', payee: 'Multiple',      payer: 'Floral Forge' },
  { id: 't3',  invoice: 'Atelier #4015',     status: 'Pending',  amount: 1840, date: '2026-05-30', payee: 'Naomi Park',    payer: 'Thistle & Honey' },
  { id: 't4',  invoice: 'Wave Hill #3998',   status: 'Paid',     amount: 990,  date: '2026-05-20', payee: 'Daniela Soto',  payer: 'Wild & Ivory' },
  { id: 't5',  invoice: 'Carter–Liang #4019',status: 'Late',     amount: 3640, date: '2026-05-12', payee: 'Marcus Chen',   payer: 'Bloom & Fern Studio' },
  { id: 't6',  invoice: 'Atelier #4015-D',   status: 'Disputed', amount: 720,  date: '2026-05-31', payee: 'Henry Lim',     payer: 'Thistle & Honey', note: 'Hours mismatch — 6h logged, vendor approved 4h.' },
  { id: 't7',  invoice: 'Gala #4008-S',      status: 'Paid',     amount: 1120, date: '2026-06-02', payee: 'Sasha Iversen', payer: 'Floral Forge' },
  { id: 't8',  invoice: 'Foundry #4022',     status: 'Not Due',  amount: 2200, date: '2026-07-15', payee: 'Naomi Park',    payer: 'Bloom & Fern Studio' },
  { id: 't9',  invoice: 'Gala #4008-A',      status: 'Paid',     amount: 1980, date: '2026-06-02', payee: 'Jasper Wu',     payer: 'Floral Forge' },
];

const NOTIFICATIONS = [
  { id: 'n1', type: 'gig_application', title: 'New application: Daniela Soto',        body: 'Applied for Wheeler Wedding — Assist',          time: '12 min ago', unread: true,  link: '#vendor/events/e1' },
  { id: 'n2', type: 'payment_disputed',title: 'Dispute filed by Henry Lim',           body: 'Atelier #4015-D — hours mismatch',              time: '1 hr ago',   unread: true,  link: '#admin/disputes' },
  { id: 'n3', type: 'gig_confirmed',   title: 'You\'re confirmed for Carter–Liang',   body: 'June 8 · Lead · 1pm–midnight',                  time: '3 hr ago',   unread: false, link: '#worker/my-gigs' },
  { id: 'n4', type: 'rating_received', title: 'New 5-star rating from Olivia Greene', body: '"Naomi is the rare lead who actually leads."',  time: 'Yesterday',  unread: false, link: '#worker/profile' },
  { id: 'n5', type: 'new_message',     title: 'Mariana Cruz sent a message',          body: '"Let\'s lock in the gala team by Friday."',     time: 'Yesterday',  unread: true,  link: '#inbox' },
  { id: 'n6', type: 'payment_sent',    title: 'Payment sent: $1,840',                 body: 'Atelier Press Preview · pending Stripe payout', time: 'Yesterday',  unread: false, link: '#worker/payments' },
];

const MESSAGES = [
  {
    id: 'c1', with: 'u1', name: 'Mariana Cruz', online: true, unread: 2,
    preview: 'Let\'s lock in the gala team by Friday.',
    messages: [
      { who: 'them', text: 'Hi Naomi — got a minute? Wanted to talk Wheeler.', time: '10:14 am', day: 'Yesterday' },
      { who: 'them', text: 'I need a second senior designer for the arch.',   time: '10:14 am', day: 'Yesterday' },
      { who: 'me',   text: 'Sure — Jasper is great with structural builds. I can confirm him.', time: '10:31 am', day: 'Yesterday' },
      { who: 'them', text: 'Perfect. Also — Let\'s lock in the gala team by Friday.', time: '8:02 am', day: 'Today' },
    ],
  },
  {
    id: 'c2', with: 'u4', name: 'Theo Akande', online: false, unread: 0,
    preview: 'Sounds good. Talk Monday.',
    messages: [
      { who: 'them', text: 'Hey Naomi, available May 30 for the Garden Gala?', time: '4:12 pm', day: 'May 9' },
      { who: 'me',   text: 'I am. Lead role?', time: '4:14 pm', day: 'May 9' },
      { who: 'them', text: 'Yes. 13:00 call, 11pm wrap. Pay is $50/hr.', time: '4:16 pm', day: 'May 9' },
      { who: 'me',   text: 'In.', time: '4:17 pm', day: 'May 9' },
      { who: 'them', text: 'Sounds good. Talk Monday.', time: '4:20 pm', day: 'May 9' },
    ],
  },
  {
    id: 'c3', with: 'u8', name: 'Olivia Greene', online: true, unread: 1,
    preview: 'Sending the moodboard now.',
    messages: [
      { who: 'them', text: 'Sending the moodboard now.', time: '7:45 am', day: 'Today' },
    ],
  },
];

const TESTIMONIALS = [
  { id: 'tm1', who: 'Mariana Cruz', role: 'Owner, Bloom & Fern Studio', quote: 'I used to spend Sunday nights texting florists from a spreadsheet. Now I post a gig at 9pm and have a confirmed team by morning.', avatar: 'mariana' },
  { id: 'tm2', who: 'Naomi Park',   role: 'Lead designer', quote: 'I have steady work with three studios I love. Rosy handles invoicing, ratings, taxes. I just show up and make beautiful things.', avatar: 'naomi' },
  { id: 'tm3', who: 'Theo Akande',  role: 'Founder, Floral Forge',    quote: 'The Lead role finally pays what leads are worth. My team stays. My clients see consistency.', avatar: 'theo' },
];

const FAQS = [
  { q: 'How does payment work?', a: 'Vendors fund gigs at booking; Rosy holds the funds in escrow. Workers are paid via Stripe Connect within 48 hours of approved hours.' },
  { q: 'What happens if a worker no-shows?', a: 'Vendors can dispute through the gig page. Verified no-shows affect the worker\'s rating and reduce future visibility.' },
  { q: 'Do I need experience?', a: 'For Assist roles, no. For Design and Lead, we verify portfolio and ID. Strike is open to anyone who can lift 50 lbs and follow direction.' },
  { q: 'Is there a fee?', a: 'Workers keep 92% of the gig rate. Vendors pay a 6% platform fee on top of worker pay.' },
];

window.RosyData = { USERS, VENUES, EVENTS, GIGS, GIG_TYPES, TRANSACTIONS, NOTIFICATIONS, MESSAGES, IMAGES, TESTIMONIALS, FAQS };

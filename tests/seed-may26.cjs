/**
 * Seed for 2026-05-26 (Tuesday)
 *
 * AM counts carry forward from May 25 PM:
 *   Annex 87 | Main 93 | Horse 3 | Mothers 61 | Kids 53 | Males 68 | Sick 62
 *
 * Variations from May 25:
 *   - 2 transfers Paddock - Mothers → Paddock - Kids
 *   - 1 sale from Paddock - Males
 *   - 1 vet referral in Sick/Vulnerable Flock (no count change)
 *   - Discrepancy: 1 animal missing in Annex Farm (PM = 86)
 *
 * End-of-day PM:
 *   Annex 86 (Disc) | Main 93 | Horse 3 | Mothers 59 | Kids 55 | Males 67 | Sick 62
 *   TOTAL = 425
 *
 * Run: node tests/seed-may26.cjs
 */
const axios = require('axios')
const fs    = require('fs')
const path  = require('path')

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => l.trim().split('='))
)
const API_KEY = env['VITE_AIRTABLE_API_KEY']
const BASE_ID = env['VITE_AIRTABLE_BASE_ID']

const api = axios.create({
  baseURL: `https://api.airtable.com/v0/${BASE_ID}`,
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SUPERVISOR = 'recVczrreYzYfI5Ap'

const DATE    = '2026-05-26'
const WEATHER = 'Partly cloudy, 20°C'
const AM_TIME = '06:30'
const PM_TIME = '17:50'

// Tuesday herdsman rotation (index 1): [1,2,3,4,0,1,2]
const HERDSMEN = [
  'recRFLWg5dM9pkb3Y', // h1 — Herdsman One
  'recDcRH2rHj7Naopr', // h2 — Kev
  'recCA0m9ifxyLKr5I', // h3 — john
  'rectmCgbrrMhGmDlq', // h4 — Zach
  'recGx6fe7K7BWFUTR', // h5 — Deon
]
const ROTATION = [1, 2, 3, 4, 0, 1, 2] // Tuesday

// Grazing grounds (day 8 from May 18)
const GRAZING_GROUNDS = ['Acacia Hill Estate', 'Acacia Ridge Farm', 'Acacia Springs Farm', 'Acacia Tumaini Farm']
const DAY_INDEX = 8
const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]
function grazingGround(gi) {
  if (GROUP_ORDER[gi] === 'Sick/Vulnerable Flock') return 'Enclosure (N/A)'
  return GRAZING_GROUNDS[(gi + DAY_INDEX) % GRAZING_GROUNDS.length]
}

// AM counts (from May 25 PM)
const AM_COUNTS = {
  'Annex Farm':            87,
  'Main Farm':             93,
  'Horsefield':             3,  // fixed — always 3
  'Paddock - Mothers':     61,
  'Paddock - Kids':        53,
  'Paddock - Males':       68,
  'Sick/Vulnerable Flock': 62,
}

// Group record IDs
const GROUPS = {
  annex:   'recNMlzuhytFfSGyp',
  main:    'recDchRg0pgV6Iw5L',
  horse:   'recx7QBhhrgA0KTWt',
  mothers: 'recUIHw606WPZdvvb',
  kids:    'recT6tNtTiGOut5t6',
  males:   'recRLck8JQb3f7qtx',
  sick:    'recYrHXDmJpxgnHoW',
}

// Existing session IDs for May 26
const SESSIONS = {
  'Annex Farm':            'rec2tRAXcdHwSsGQP',
  'Main Farm':             'recNhWQsds3yJtu0t',
  'Horsefield':            'recdjLdCw7Yz2WGeB',
  'Paddock - Mothers':     'recsNSR4o7ZssooMM',
  'Paddock - Kids':        'recruJsugYmgl0gby',
  'Paddock - Males':       'recVuvaF7eKzA1DmS',
  'Sick/Vulnerable Flock': 'recHB1thWBGbDxWIp',
}

async function createMovement(fields) {
  await sleep(220)
  const { data } = await api.post('/Animal%20Movements', { fields })
  return data
}

async function patchSession(id, fields) {
  await sleep(220)
  await api.patch(`/Daily%20Sessions/${id}`, { fields })
}

async function main() {
  // ── Phase 1: Set AM data ──
  console.log('\n── Setting AM data ──')
  for (let i = 0; i < GROUP_ORDER.length; i++) {
    const name   = GROUP_ORDER[i]
    const sessId = SESSIONS[name]
    await patchSession(sessId, {
      'Session ID':           `DAR-${DATE.replace(/-/g,'')}-${name.slice(0,3).toUpperCase()}${i}`,
      'AM Count':             AM_COUNTS[name],
      'AM Departure Time':    AM_TIME,
      'Grazing Ground':       grazingGround(i),
      Herdsman:               [HERDSMEN[ROTATION[i]]],
      'Counting Supervisor':  [SUPERVISOR],
      Weather:                WEATHER,
      Status:                 'Open',
    })
    console.log(`  ✓ AM  ${name.padEnd(25)} count=${AM_COUNTS[name]}  ground=${grazingGround(i)}`)
  }

  // ── Phase 2: Movements ──

  // 2a. Two transfers Mothers → Kids
  console.log('\n── 2 transfers Paddock - Mothers → Paddock - Kids ──')
  for (const [tag, time] of [['AV-NEW7', '09:10'], ['AV-NEW8', '09:15']]) {
    await createMovement({
      Session:          [SESSIONS['Paddock - Mothers']],
      'Ear Tag':        tag,
      'From Group':     [GROUPS.mothers],
      'To Group':       [GROUPS.kids],
      Time:             time,
      Reason:           'Transfer',
      'Destination Herdsman Confirmed': true,
      'Count Impact':   'Out (−1)',
      'Authorised By':  [SUPERVISOR],
    })
    console.log(`  ➜ Transfer: ${tag}  Mothers → Kids  (${time})`)
  }

  // 2b. One sale from Paddock - Males
  console.log('\n── 1 sale from Paddock - Males ──')
  await createMovement({
    Session:          [SESSIONS['Paddock - Males']],
    'Ear Tag':        'AV-0790',
    'From Group':     [GROUPS.males],
    Time:             '08:30',
    Reason:           'Sale',
    'Count Impact':   'Out (−1)',
    'Authorised By':  [SUPERVISOR],
  })
  console.log('  ➜ Sale: AV-0790  (Paddock - Males)')

  // 2c. Vet referral in Sick/Vulnerable Flock (no count change)
  console.log('\n── 1 vet referral in Sick/Vulnerable Flock ──')
  await createMovement({
    Session:          [SESSIONS['Sick/Vulnerable Flock']],
    'Ear Tag':        'AV-0615',
    'From Group':     [GROUPS.sick],
    Time:             '07:45',
    Reason:           'Vet Referral',
    'Health/Condition Notes': 'Persistent lameness — referred to Dr. Pieterse for assessment',
    'Vet Referral Flag':      true,
    'Count Impact':   'No Change',
    'Authorised By':  [SUPERVISOR],
  })
  console.log('  ➜ Vet Referral: AV-0615  (Sick/Vulnerable Flock)')

  // ── Phase 3: PM counts & close sessions ──
  // Annex Farm:      87 − 1 missing (discrepancy) = 86
  // Main Farm:       93  (no change)
  // Horsefield:       3  (fixed)
  // Mothers:         61 − 2 transfers = 59
  // Kids:            53 + 2 transfers = 55
  // Males:           68 − 1 sale = 67
  // Sick:            62  (vet referral, no count change)
  const PM_COUNTS = {
    'Annex Farm':             86,  // Discrepancy — 1 unaccounted
    'Main Farm':              93,
    'Horsefield':              3,
    'Paddock - Mothers':      59,
    'Paddock - Kids':         55,
    'Paddock - Males':        67,
    'Sick/Vulnerable Flock':  62,
  }

  console.log('\n── Closing sessions (PM) ──')
  for (const name of GROUP_ORDER) {
    const sessId  = SESSIONS[name]
    const pmCount = PM_COUNTS[name]
    const amCount = AM_COUNTS[name]
    const isDisc  = name === 'Annex Farm'

    await patchSession(sessId, {
      'PM Count':             pmCount,
      'PM Return Time':       PM_TIME,
      Status:                 isDisc ? 'Discrepancy' : 'Complete',
      'Supervisor Signature': true,
      'Herdsman Signature':   true,
      'Date/Time Signed':     new Date(`${DATE}T18:30:00`).toISOString(),
      Notes: isDisc
        ? 'One animal could not be located during PM count. Surrounding areas searched. Will investigate at next AM count.'
        : undefined,
    })
    const variance = pmCount - amCount
    const tag = isDisc ? '[Discrepancy]' : '[Complete]'
    console.log(`  ✓ ${name.padEnd(25)} PM=${pmCount}  VAR=${variance > 0 ? '+' : ''}${variance}  ${tag}`)
  }

  const grand = Object.values(PM_COUNTS).reduce((s, c) => s + c, 0)
  console.log(`\n  ${'TOTAL'.padEnd(25)} ${grand}`)
  console.log('\n✅ Done.')
}

main().catch((err) => {
  console.error('FATAL:', err.response?.data || err.message)
  process.exit(1)
})

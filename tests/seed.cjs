/**
 * Seed script — creates one week of dummy data (May 18-24, 2026).
 * 500 total animals distributed across 7 groups with daily movements,
 * herdsman rotation, and one discrepancy day.
 *
 * Run: node tests/seed.cjs
 */
const axios = require('axios')

// Reads from dar-app/.env  →  VITE_AIRTABLE_API_KEY and VITE_AIRTABLE_BASE_ID
const fs   = require('fs')
const path = require('path')
const env  = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => l.trim().split('='))
)
const API_KEY = env['VITE_AIRTABLE_API_KEY']
const BASE_ID = env['VITE_AIRTABLE_BASE_ID']
if (!API_KEY || !BASE_ID) throw new Error('Missing VITE_AIRTABLE_API_KEY or VITE_AIRTABLE_BASE_ID in .env')

const api = axios.create({
  baseURL: `https://api.airtable.com/v0/${BASE_ID}`,
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Staff record IDs
const STAFF = {
  supervisor: 'recVczrreYzYfI5Ap',   // Supervisor One
  manager:    'recsbuKSozM2dBggp',   // Farm Manager
  h1: 'recRFLWg5dM9pkb3Y',           // Herdsman One
  h2: 'recDcRH2rHj7Naopr',           // Kev
  h3: 'recCA0m9ifxyLKr5I',           // john
  h4: 'rectmCgbrrMhGmDlq',           // Zach
  h5: 'recGx6fe7K7BWFUTR',           // Deon
}

const HERDSMEN = [STAFF.h1, STAFF.h2, STAFF.h3, STAFF.h4, STAFF.h5]

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const GRAZING = {
  'Annex Farm':          'North Field',
  'Main Farm':           'South Pasture',
  'Horsefield':          'East Ridge',
  'Paddock - Mothers':   'Mothers Paddock',
  'Paddock - Kids':      'Kids Paddock',
  'Paddock - Males':     'Males Paddock',
  'Sick/Vulnerable Flock': 'Enclosure (N/A)',
}

// Herdsman index (0-4 → h1-h5) per group per day
//   Groups: [Annex, Main, Horse, Mothers, Kids, Males, Sick]
// 5 herdsmen × 7 groups — each herdsman covers 1-2 groups per day, rotated daily
const ROTATION = [
  [0, 1, 2, 3, 4, 0, 1],  // Mon May 18
  [1, 2, 3, 4, 0, 1, 2],  // Tue May 19
  [2, 3, 4, 0, 1, 2, 3],  // Wed May 20
  [3, 4, 0, 1, 2, 3, 4],  // Thu May 21
  [4, 0, 1, 2, 3, 4, 0],  // Fri May 22
  [0, 2, 4, 1, 3, 0, 2],  // Sat May 23 — varied
  [1, 3, 0, 2, 4, 1, 3],  // Sun May 24 — varied
]

const DATES   = ['2026-05-18','2026-05-19','2026-05-20','2026-05-21','2026-05-22','2026-05-23','2026-05-24']
const WEATHER = [
  'Partly cloudy, 22°C', 'Clear, 26°C', 'Overcast, 18°C',
  'Clear, 25°C', 'Light rain, 16°C', 'Clear, 20°C', 'Sunny, 23°C',
]
const AM_TIMES = ['06:30','06:25','06:40','06:30','06:45','06:35','06:30']
const PM_TIMES = ['17:45','17:50','17:30','17:55','18:00','17:40','17:45']

// Movements: days where events occur
// Each entry: { fromGroup, toGroup, earTag, reason, notes, time }
// null fromGroup = birth (attached to toGroup session)
const DAILY_MOVEMENTS = {
  '2026-05-19': [
    { fromGroup: 'Main Farm', toGroup: 'Annex Farm',    earTag: 'AV-0234', reason: 'Transfer',    notes: '',                                               time: '09:15' },
  ],
  '2026-05-20': [
    { fromGroup: 'Sick/Vulnerable Flock', toGroup: null, earTag: 'AV-0512', reason: 'Death',      notes: 'Found deceased in enclosure — suspected respiratory illness', time: '07:30' },
  ],
  '2026-05-21': [
    { fromGroup: null, toGroup: 'Paddock - Mothers',   earTag: 'AV-NEW1', reason: 'Birth',        notes: '',                                               time: '05:45' },
    { fromGroup: 'Horsefield', toGroup: 'Paddock - Kids', earTag: 'AV-0347', reason: 'Transfer', notes: '',                                               time: '10:00' },
  ],
  '2026-05-22': [
    { fromGroup: 'Paddock - Males', toGroup: null,      earTag: 'AV-0789', reason: 'Sale',        notes: '',                                               time: '08:00' },
  ],
  '2026-05-23': [
    { fromGroup: 'Horsefield',    toGroup: 'Paddock - Kids', earTag: 'AV-0350', reason: 'Transfer', notes: '',                                            time: '09:45' },
    { fromGroup: 'Horsefield',    toGroup: 'Paddock - Kids', earTag: 'AV-0351', reason: 'Transfer', notes: '',                                            time: '09:50' },
  ],
  '2026-05-24': [
    { fromGroup: 'Sick/Vulnerable Flock', toGroup: null, earTag: 'AV-0503', reason: 'Vet Referral', notes: 'Respiratory distress — referred to Dr. Pieterse', time: '08:15' },
  ],
}

// Manual PM count overrides (to create discrepancies)
// key = groupName, value = delta from expected
const PM_OVERRIDES = {
  '2026-05-22': { 'Main Farm': -1 },  // 1 animal unaccounted for → Discrepancy
}

async function fetchGroups() {
  const { data } = await api.get('/Groups', { params: { pageSize: 100 } })
  const map = {}
  for (const r of data.records) map[r.fields['Group Name']] = r.id
  return map
}

async function createSession(fields) {
  await sleep(220)
  const { data } = await api.post('/Daily%20Sessions', { fields })
  return data
}

async function updateSession(id, fields) {
  await sleep(220)
  await api.patch(`/Daily%20Sessions/${id}`, { fields })
}

async function createMovement(fields) {
  await sleep(220)
  const { data } = await api.post('/Animal%20Movements', { fields })
  return data
}

async function main() {
  console.log('Fetching groups...')
  const groups = await fetchGroups()
  console.log('Groups loaded:', Object.keys(groups).join(', '))

  // Running animal counts — start at 500 total
  const counts = {
    'Annex Farm':           85,
    'Main Farm':            95,
    'Horsefield':           80,
    'Paddock - Mothers':    60,
    'Paddock - Kids':       45,
    'Paddock - Males':      70,
    'Sick/Vulnerable Flock': 65,
  }

  for (let d = 0; d < DATES.length; d++) {
    const date    = DATES[d]
    const weather = WEATHER[d]
    console.log(`\n── ${date} ──`)

    const sessionIds = {}

    // Create sessions (AM phase)
    for (let g = 0; g < GROUP_ORDER.length; g++) {
      const name    = GROUP_ORDER[g]
      const groupId = groups[name]
      if (!groupId) { console.warn(`  WARN: no group ID for "${name}"`); continue }

      const sess = await createSession({
        Date:              date,
        Group:             [groupId],
        'Session ID':      `DAR-${date.replace(/-/g,'')}-${name.slice(0,3).toUpperCase()}`,
        Status:            'Open',
        'AM Count':        counts[name],
        'AM Departure Time': AM_TIMES[d],
        'Grazing Ground':  GRAZING[name],
        Herdsman:          [HERDSMEN[ROTATION[d][g]]],
        'Counting Supervisor': [STAFF.supervisor],
        Weather:           weather,
      })
      sessionIds[name] = sess.id
      console.log(`  + session ${name} (AM=${counts[name]})`)
    }

    // Log movements for this day
    const moves = DAILY_MOVEMENTS[date] || []
    for (const m of moves) {
      const attachGroup = m.fromGroup || m.toGroup
      const sessId      = sessionIds[attachGroup]
      if (!sessId) { console.warn(`  WARN: no session for movement group "${attachGroup}"`); continue }

      await createMovement({
        Session:   [sessId],
        'Ear Tag': m.earTag,
        'From Group': m.fromGroup ? [groups[m.fromGroup]] : undefined,
        'To Group':   m.toGroup   ? [groups[m.toGroup]]   : undefined,
        Time:         m.time,
        Reason:       m.reason,
        'Health/Condition Notes': m.notes || undefined,
        'Vet Referral Flag':           m.reason === 'Vet Referral',
        'Destination Herdsman Confirmed': m.reason === 'Transfer',
        'Count Impact': m.reason === 'Death' || m.reason === 'Sale' ? 'Out (−1)'
                       : m.reason === 'Birth' ? 'In (+1)'
                       : m.reason === 'Transfer' ? 'Out (−1)' // for source session
                       : 'No Change',
        'Authorised By': [STAFF.supervisor],
      })
      console.log(`  ➜ ${m.reason}: ${m.earTag} (${m.fromGroup || '—'} → ${m.toGroup || '—'})`)
    }

    // Compute expected PM counts from movements
    const pm = { ...counts }
    for (const m of moves) {
      if (m.reason === 'Death' || m.reason === 'Sale') {
        pm[m.fromGroup] -= 1
      } else if (m.reason === 'Birth') {
        pm[m.toGroup] += 1
      } else if (m.reason === 'Transfer') {
        pm[m.fromGroup] -= 1
        pm[m.toGroup]   += 1
      }
      // Vet Referral: no count change
    }

    // Apply manual discrepancy overrides
    const overrides = PM_OVERRIDES[date] || {}
    for (const [grp, delta] of Object.entries(overrides)) {
      pm[grp] += delta
    }

    // Close sessions (PM phase)
    const discrepancyGroups = new Set(
      Object.entries(overrides).filter(([,d]) => d < 0).map(([g]) => g)
    )

    for (const name of GROUP_ORDER) {
      const sessId = sessionIds[name]
      if (!sessId) continue

      const pmCount  = pm[name]
      const hasDisc  = discrepancyGroups.has(name)
      const status   = hasDisc ? 'Discrepancy' : 'Complete'

      await updateSession(sessId, {
        'PM Count':         pmCount,
        'PM Return Time':   PM_TIMES[d],
        Status:             status,
        'Supervisor Signature': true,
        'Herdsman Signature':   true,
        'Witness Signature':    name === 'Main Farm',
        'Date/Time Signed': new Date(`${date}T18:30:00`).toISOString(),
        Notes: hasDisc
          ? 'One animal could not be located during PM count. Area searched. Will monitor tomorrow.'
          : undefined,
      })
      console.log(`  ✓ ${name} closed  PM=${pmCount}  [${status}]`)
    }

    // Carry PM counts forward as next day's AM
    for (const name of GROUP_ORDER) {
      counts[name] = pm[name]
    }

    const total = Object.values(counts).reduce((s, c) => s + c, 0)
    console.log(`  Total animals end of day: ${total}`)
  }

  console.log('\n✅ Done. Final herd counts:')
  let grand = 0
  for (const [name, c] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(25)} ${c}`)
    grand += c
  }
  console.log(`  ${'TOTAL'.padEnd(25)} ${grand}`)
}

main().catch((err) => {
  console.error('FATAL:', err.response?.data || err.message)
  process.exit(1)
})

/**
 * Populate today's (2026-05-25) sessions with correct data.
 * AM counts continue from where May 24 ended (total: 498).
 * Rotation follows Monday pattern (same as May 18).
 * One transfer movement added for realism.
 *
 * Run: node tests/seed-today.cjs
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
if (!API_KEY || !BASE_ID) throw new Error('Missing credentials in .env')

const api = axios.create({
  baseURL: `https://api.airtable.com/v0/${BASE_ID}`,
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Staff IDs
const SUPERVISOR = 'recVczrreYzYfI5Ap'
const HERDSMEN   = [
  'recRFLWg5dM9pkb3Y', // h1 — Herdsman One
  'recDcRH2rHj7Naopr', // h2 — Kev
  'recCA0m9ifxyLKr5I', // h3 — john
  'rectmCgbrrMhGmDlq', // h4 — Zach
  'recGx6fe7K7BWFUTR', // h5 — Deon
]

// Monday rotation (same as May 18)
const ROTATION = [0, 1, 2, 3, 4, 0, 1]

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const GRAZING_GROUNDS = ['North Field', 'South Pasture', 'East Ridge', 'Northern Ranch']
const DAY_INDEX = 7  // May 25 is 7 days after May 18 (day 0)

function grazingGround(groupIndex) {
  if (GROUP_ORDER[groupIndex] === 'Sick/Vulnerable Flock') return 'Enclosure (N/A)'
  return GRAZING_GROUNDS[(groupIndex + DAY_INDEX) % GRAZING_GROUNDS.length]
}

// AM counts = end-of-day May 24
const AM_COUNTS = {
  'Annex Farm':             86,
  'Main Farm':              93,
  'Horsefield':              3,  // horses are fixed at 3 — never changes
  'Paddock - Mothers':      61,
  'Paddock - Kids':         48,
  'Paddock - Males':        69,
  'Sick/Vulnerable Flock':  64,
}

const DATE        = '2026-05-25'
const WEATHER     = 'Clear, 21°C'
const AM_TIME     = '06:30'
const PM_TIME     = '17:45'

// One movement today: Transfer from Paddock - Males → Paddock - Mothers (male lamb to mothers paddock)
const MOVEMENTS = [
  { fromGroup: 'Paddock - Males', toGroup: 'Annex Farm', earTag: 'AV-0801', reason: 'Transfer', notes: '', time: '09:20' },
]

async function main() {
  // Fetch groups
  const { data: gData } = await api.get('/Groups', { params: { pageSize: 100 } })
  const groups = {}
  for (const r of gData.records) groups[r.fields['Group Name']] = r.id
  console.log('Groups loaded:', Object.keys(groups).join(', '))

  // Fetch today's existing sessions
  const { data: sData } = await api.get('/Daily%20Sessions', {
    params: { filterByFormula: `IS_SAME({Date}, '${DATE}', 'day')`, pageSize: 100 },
  })
  const sessionByGroup = {}
  for (const r of sData.records) {
    const gId   = r.fields['Group']?.[0]
    const entry = Object.entries(groups).find(([, id]) => id === gId)
    if (entry) sessionByGroup[entry[0]] = r.id
  }
  console.log(`Found ${Object.keys(sessionByGroup).length} existing sessions for ${DATE}`)

  // Phase 1: update sessions with AM data
  const sessionIds = {}
  for (let i = 0; i < GROUP_ORDER.length; i++) {
    const name    = GROUP_ORDER[i]
    const groupId = groups[name]
    const sessId  = sessionByGroup[name]
    if (!sessId) { console.warn(`  WARN: no session for "${name}"`); continue }

    await sleep(220)
    await api.patch(`/Daily%20Sessions/${sessId}`, {
      fields: {
        'Session ID':            `DAR-${DATE.replace(/-/g,'')}-${name.slice(0,3).toUpperCase()}${i}`,
        'AM Count':              AM_COUNTS[name],
        'AM Departure Time':     AM_TIME,
        'Grazing Ground':        grazingGround(i),
        Herdsman:                [HERDSMEN[ROTATION[i]]],
        'Counting Supervisor':   [SUPERVISOR],
        Weather:                 WEATHER,
        Status:                  'Open',
      },
    })
    sessionIds[name] = sessId
    console.log(`  ✓ AM set  ${name.padEnd(25)} count=${AM_COUNTS[name]}`)
  }

  // Phase 2: create movements
  for (const m of MOVEMENTS) {
    const attachGroup = m.fromGroup || m.toGroup
    const sessId      = sessionIds[attachGroup]
    if (!sessId) { console.warn(`  WARN: no session for "${attachGroup}"`); continue }

    await sleep(220)
    await api.post('/Animal%20Movements', {
      fields: {
        Session:   [sessId],
        'Ear Tag': m.earTag,
        'From Group': m.fromGroup ? [groups[m.fromGroup]] : undefined,
        'To Group':   m.toGroup   ? [groups[m.toGroup]]   : undefined,
        Time:         m.time,
        Reason:       m.reason,
        'Health/Condition Notes': m.notes || undefined,
        'Vet Referral Flag':               m.reason === 'Vet Referral',
        'Destination Herdsman Confirmed':  m.reason === 'Transfer',
        'Count Impact':                    'Out (−1)',
        'Authorised By': [SUPERVISOR],
      },
    })
    console.log(`  ➜ ${m.reason}: ${m.earTag}  (${m.fromGroup} → ${m.toGroup})`)
  }

  // Phase 3: compute PM counts and close sessions
  const pm = { ...AM_COUNTS }
  for (const m of MOVEMENTS) {
    if (m.reason === 'Death' || m.reason === 'Sale') {
      pm[m.fromGroup] -= 1
    } else if (m.reason === 'Birth') {
      pm[m.toGroup] += 1
    } else if (m.reason === 'Transfer') {
      pm[m.fromGroup] -= 1
      pm[m.toGroup]   += 1
    }
  }

  for (const name of GROUP_ORDER) {
    const sessId = sessionIds[name]
    if (!sessId) continue

    await sleep(220)
    await api.patch(`/Daily%20Sessions/${sessId}`, {
      fields: {
        'PM Count':              name === 'Horsefield' ? 3 : pm[name],
        'PM Return Time':        PM_TIME,
        Status:                  'Complete',
        'Supervisor Signature':  true,
        'Herdsman Signature':    true,
        'Date/Time Signed':      new Date(`${DATE}T18:30:00`).toISOString(),
      },
    })
    console.log(`  ✓ Closed  ${name.padEnd(25)} PM=${pm[name]}  [Complete]`)
  }

  const total = Object.values(pm).reduce((s, c) => s + c, 0)
  console.log(`\nTotal animals end of day: ${total}`)
  console.log('\n✅ Done.')
}

main().catch((err) => {
  console.error('FATAL:', err.response?.data || err.message)
  process.exit(1)
})

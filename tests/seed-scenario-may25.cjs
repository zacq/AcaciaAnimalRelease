/**
 * Scenario seed for 2026-05-25:
 *  - Horsefield fixed to 3 horses (permanent rule)
 *  - 5 births in Paddock - Mothers
 *  - 5 newborns transferred from Paddock - Mothers → Paddock - Kids
 *  - 2 deaths in Sick/Vulnerable Flock
 *
 * Run: node tests/seed-scenario-may25.cjs
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

// Today's session IDs (May 25, 2026)
const SESSIONS = {
  annex:    { id: 'recgylZN556YHc2ZE', am: 86,  pm: 87  }, // Annex Farm
  main:     { id: 'recXLSN4K6LvgfGAQ', am: 93,  pm: 93  }, // Main Farm
  horse:    { id: 'rec35OcLLVYLulPT1', am: 77,  pm: 77  }, // Horsefield → fix to 3
  mothers:  { id: 'recOREfWqn3FaTSx9', am: 61,  pm: 61  }, // Paddock - Mothers
  kids:     { id: 'recXsHwixps3OuMOa', am: 48,  pm: 48  }, // Paddock - Kids
  males:    { id: 'reciq1ZlUtCGIyMpq', am: 69,  pm: 68  }, // Paddock - Males
  sick:     { id: 'rec2s4CH9lqvOjLnr', am: 64,  pm: 64  }, // Sick/Vulnerable Flock
}

// Group record IDs
const GROUPS = {
  mothers: 'recUIHw606WPZdvvb',
  kids:    'recT6tNtTiGOut5t6',
  sick:    'recYrHXDmJpxgnHoW',
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
  // ── 1. Fix Horsefield to 3 (permanent rule: horses always fixed at 3) ──
  console.log('\n── Fixing Horsefield to 3 horses ──')
  await patchSession(SESSIONS.horse.id, { 'AM Count': 3, 'PM Count': 3 })
  console.log('  ✓ Horsefield  AM=3  PM=3')

  // ── 2. Five births in Paddock - Mothers ──
  console.log('\n── 5 births in Paddock - Mothers ──')
  const birthTags = ['AV-NEW2', 'AV-NEW3', 'AV-NEW4', 'AV-NEW5', 'AV-NEW6']
  for (const tag of birthTags) {
    await createMovement({
      Session:          [SESSIONS.mothers.id],
      'Ear Tag':        tag,
      'To Group':       [GROUPS.mothers],
      Time:             '06:45',
      Reason:           'Birth',
      'Count Impact':   'In (+1)',
      'Authorised By':  [SUPERVISOR],
    })
    console.log(`  ➜ Birth: ${tag} → Paddock - Mothers`)
  }

  // ── 3. Transfer 5 newborns Mothers → Kids ──
  console.log('\n── Transfer 5 newborns to Paddock - Kids ──')
  for (const tag of birthTags) {
    await createMovement({
      Session:          [SESSIONS.mothers.id],
      'Ear Tag':        tag,
      'From Group':     [GROUPS.mothers],
      'To Group':       [GROUPS.kids],
      Time:             '07:30',
      Reason:           'Transfer',
      'Destination Herdsman Confirmed': true,
      'Count Impact':   'Out (−1)',
      'Authorised By':  [SUPERVISOR],
    })
    console.log(`  ➜ Transfer: ${tag}  Mothers → Kids`)
  }

  // ── 4. Two deaths in Sick/Vulnerable Flock ──
  console.log('\n── 2 deaths in Sick/Vulnerable Flock ──')
  for (const [tag, notes] of [
    ['AV-0611', 'Found deceased — suspected pneumonia'],
    ['AV-0612', 'Found deceased — unknown cause'],
  ]) {
    await createMovement({
      Session:          [SESSIONS.sick.id],
      'Ear Tag':        tag,
      'From Group':     [GROUPS.sick],
      Time:             '08:00',
      Reason:           'Death',
      'Health/Condition Notes': notes,
      'Count Impact':   'Out (−1)',
      'Authorised By':  [SUPERVISOR],
    })
    console.log(`  ➜ Death: ${tag} — ${notes}`)
  }

  // ── 5. Update PM counts to reflect scenario ──
  // Mothers: 61 AM + 5 births − 5 transfers = 61 (net zero)
  // Kids:    48 AM + 5 transfers = 53
  // Sick:    64 AM − 2 deaths   = 62
  console.log('\n── Updating PM counts ──')
  await patchSession(SESSIONS.mothers.id, { 'PM Count': 61 })
  console.log('  ✓ Paddock - Mothers  PM=61')

  await patchSession(SESSIONS.kids.id, { 'PM Count': 53 })
  console.log('  ✓ Paddock - Kids     PM=53')

  await patchSession(SESSIONS.sick.id, { 'PM Count': 62 })
  console.log('  ✓ Sick/Vulnerable    PM=62')

  // ── Summary ──
  const totals = {
    'Annex Farm':             87,
    'Main Farm':              93,
    'Horsefield':              3,
    'Paddock - Mothers':      61,
    'Paddock - Kids':         53,
    'Paddock - Males':        68,
    'Sick/Vulnerable Flock':  62,
  }
  const grand = Object.values(totals).reduce((s, c) => s + c, 0)
  console.log('\n── End-of-day PM counts ──')
  for (const [name, c] of Object.entries(totals)) {
    console.log(`  ${name.padEnd(25)} ${c}`)
  }
  console.log(`  ${'TOTAL'.padEnd(25)} ${grand}`)
  console.log('\n✅ Done.')
}

main().catch((err) => {
  console.error('FATAL:', err.response?.data || err.message)
  process.exit(1)
})

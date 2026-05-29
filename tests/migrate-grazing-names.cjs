/**
 * One-time migration: replace placeholder grazing ground names in all
 * Daily Sessions records with the real Acacia farm names.
 *
 * North Field    → Acacia Hill Estate
 * South Pasture  → Acacia Ridge Farm
 * East Ridge     → Acacia Springs Farm
 * Northern Ranch → Acacia Tumaini Farm
 *
 * Run: node tests/migrate-grazing-names.cjs
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
const sleep = ms => new Promise(r => setTimeout(r, ms))

const RENAME = {
  'North Field':    'Acacia Hill Estate',
  'South Pasture':  'Acacia Ridge Farm',
  'East Ridge':     'Acacia Springs Farm',
  'Northern Ranch': 'Acacia Tumaini Farm',
}

async function fetchAllSessions() {
  const records = []
  let offset = null
  do {
    await sleep(250)
    const params = { pageSize: 100, fields: ['Grazing Ground'] }
    if (offset) params.offset = offset
    const { data } = await api.get('/Daily%20Sessions', { params })
    records.push(...data.records)
    offset = data.offset || null
  } while (offset)
  return records
}

async function main() {
  console.log('Fetching all Daily Sessions…')
  const all = await fetchAllSessions()
  console.log(`  Found ${all.length} total sessions`)

  const toUpdate = all.filter(r => RENAME[r.fields['Grazing Ground']])
  console.log(`  ${toUpdate.length} sessions need renaming\n`)

  if (toUpdate.length === 0) { console.log('Nothing to do.'); return }

  // Batch PATCH in groups of 10 (Airtable max)
  let updated = 0
  for (let i = 0; i < toUpdate.length; i += 10) {
    await sleep(250)
    const chunk = toUpdate.slice(i, i + 10)
    const records = chunk.map(r => ({
      id: r.id,
      fields: { 'Grazing Ground': RENAME[r.fields['Grazing Ground']] },
    }))
    await api.patch('/Daily%20Sessions', { records })
    updated += chunk.length
    process.stdout.write(`  Updated ${updated}/${toUpdate.length}\r`)
  }

  console.log(`\n\n── Summary ──`)
  const tally = {}
  toUpdate.forEach(r => {
    const old = r.fields['Grazing Ground']
    tally[old] = (tally[old] || 0) + 1
  })
  Object.entries(tally).forEach(([old, n]) =>
    console.log(`  "${old}" → "${RENAME[old]}"  (${n} sessions)`)
  )
  console.log('\n✅ Done.')
}

main().catch(e => {
  console.error('FATAL:', e.response?.data || e.message)
  process.exit(1)
})

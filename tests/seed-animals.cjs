/**
 * Import 206 animals from Live Animal Data Sheet.xlsx into Airtable.
 *
 * Group assignment (arbitrary — user will upload corrected version):
 *   Gender M               → Paddock - Males
 *   Gender F + mths age    → Paddock - Kids
 *   Gender F               → Paddock - Mothers
 *   No gender, SAANEN/DAIRY/GALLA/ANGORA/ANGLONUBIAN/TOGGEN/ALPINE → Sick/Vulnerable Flock
 *   No gender, BOER full   → Paddock - Males  (rams)
 *   No gender, B/B-hybrid  → Paddock - Kids   (young Boer goats)
 *   No gender, D/DORPER    → Main Farm
 *   No gender, R-M/RM/RMM/MM/DMM variants → Annex Farm
 *   Remaining              → Annex Farm
 *
 * Run: node tests/seed-animals.cjs
 */
const axios = require('axios')
const XLSX  = require('xlsx')
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

const WEIGHT_LOGS_TABLE = 'tbldmaYgGCL839SMX'
const TODAY = new Date().toISOString().split('T')[0] // 2026-05-29

// ── Group assignment ──────────────────────────────────────────────────────────
const SPECIALTY_BREEDS = /SAANEN|DAIRY|ANGLON|TOGGEN|ANGORA|ALPINE|FRENCH|BRITISH|KALAHARI|GALLA/i
const BOER_FULL        = /^BOER$|^BOER\//i
const BOER_KID         = /^B$|^B\/|^DMM$|^RMM$/i  // DMM/RMM = Dorper-Merino/Rambouillet-Merino kids
const DORPER           = /^D$|^DOPPER$|^DORPER/i
const MERINO           = /^R-M$|^RM$|^R-MM$|^MM$|^RMM$|^DMM$/i

function assignGroup(breed, gender, age, groupIds) {
  const b = (breed || '').trim()
  const a = (age  || '').toLowerCase()
  const g = (gender || '').toUpperCase()

  if (g === 'M') return groupIds['Paddock - Males']
  if (g === 'F') {
    if (a.includes('mths') || a.includes('month')) return groupIds['Paddock - Kids']
    return groupIds['Paddock - Mothers']
  }
  // No gender data — use breed heuristic
  if (SPECIALTY_BREEDS.test(b)) return groupIds['Sick/Vulnerable Flock']
  if (BOER_FULL.test(b))        return groupIds['Paddock - Males']
  if (BOER_KID.test(b))         return groupIds['Paddock - Kids']
  if (DORPER.test(b))           return groupIds['Main Farm']
  if (MERINO.test(b))           return groupIds['Annex Farm']
  return groupIds['Annex Farm']  // safe default
}

// ── Breeding class normaliser ─────────────────────────────────────────────────
const BREED_CLASS_MAP = { H: 'Hybrid', P: 'Pure', 'P-P': 'P-P', PP: 'P-P' }
function normaliseBreedClass(raw) {
  if (!raw) return undefined
  const k = String(raw).trim().toUpperCase()
  return BREED_CLASS_MAP[k] || undefined  // drop unknown codes
}

// ── DOB parsing ───────────────────────────────────────────────────────────────
function parseDOB(dob) {
  if (!dob) return { isoDate: null, birthYear: null }
  if (dob instanceof Date) return { isoDate: dob.toISOString().split('T')[0], birthYear: null }
  if (typeof dob === 'number' && dob > 1900 && dob < 2100) return { isoDate: null, birthYear: dob }
  return { isoDate: null, birthYear: null }
}

// ── Batch create helper (up to 10 records per call) ──────────────────────────
async function batchCreate(table, records) {
  const results = []
  for (let i = 0; i < records.length; i += 10) {
    await sleep(250)
    const chunk = records.slice(i, i + 10)
    const { data } = await api.post(`/${encodeURIComponent(table)}`, { records: chunk.map(f => ({ fields: f })) })
    results.push(...data.records)
    process.stdout.write(`  → ${results.length}/${records.length}\r`)
  }
  return results
}

async function main() {
  // ── Fetch groups ──
  console.log('Fetching groups...')
  const { data: gData } = await api.get('/Groups', { params: { pageSize: 100 } })
  const groupIds = {}
  for (const r of gData.records) groupIds[r.fields['Group Name']] = r.id
  console.log('Groups:', Object.entries(groupIds).map(([n,id]) => `${n}=${id}`).join(', '))

  // ── Read Excel ──
  console.log('\nReading Excel...')
  const wb = XLSX.readFile(path.join(__dirname, '../../Live Animal Data Sheet.xlsx'), { cellDates: true })
  const ws = wb.Sheets['Sheet1']
  const json = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true })
  const animals = json.filter(r => r['Left Tag Color'] || r['Right Tag Color'] || r['Breed'])
  console.log(`Found ${animals.length} animal rows`)

  // ── Build records ──
  const animalRecords = []
  const weightLogs    = [] // { animalIndex, weight }

  for (let i = 0; i < animals.length; i++) {
    const a = animals[i]
    const leftTag  = String(a['Left Tag Color']  || '').trim()
    const rightTag = String(a['Right Tag Color'] || '').trim()
    const earTag   = rightTag || leftTag  // Right preferred
    if (!earTag) continue               // skip if both blank

    const { isoDate, birthYear } = parseDOB(a['DOB / Year'])
    const weight = typeof a['Weight kg'] === 'number' && a['Weight kg'] > 0 ? a['Weight kg'] : null
    const groupId = assignGroup(a['Breed'], a['Gender'], a['Age'], groupIds)

    const fields = {
      'Ear Tag':          earTag,
      'Left Tag':         leftTag  || undefined,
      'Right Tag':        rightTag || undefined,
      'Breed':            a['Breed']                    || undefined,
      'Breeding Class':   normaliseBreedClass(a['Breeding Class(Pure/Hybrid)']),
      'Foundation Breed': a['Foundation breed']          || undefined,
      'Breed Improver':   a['Breed Improver']            || undefined,
      'Gender':           a['Gender']                   || undefined,
      'Date of Birth':    isoDate   || undefined,
      'Birth Year':       birthYear || undefined,
      'Current Weight kg': weight   || undefined,
      'Sire':             String(a['Sire / Father'] || '').trim() || undefined,
      'Dam':              String(a['Dam / Mother']  || '').trim() || undefined,
      'Source':           a['Source']    || undefined,
      'Breeder':          a['Breeder/']  || undefined,
      'Comments':         a['Comments']  || undefined,
      'Status':           'Active',
      'Group':            groupId ? [groupId] : undefined,
      'Date Added':       TODAY,
    }
    // Strip undefined
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k])

    if (weight) weightLogs.push({ index: animalRecords.length, weight, tag: earTag })
    animalRecords.push(fields)
  }

  console.log(`Built ${animalRecords.length} animal records (${weightLogs.length} with weight data)`)

  // Distribution preview
  const dist = {}
  for (const f of animalRecords) {
    const gid = f['Group']?.[0]
    const name = Object.entries(groupIds).find(([,id]) => id === gid)?.[0] || 'Unknown'
    dist[name] = (dist[name] || 0) + 1
  }
  console.log('\nGroup distribution:')
  Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([g,c]) => console.log(`  ${g.padEnd(28)} ${c}`))

  // ── Import animals ──
  console.log('\n── Importing animals ──')
  const created = await batchCreate('Animal Registry', animalRecords)
  console.log(`\n  ✓ ${created.length} animals created`)

  // ── Create weight log records ──
  if (weightLogs.length > 0) {
    console.log('\n── Creating initial weight logs ──')
    const logRecords = weightLogs.map(({ index, weight, tag }) => ({
      'Animal':     [created[index].id],
      'Weigh Date': TODAY,
      'Weight kg':  weight,
      'Notes':      'Initial import from spreadsheet',
    }))
    await sleep(500)
    // Use axios directly for Weight Logs table (different table ID)
    const logResults = []
    for (let i = 0; i < logRecords.length; i += 10) {
      await sleep(250)
      const chunk = logRecords.slice(i, i + 10)
      const { data } = await api.post(`/${WEIGHT_LOGS_TABLE}`, { records: chunk.map(f => ({ fields: f })) })
      logResults.push(...data.records)
      process.stdout.write(`  → ${logResults.length}/${logRecords.length}\r`)
    }
    console.log(`\n  ✓ ${logResults.length} weight logs created`)
  }

  console.log('\n✅ Done.')
  console.log(`  Total animals: ${created.length}`)
  Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([g,c]) => console.log(`  ${g.padEnd(28)} ${c}`))
}

main().catch(err => {
  console.error('FATAL:', err.response?.data || err.message)
  process.exit(1)
})

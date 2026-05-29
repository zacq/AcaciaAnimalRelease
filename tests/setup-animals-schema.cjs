/**
 * Setup script — extends Animal Registry table and creates Weight Logs table.
 * Safe to re-run: skips fields that already exist.
 *
 * Run: node tests/setup-animals-schema.cjs
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

const meta = axios.create({
  baseURL: `https://api.airtable.com/v0/meta/bases/${BASE_ID}`,
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

const REGISTRY_TABLE_ID = 'tblLP5H2GpqdLYX1P'

// Fields to add to Animal Registry
const NEW_REGISTRY_FIELDS = [
  { name: 'Left Tag',         type: 'singleLineText' },
  { name: 'Right Tag',        type: 'singleLineText' },
  { name: 'Breed',            type: 'singleLineText' },
  {
    name: 'Breeding Class', type: 'singleSelect',
    options: { choices: [
      { name: 'Pure',   color: 'greenLight2' },
      { name: 'Hybrid', color: 'blueLight2'  },
      { name: 'P-P',    color: 'cyanLight2'  },
    ]},
  },
  { name: 'Foundation Breed', type: 'singleLineText' },
  { name: 'Breed Improver',   type: 'singleLineText' },
  {
    name: 'Gender', type: 'singleSelect',
    options: { choices: [
      { name: 'F', color: 'pinkLight2' },
      { name: 'M', color: 'blueLight2' },
    ]},
  },
  {
    name: 'Date of Birth', type: 'date',
    options: { dateFormat: { name: 'iso' } },
  },
  { name: 'Birth Year',        type: 'number', options: { precision: 0 } },
  { name: 'Current Weight kg', type: 'number', options: { precision: 1 } },
  { name: 'Sire',              type: 'singleLineText' },
  { name: 'Dam',               type: 'singleLineText' },
  { name: 'Source',            type: 'singleLineText' },
  { name: 'Breeder',           type: 'singleLineText' },
  { name: 'Comments',          type: 'singleLineText' },
]

async function addField(tableId, fieldDef, existingNames) {
  if (existingNames.has(fieldDef.name)) {
    console.log(`  ↷ Skip  ${fieldDef.name}  (already exists)`)
    return
  }
  await sleep(250)
  try {
    await meta.post(`/tables/${tableId}/fields`, fieldDef)
    console.log(`  ✓ Added ${fieldDef.name}`)
  } catch (e) {
    console.error(`  ✗ ${fieldDef.name}:`, e.response?.data?.error?.message || e.message)
  }
}

async function main() {
  // ── 1. Fetch existing fields ──
  console.log('\n── Fetching existing Animal Registry fields ──')
  const { data: tablesData } = await meta.get('/tables')
  const regTable = tablesData.tables.find(t => t.id === REGISTRY_TABLE_ID)
  const existingNames = new Set(regTable.fields.map(f => f.name))
  console.log('  Existing:', [...existingNames].join(', '))

  // ── 2. Add new fields to Animal Registry ──
  console.log('\n── Adding fields to Animal Registry ──')
  for (const field of NEW_REGISTRY_FIELDS) {
    await addField(REGISTRY_TABLE_ID, field, existingNames)
  }

  // ── 3. Update Status field options to include all needed values ──
  // (Airtable allows adding choices; existing records are unaffected)
  console.log('\n── Ensuring Status options are complete ──')
  const statusField = regTable.fields.find(f => f.name === 'Status')
  if (statusField) {
    const needed = ['Active', 'Sold', 'Deceased', 'Sick', 'Unassigned']
    const existing = new Set((statusField.options?.choices || []).map(c => c.name))
    const missing = needed.filter(n => !existing.has(n))
    if (missing.length > 0) {
      const choices = [
        ...(statusField.options?.choices || []),
        ...missing.map(n => ({
          name: n,
          color: n === 'Active' ? 'greenBright' : n === 'Sold' ? 'blueBright' : n === 'Deceased' ? 'grayBright' : n === 'Sick' ? 'redBright' : 'yellowBright',
        })),
      ]
      await sleep(250)
      await meta.patch(`/tables/${REGISTRY_TABLE_ID}/fields/${statusField.id}`, {
        options: { choices },
      }).catch(e => console.error('  Status update error:', e.response?.data))
      console.log(`  ✓ Added Status options: ${missing.join(', ')}`)
    } else {
      console.log('  ↷ Status options already complete')
    }
  }

  // ── 4. Create Weight Logs table ──
  console.log('\n── Creating Weight Logs table ──')
  const existing = tablesData.tables.find(t => t.name === 'Weight Logs')
  if (existing) {
    console.log('  ↷ Weight Logs table already exists (id:', existing.id + ')')
  } else {
    await sleep(250)
    try {
      const { data: newTable } = await meta.post('/tables', {
        name: 'Weight Logs',
        fields: [
          {
            name: 'Animal',
            type: 'multipleRecordLinks',
            options: { linkedTableId: REGISTRY_TABLE_ID },
          },
          {
            name: 'Weigh Date',
            type: 'date',
            options: { dateFormat: { name: 'iso' } },
          },
          { name: 'Weight kg', type: 'number', options: { precision: 1 } },
          { name: 'Notes',     type: 'multilineText' },
        ],
      })
      console.log('  ✓ Created Weight Logs table (id:', newTable.id + ')')
    } catch (e) {
      console.error('  ✗ Create Weight Logs error:', e.response?.data || e.message)
    }
  }

  console.log('\n✅ Schema setup complete.')
}

main().catch(e => {
  console.error('FATAL:', e.response?.data || e.message)
  process.exit(1)
})

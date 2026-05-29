import client from './airtable'

const TABLE = 'Animal%20Registry'

const FIELDS = [
  'Ear Tag', 'Left Tag', 'Right Tag', 'Breed', 'Breeding Class',
  'Foundation Breed', 'Breed Improver', 'Gender', 'Date of Birth',
  'Birth Year', 'Current Weight kg', 'Sire', 'Dam', 'Source',
  'Breeder', 'Comments', 'Status', 'Group', 'Date Added', 'Notes',
]

export async function getAllAnimals(filterStatus = null) {
  const params = { pageSize: 100, fields: FIELDS }
  if (filterStatus) params.filterByFormula = `{Status} = "${filterStatus}"`
  const res = await client.get(`/${TABLE}`, { params })
  return res.data.records
}

export async function getAnimalsByGroup(groupId) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `FIND("${groupId}", ARRAYJOIN({Group}))`,
      pageSize: 100,
      fields: FIELDS,
    },
  })
  return res.data.records
}

export async function getAnimalByEarTag(earTag) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `OR({Ear Tag} = "${earTag}", {Left Tag} = "${earTag}", {Right Tag} = "${earTag}")`,
      fields: FIELDS,
    },
  })
  return res.data.records[0] || null
}

// Returns up to 8 matches for autocomplete — searches both ear tags
export async function searchAnimals(query) {
  if (!query || query.length < 2) return []
  const q = query.toUpperCase()
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `OR(FIND("${q}", UPPER({Ear Tag})), FIND("${q}", UPPER({Left Tag})), FIND("${q}", UPPER({Right Tag})), FIND("${q}", UPPER({Breed})))`,
      pageSize: 8,
      fields: FIELDS,
    },
  })
  return res.data.records
}

export async function createAnimal(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function updateAnimal(id, fields) {
  const res = await client.patch(`/${TABLE}/${id}`, { fields })
  return res.data
}

// Called when a movement is logged — moves animal to new group and optionally updates status
export async function syncAnimalFromMovement(earTag, reason, toGroupId) {
  const animal = await getAnimalByEarTag(earTag)
  if (!animal) return null

  const fields = {}
  if (reason === 'Transfer' && toGroupId) fields['Group'] = [toGroupId]
  if (reason === 'Sale')   { fields['Status'] = 'Sold';     fields['Group'] = [] }
  if (reason === 'Death')  { fields['Status'] = 'Deceased'; fields['Group'] = [] }

  if (Object.keys(fields).length === 0) return animal
  return updateAnimal(animal.id, fields)
}

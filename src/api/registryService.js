import client from './airtable'

const TABLE = 'Animal Registry'

export async function getAllAnimals(filterStatus = null) {
  const params = { pageSize: 100 }
  if (filterStatus) {
    params.filterByFormula = `{Status} = "${filterStatus}"`
  }
  const res = await client.get(`/${TABLE}`, { params })
  return res.data.records
}

export async function getAnimalByEarTag(earTag) {
  const res = await client.get(`/${TABLE}`, {
    params: { filterByFormula: `{Ear Tag} = "${earTag}"` },
  })
  return res.data.records[0] || null
}

export async function createAnimal(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function updateAnimal(id, fields) {
  const res = await client.patch(`/${TABLE}/${id}`, { fields })
  return res.data
}

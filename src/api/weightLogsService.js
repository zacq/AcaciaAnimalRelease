import client from './airtable'

const TABLE = 'tbldmaYgGCL839SMX'  // Weight Logs

export async function getWeightHistory(animalId) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `FIND("${animalId}", ARRAYJOIN({Animal}))`,
      sort: [{ field: 'Weigh Date', direction: 'desc' }],
      pageSize: 50,
    },
  })
  return res.data.records
}

export async function addWeightLog(animalId, date, weightKg, notes = '') {
  const fields = {
    Animal:      [animalId],
    'Weigh Date': date,
    'Weight kg':  weightKg,
    Notes:        notes || undefined,
  }
  if (!fields.Notes) delete fields.Notes
  const res = await client.post(`/${TABLE}`, { fields })
  // Also update Current Weight kg on the animal record
  await client.patch(`/Animal%20Registry/${animalId}`, { fields: { 'Current Weight kg': weightKg } })
  return res.data
}

import client from './airtable'

const TABLE = 'Animal Movements'

export async function getMovementsForSession(sessionId) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `FIND("${sessionId}", ARRAYJOIN({Session})) > 0`,
      pageSize: 100,
    },
  })
  return res.data.records
}

export async function createMovement(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function updateMovement(id, fields) {
  const res = await client.patch(`/${TABLE}/${id}`, { fields })
  return res.data
}

export async function deleteMovement(id) {
  const res = await client.delete(`/${TABLE}/${id}`)
  return res.data
}

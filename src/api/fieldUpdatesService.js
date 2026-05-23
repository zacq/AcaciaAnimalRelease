import client from './airtable'

const TABLE = 'Field Updates'

export async function getUpdatesForSession(sessionId) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `FIND("${sessionId}", ARRAYJOIN({Session})) > 0`,
      sort: [{ field: 'Timestamp', direction: 'desc' }],
      pageSize: 100,
    },
  })
  return res.data.records
}

export async function createFieldUpdate(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function acknowledgeUpdate(id) {
  const res = await client.patch(`/${TABLE}/${id}`, {
    fields: { 'Acknowledged By Supervisor': true },
  })
  return res.data
}

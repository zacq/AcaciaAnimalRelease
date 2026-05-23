import client from './airtable'

const TABLE = 'Groups'

export async function getAllGroups() {
  const res = await client.get(`/${TABLE}`, { params: { pageSize: 100 } })
  return res.data.records
}

export async function updateGroupCount(id, newCount) {
  const res = await client.patch(`/${TABLE}/${id}`, {
    fields: { 'Current Total Count': newCount },
  })
  return res.data
}

export async function updateGroupHerdsman(id, herdsmanId) {
  const res = await client.patch(`/${TABLE}/${id}`, {
    fields: { 'Primary Herdsman': [herdsmanId] },
  })
  return res.data
}

import client from './airtable'

const TABLE = 'Staff'

export async function getAllStaff(filterByRole = null) {
  const params = { pageSize: 100 }
  if (filterByRole) {
    params.filterByFormula = `{Role} = "${filterByRole}"`
  }
  const res = await client.get(`/${TABLE}`, { params })
  return res.data.records
}

export async function getStaffByUsername(username) {
  const res = await client.get(`/${TABLE}`, {
    params: { filterByFormula: `{Username} = "${username}"` },
  })
  return res.data.records[0] || null
}

export async function createStaff(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function updateStaff(id, fields) {
  const res = await client.patch(`/${TABLE}/${id}`, { fields })
  return res.data
}

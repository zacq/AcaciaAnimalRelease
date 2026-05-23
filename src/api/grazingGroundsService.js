import client from './airtable'

const TABLE = 'Grazing Grounds'

export async function getGrazingGroundHistory() {
  const res = await client.get(`/${TABLE}`, {
    params: {
      sort: [{ field: 'Last Used', direction: 'desc' }],
      pageSize: 50,
    },
  })
  return res.data.records.map((r) => r.fields['Name'])
}

export async function upsertGrazingGround(name) {
  const existing = await client.get(`/${TABLE}`, {
    params: { filterByFormula: `{Name} = "${name}"` },
  })
  if (existing.data.records.length > 0) {
    const id = existing.data.records[0].id
    return client.patch(`/${TABLE}/${id}`, {
      fields: { 'Last Used': new Date().toISOString().split('T')[0] },
    })
  }
  return client.post(`/${TABLE}`, {
    fields: { Name: name, 'Last Used': new Date().toISOString().split('T')[0] },
  })
}

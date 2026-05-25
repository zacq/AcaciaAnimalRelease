import client from './airtable'
import { format } from 'date-fns'

const TABLE = 'Daily Sessions'

export async function getSessionsForDate(dateStr) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `IS_SAME({Date}, "${dateStr}", "day")`,
      pageSize: 100,
    },
  })
  return res.data.records
}

export async function getSessionById(id) {
  const res = await client.get(`/${TABLE}/${id}`)
  return res.data
}

export async function createSession(fields) {
  const res = await client.post(`/${TABLE}`, { fields })
  return res.data
}

export async function updateSession(id, fields) {
  const res = await client.patch(`/${TABLE}/${id}`, { fields })
  return res.data
}

export async function getSessionsForDateRange(startDate, endDate) {
  const start = format(startDate, 'yyyy-MM-dd')
  const end = format(endDate, 'yyyy-MM-dd')
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `AND({Date} >= "${start}", {Date} <= "${end}")`,
      pageSize: 100,
      sort: [{ field: 'Date', direction: 'desc' }],
    },
  })
  return res.data.records
}

export async function getSessionsForHerdsman(herdsmanId) {
  const res = await client.get(`/${TABLE}`, {
    params: {
      filterByFormula: `FIND("${herdsmanId}", ARRAYJOIN({Herdsman})) > 0`,
      pageSize: 10,
      sort: [{ field: 'Date', direction: 'desc' }],
    },
  })
  return res.data.records
}

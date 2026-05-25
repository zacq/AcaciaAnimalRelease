import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { getSessionsForDateRange } from '../api/sessionsService'
import { getAllGroups } from '../api/groupsService'
import AppShell from '../components/layout/AppShell'

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const STATUS_BADGE = {
  Complete: 'bg-green-100 text-green-700',
  Open: 'bg-blue-100 text-blue-700',
  Discrepancy: 'bg-red-100 text-red-700',
  Alert: 'bg-orange-100 text-orange-700',
}

export default function HistoryPage() {
  const [view, setView] = useState('history') // 'history' | 'weekly'
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [groups, setGroups] = useState([])

  // Weekly view state
  const [weekDate, setWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [weeklySessions, setWeeklySessions] = useState([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  useEffect(() => {
    getAllGroups().then(setGroups).catch(console.error)
  }, [])

  function resolveGroupName(sess) {
    const g = groups.find((gr) => gr.id === sess.fields['Group']?.[0])
    return g?.fields['Group Name'] || '—'
  }

  async function handleSearch() {
    setLoading(true)
    try {
      const results = await getSessionsForDateRange(new Date(`${fromDate}T00:00:00`), new Date(`${toDate}T00:00:00`))
      setSessions(results)
      setSearched(true)
    } catch (err) {
      alert('Search failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleWeeklyLoad() {
    setWeeklyLoading(true)
    const anchor = new Date(weekDate)
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    const end = endOfWeek(anchor, { weekStartsOn: 1 })
    try {
      const results = await getSessionsForDateRange(start, end)
      setWeeklySessions(results)
    } catch (err) {
      alert('Failed to load week: ' + err.message)
    } finally {
      setWeeklyLoading(false)
    }
  }

  // Group weekly sessions by date
  const weekDays = weeklySessions.length
    ? eachDayOfInterval({
        start: startOfWeek(new Date(weekDate), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(weekDate), { weekStartsOn: 1 }),
      })
    : []

  function sessionsForDay(day) {
    const dayStr = format(day, 'yyyy-MM-dd')
    return weeklySessions.filter((s) => s.fields['Date'] === dayStr)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-green-primary">Records</h1>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('history')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'history' ? 'bg-green-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              History
            </button>
            <button
              onClick={() => setView('weekly')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'weekly' ? 'bg-green-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Weekly Summary
            </button>
          </div>
        </div>

        {/* History View */}
        {view === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid" />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-5 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep disabled:opacity-60 transition-colors"
                >
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>

            {searched && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {sessions.length === 0 ? (
                  <p className="px-6 py-8 text-center text-gray-500">No records found for this date range.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                          <th className="px-3 py-3">Date</th>
                          <th className="px-3 py-3">Group</th>
                          <th className="px-3 py-3 text-center">AM</th>
                          <th className="px-3 py-3 text-center">PM</th>
                          <th className="px-3 py-3 text-center">Variance</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => {
                          const variance = s.fields['PM Count'] != null && s.fields['AM Count'] != null
                            ? s.fields['PM Count'] - s.fields['AM Count'] : null
                          return (
                            <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-3 font-medium">{s.fields['Date']}</td>
                              <td className="px-3 py-3">{resolveGroupName(s)}</td>
                              <td className="px-3 py-3 text-center">{s.fields['AM Count'] ?? '—'}</td>
                              <td className="px-3 py-3 text-center">{s.fields['PM Count'] ?? '—'}</td>
                              <td className="px-3 py-3 text-center">
                                {variance != null ? (
                                  <span className={variance < 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                                    {variance > 0 ? '+' : ''}{variance}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.fields['Status']] || 'bg-gray-100 text-gray-600'}`}>
                                  {s.fields['Status'] || 'Open'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Weekly Summary View */}
        {view === 'weekly' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Any date in the week</label>
                  <input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid" />
                </div>
                <button
                  onClick={handleWeeklyLoad}
                  disabled={weeklyLoading}
                  className="px-5 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep disabled:opacity-60 transition-colors"
                >
                  {weeklyLoading ? 'Loading…' : 'Load Week'}
                </button>
              </div>
            </div>

            {weekDays.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                        <th className="px-3 py-3 sticky left-0 bg-gray-50">Group</th>
                        {weekDays.map((d) => (
                          <th key={d.toISOString()} className="px-3 py-3 text-center whitespace-nowrap">
                            {format(d, 'EEE d')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GROUP_ORDER.map((grpName) => (
                        <tr key={grpName} className="border-t border-gray-50">
                          <td className="px-3 py-3 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white">{grpName}</td>
                          {weekDays.map((d) => {
                            const daySessions = sessionsForDay(d)
                            const sess = daySessions.find((s) => resolveGroupName(s) === grpName)
                            const variance = sess && sess.fields['PM Count'] != null && sess.fields['AM Count'] != null
                              ? sess.fields['PM Count'] - sess.fields['AM Count'] : null
                            return (
                              <td key={d.toISOString()} className="px-3 py-3 text-center">
                                {sess ? (
                                  <div className="text-xs space-y-0.5">
                                    <div className="text-gray-700">AM: {sess.fields['AM Count'] ?? '—'}</div>
                                    <div className="text-gray-700">PM: {sess.fields['PM Count'] ?? '—'}</div>
                                    {variance != null && (
                                      <div className={variance < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                                        {variance > 0 ? '+' : ''}{variance}
                                      </div>
                                    )}
                                  </div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

import { useEffect } from 'react'
import { format } from 'date-fns'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { updateSession } from '../../api/sessionsService'
import AppShell from '../../components/layout/AppShell'
import { requestNotificationPermission } from '../../utils/notifications'

const REVIEW_OPTIONS = ['Approved', 'Query', 'Discrepancy Noted']

const VARIANCE_COLOUR = (v) => {
  if (v == null) return 'border-gray-200 bg-white'
  if (v < 0) return 'border-red-300 bg-red-50'
  if (v === 0) return 'border-green-300 bg-green-50'
  return 'border-amber bg-amber-pale'
}

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

export default function ManagerDashboard() {
  const { sessions, groups, loading } = useSessionStore()
  useTodaySessions()

  useEffect(() => { requestNotificationPermission() }, [])

  async function handleReview(sessionId, value) {
    await updateSession(sessionId, { 'Farm Manager Reviewed': value })
  }

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return { name, session: sessions.find((s) => s.fields['Group']?.[0] === group?.id) }
  }).filter(({ session }) => session)

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading…</div></AppShell>

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-green-primary">Farm Overview</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')} · Read-only view</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSessions.map(({ name, session: sess }) => {
            const amCount = sess.fields['AM Count'] ?? 0
            const pmCount = sess.fields['PM Count']
            const variance = pmCount != null ? pmCount - amCount : null

            return (
              <div key={sess.id} className={`rounded-2xl border-2 p-5 ${VARIANCE_COLOUR(variance)}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{sess.fields['Grazing Ground'] || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    sess.fields['Status'] === 'Complete' ? 'bg-green-100 text-green-700' :
                    sess.fields['Status'] === 'Discrepancy' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{sess.fields['Status'] || 'Open'}</span>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">AM</p>
                    <p className="font-bold text-xl">{amCount}</p>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">PM</p>
                    <p className={`font-bold text-xl ${pmCount == null ? 'text-gray-300' : ''}`}>{pmCount ?? '—'}</p>
                  </div>
                  {variance != null && (
                    <div className="flex-1 bg-white rounded-lg p-2 text-center border border-gray-100">
                      <p className="text-xs text-gray-500">VAR</p>
                      <p className={`font-bold text-xl ${variance < 0 ? 'text-red-600' : variance === 0 ? 'text-green-600' : 'text-amber'}`}>
                        {variance > 0 ? '+' : ''}{variance}
                      </p>
                    </div>
                  )}
                </div>

                {/* Farm Manager Review */}
                {(sess.fields['Status'] === 'Complete' || sess.fields['Status'] === 'Discrepancy') && (
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 mb-1 block">Your Review</label>
                    <select
                      defaultValue={sess.fields['Farm Manager Reviewed'] || ''}
                      onChange={(e) => handleReview(sess.id, e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                    >
                      <option value="">— Pending —</option>
                      {REVIEW_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}

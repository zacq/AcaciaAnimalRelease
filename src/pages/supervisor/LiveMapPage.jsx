import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { useSessionStore } from '../../store/sessionStore'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { getUpdatesForSession, acknowledgeUpdate } from '../../api/fieldUpdatesService'
import { useAlertStore } from '../../store/alertStore'
import AppShell from '../../components/layout/AppShell'

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const POLL_INTERVAL = 2 * 60 * 1000 // 2 minutes

function getVarianceColour(variance) {
  if (variance == null) return 'border-gray-200 bg-white'
  if (variance < 0) return 'border-red-400 bg-red-50'
  if (variance === 0) return 'border-green-400 bg-green-50'
  return 'border-amber bg-amber-pale'
}

export default function LiveMapPage() {
  const { sessions, groups, fieldUpdates, setFieldUpdatesForSession, loading } = useSessionStore()
  const { reload } = useTodaySessions()
  const addAlert = useAlertStore((s) => s.addAlert)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refresh = useCallback(async () => {
    await reload()
    // Reload field updates for all sessions
    for (const sess of sessions) {
      try {
        const updates = await getUpdatesForSession(sess.id)
        setFieldUpdatesForSession(sess.id, updates)

        // Fire alerts for urgent updates
        updates.filter((u) => u.fields['Alert Level'] === 'Urgent' && !u.fields['Acknowledged By Supervisor'])
          .forEach((u) => {
            const groupName = groups.find((g) => g.id === sess.fields['Group']?.[0])?.fields['Group Name'] || ''
            addAlert(`Urgent field report — ${groupName}: ${u.fields['Issues Reported'] || 'No details'}`, 'orange')
          })
      } catch (_) {}
    }
    setLastRefresh(new Date())
  }, [sessions, groups])

  // Auto-poll
  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return sessions.find((s) => s.fields['Group']?.[0] === group?.id)
  }).filter(Boolean)

  async function handleAcknowledge(updateId) {
    await acknowledgeUpdate(updateId)
    await refresh()
  }

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading…</div></AppShell>

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-green-primary">Live Farm Map</h1>
            <p className="text-gray-400 text-xs mt-0.5">Last updated: {format(lastRefresh, 'HH:mm:ss')} · Auto-refreshes every 2 min</p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 border border-green-primary text-green-primary rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
          >
            Refresh Now
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSessions.map((sess) => {
            const groupRecord = groups.find((g) => g.id === sess.fields['Group']?.[0])
            const groupName = groupRecord?.fields['Group Name'] || 'Unknown Group'
            const amCount = sess.fields['AM Count'] ?? 0
            const pmCount = sess.fields['PM Count']
            const variance = pmCount != null ? pmCount - amCount : null
            const updates = fieldUpdates[sess.id] || []
            const latestUpdate = updates[0]
            const urgentUpdates = updates.filter((u) => u.fields['Alert Level'] === 'Urgent' && !u.fields['Acknowledged By Supervisor'])
            const vetFlag = false // would come from movements — simplified here

            return (
              <div
                key={sess.id}
                className={`rounded-2xl border-2 p-5 transition-colors ${getVarianceColour(variance)}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{groupName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{sess.fields['Grazing Ground'] || 'Ground not set'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {variance != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        variance < 0 ? 'bg-red-600 text-white' :
                        variance === 0 ? 'bg-green-600 text-white' :
                        'bg-amber text-green-primary'
                      }`}>
                        {variance > 0 ? '+' : ''}{variance}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sess.fields['Status'] === 'Complete' ? 'bg-green-100 text-green-700' :
                      sess.fields['Status'] === 'Discrepancy' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {sess.fields['Status'] || 'Open'}
                    </span>
                  </div>
                </div>

                {/* Counts */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">AM</p>
                    <p className="font-bold text-lg text-gray-900">{amCount}</p>
                  </div>
                  {latestUpdate && (
                    <div className="flex-1 bg-white rounded-lg p-2 text-center border border-amber">
                      <p className="text-xs text-amber">Field</p>
                      <p className="font-bold text-lg text-gray-900">{latestUpdate.fields['Current Count in Field']}</p>
                    </div>
                  )}
                  <div className="flex-1 bg-white rounded-lg p-2 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">PM</p>
                    <p className={`font-bold text-lg ${pmCount == null ? 'text-gray-300' : 'text-gray-900'}`}>{pmCount ?? '—'}</p>
                  </div>
                </div>

                {/* Alert indicators */}
                {urgentUpdates.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {urgentUpdates.map((u) => (
                      <div key={u.id} className="flex items-start justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs">
                        <p className="text-orange-700 font-medium">Urgent: {u.fields['Issues Reported'] || 'Field report'}</p>
                        <button onClick={() => handleAcknowledge(u.id)} className="text-orange-500 hover:text-orange-700 ml-2 flex-shrink-0 font-semibold">ACK</button>
                      </div>
                    ))}
                  </div>
                )}
                {variance != null && variance < 0 && (
                  <div className="bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700 font-medium mb-2">
                    Missing animals: {Math.abs(variance)} unaccounted
                  </div>
                )}
                {vetFlag && (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2 text-xs text-yellow-700 font-medium mb-2">
                    Vet Referral Flag raised
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

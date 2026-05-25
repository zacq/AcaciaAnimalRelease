import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { useSessionStore } from '../../store/sessionStore'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { getUpdatesForSession, acknowledgeUpdate } from '../../api/fieldUpdatesService'
import { getAllStaff } from '../../api/staffService'
import { useAlertStore } from '../../store/alertStore'
import AppShell from '../../components/layout/AppShell'

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const POLL_INTERVAL = 2 * 60 * 1000

function varianceColour(v) {
  if (v == null) return 'border-gray-200 bg-white'
  if (v < 0) return 'border-red-400 bg-red-50'
  if (v === 0) return 'border-green-400 bg-green-50'
  return 'border-amber bg-amber-pale'
}


export default function LiveMapPage() {
  const { sessions, groups, fieldUpdates, setFieldUpdatesForSession, loading } = useSessionStore()
  const { reload } = useTodaySessions()
  const addAlert = useAlertStore((s) => s.addAlert)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [staff, setStaff] = useState([])

  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  const refresh = useCallback(async () => {
    await reload()
    for (const sess of sessions) {
      try {
        const updates = await getUpdatesForSession(sess.id)
        setFieldUpdatesForSession(sess.id, updates)
        updates
          .filter((u) => u.fields['Alert Level'] === 'Urgent' && !u.fields['Acknowledged By Supervisor'])
          .forEach((u) => {
            const gName = groups.find((g) => g.id === sess.fields['Group']?.[0])?.fields['Group Name'] || ''
            addAlert(`Urgent field report — ${gName}: ${u.fields['Issues Reported'] || 'No details'}`, 'orange')
          })
      } catch (_) {}
    }
    setLastRefresh(new Date())
  }, [sessions, groups])

  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
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

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-green-primary">Live Farm Map</h1>
            <p className="text-gray-400 text-xs mt-0.5">
              Last updated: {format(lastRefresh, 'HH:mm:ss')} · Auto-refreshes every 2 min
            </p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 border border-green-primary text-green-primary rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
          >
            Refresh Now
          </button>
        </div>

        {/* Group cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSessions.map((sess) => {
            const groupName  = groups.find((g) => g.id === sess.fields['Group']?.[0])?.fields['Group Name'] || 'Unknown'
            const amCount    = sess.fields['AM Count'] ?? 0
            const pmCount    = sess.fields['PM Count']
            const variance   = pmCount != null ? pmCount - amCount : null
            const updates    = fieldUpdates[sess.id] || []
            const latest     = updates[0]
            const urgent     = updates.filter((u) => u.fields['Alert Level'] === 'Urgent' && !u.fields['Acknowledged By Supervisor'])
            const herdsmanId  = sess.fields['Herdsman']?.[0]
            const herdsman    = staff.find((s) => s.id === herdsmanId)
            const phone       = herdsman?.fields['Phone']
            const fmReview    = sess.fields['Farm Manager Reviewed']
            const fmNotes     = sess.fields['Notes']

            return (
              <div key={sess.id} className={`rounded-2xl border-2 overflow-hidden transition-colors ${varianceColour(variance)}`}>

                {/* Card body */}
                <div className="p-4">
                  {/* Group name + badges */}
                  <div className="flex items-start justify-between mb-1 gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">{groupName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{sess.fields['Grazing Ground'] || 'Ground not set'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
                        sess.fields['Status'] === 'Complete'    ? 'bg-green-100 text-green-700' :
                        sess.fields['Status'] === 'Discrepancy' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {sess.fields['Status'] || 'Open'}
                      </span>
                    </div>
                  </div>

                  {/* AM/Field/PM counts */}
                  <div className="flex gap-1.5 my-2.5">
                    <div className="flex-1 bg-white rounded-lg p-1.5 text-center border border-gray-100">
                      <p className="text-xs text-gray-500">AM</p>
                      <p className="font-bold text-base sm:text-lg text-gray-900">{amCount}</p>
                    </div>
                    {latest && (
                      <div className="flex-1 bg-white rounded-lg p-1.5 text-center border border-amber">
                        <p className="text-xs text-amber">Field</p>
                        <p className="font-bold text-base sm:text-lg text-gray-900">{latest.fields['Current Count in Field']}</p>
                      </div>
                    )}
                    <div className="flex-1 bg-white rounded-lg p-1.5 text-center border border-gray-100">
                      <p className="text-xs text-gray-500">PM</p>
                      <p className={`font-bold text-base sm:text-lg ${pmCount == null ? 'text-gray-300' : 'text-gray-900'}`}>{pmCount ?? '—'}</p>
                    </div>
                  </div>

                  {/* Alerts */}
                  {urgent.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {urgent.map((u) => (
                        <div key={u.id} className="flex items-start justify-between bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <p className="text-orange-700 font-medium truncate pr-2">Urgent: {u.fields['Issues Reported'] || 'Field report'}</p>
                          <button onClick={() => handleAcknowledge(u.id)} className="text-orange-500 hover:text-orange-700 flex-shrink-0 font-semibold">ACK</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {variance != null && variance < 0 && (
                    <div className="bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700 font-medium mb-2">
                      Missing animals: {Math.abs(variance)} unaccounted
                    </div>
                  )}

                  {/* Farm Manager review */}
                  {(fmReview || fmNotes) && (
                    <div className="border border-gray-200 rounded-lg px-3 py-2 text-xs space-y-1 mb-2">
                      {fmReview && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">FM Review:</span>
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${
                            fmReview === 'Approved'           ? 'bg-green-100 text-green-700' :
                            fmReview === 'Discrepancy Noted'  ? 'bg-red-100 text-red-700' :
                            'bg-amber-pale text-amber'
                          }`}>{fmReview}</span>
                        </div>
                      )}
                      {fmNotes && (
                        <p className="text-gray-500 italic truncate">{fmNotes}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Herdsman contact strip */}
                <div className={`border-t px-3 py-2.5 ${herdsman ? 'bg-green-primary' : 'bg-gray-50 border-gray-100'}`}>
                  {herdsman ? (
                    <div className="flex items-center gap-2">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
                          <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7 9a7 7 0 1 1 14 0H3z"/>
                        </svg>
                      </div>

                      {/* Name + number */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-xs leading-tight truncate">{herdsman.fields['Name']}</p>
                        {phone
                          ? <p className="text-green-light text-xs truncate">{phone}</p>
                          : <p className="text-green-light/60 text-xs italic">No phone on record</p>
                        }
                      </div>

                      {/* Call button */}
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          title={`Call ${herdsman.fields['Name']}`}
                          className="flex items-center gap-1 px-2.5 h-7 rounded-full bg-white text-green-primary text-xs font-bold hover:bg-green-light transition-colors flex-shrink-0"
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
                          </svg>
                          Call
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No herdsman assigned</p>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}

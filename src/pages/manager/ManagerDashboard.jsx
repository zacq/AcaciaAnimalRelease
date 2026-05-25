import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { updateSession } from '../../api/sessionsService'
import { getAllStaff } from '../../api/staffService'
import AppShell from '../../components/layout/AppShell'
import { requestNotificationPermission } from '../../utils/notifications'

const REVIEW_OPTIONS = ['Approved', 'Query', 'Discrepancy Noted']

const VARIANCE_COLOUR = (v) => {
  if (v == null) return 'border-gray-200 bg-white'
  if (v < 0) return 'border-red-300 bg-red-50'
  if (v === 0) return 'border-green-300 bg-green-50'
  return 'border-amber bg-amber-pale'
}

const REASON_BADGE = {
  Death:       'bg-red-100 text-red-700',
  Sale:        'bg-orange-100 text-orange-700',
  Birth:       'bg-green-100 text-green-700',
  Transfer:    'bg-blue-100 text-blue-700',
  'Vet Referral': 'bg-purple-100 text-purple-700',
  Other:       'bg-gray-100 text-gray-600',
}

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

export default function ManagerDashboard() {
  const { sessions, groups, movements, fieldUpdates, loading } = useSessionStore()
  useTodaySessions()

  const [staff, setStaff] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [commentDraft, setCommentDraft] = useState({})
  const [savingComment, setSavingComment] = useState(null)

  useEffect(() => { requestNotificationPermission() }, [])
  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  function resolveStaff(id) {
    return staff.find((s) => s.id === id)
  }

  async function handleReview(sessionId, value) {
    await updateSession(sessionId, { 'Farm Manager Reviewed': value })
  }

  async function handleSaveComment(sessionId) {
    const note = commentDraft[sessionId] ?? ''
    setSavingComment(sessionId)
    try {
      await updateSession(sessionId, { Notes: note })
    } finally {
      setSavingComment(null)
    }
  }

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return { name, session: sessions.find((s) => s.fields['Group']?.[0] === group?.id) }
  }).filter(({ session }) => session)

  const totalAM = sortedSessions.reduce((s, { session }) => s + (session?.fields['AM Count'] || 0), 0)
  const totalPM = sortedSessions.every(({ session }) => session?.fields['PM Count'] != null)
    ? sortedSessions.reduce((s, { session }) => s + (session?.fields['PM Count'] || 0), 0)
    : null

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading…</div></AppShell>

  return (
    <AppShell>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-green-primary">Farm Overview</h1>
            <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')} · Read-only view</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-green-primary text-white rounded-xl px-4 py-3 text-center min-w-[90px]">
              <p className="text-xs text-green-light">Total AM</p>
              <p className="text-3xl font-bold">{totalAM}</p>
            </div>
            {totalPM != null && (
              <div className={`rounded-xl px-4 py-3 text-center min-w-[90px] border-2 ${totalPM < totalAM ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                <p className="text-xs text-gray-500">Total PM</p>
                <p className={`text-3xl font-bold ${totalPM < totalAM ? 'text-red-600' : 'text-green-primary'}`}>{totalPM}</p>
              </div>
            )}
          </div>
        </div>

        {/* Group cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSessions.map(({ name, session: sess }) => {
            const amCount  = sess.fields['AM Count'] ?? 0
            const pmCount  = sess.fields['PM Count']
            const variance = pmCount != null ? pmCount - amCount : null
            const sessMovements = movements[sess.id] || []
            const sessUpdates   = fieldUpdates[sess.id] || []
            const herdsmanId = sess.fields['Herdsman']?.[0]
            const herdsman   = resolveStaff(herdsmanId)
            const isExpanded = expandedId === sess.id
            const existingNote = commentDraft[sess.id] ?? sess.fields['Notes'] ?? ''

            return (
              <div key={sess.id} className={`rounded-2xl border-2 ${VARIANCE_COLOUR(variance)} overflow-hidden`}>

                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-gray-900">{name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      sess.fields['Status'] === 'Complete' ? 'bg-green-100 text-green-700' :
                      sess.fields['Status'] === 'Discrepancy' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{sess.fields['Status'] || 'Open'}</span>
                  </div>

                  {/* Grazing ground + departure time */}
                  <p className="text-xs text-gray-500 mb-1">
                    {sess.fields['Grazing Ground'] || '—'}
                    {sess.fields['AM Departure Time'] ? ` · out ${sess.fields['AM Departure Time']}` : ''}
                    {sess.fields['PM Return Time']    ? ` · in ${sess.fields['PM Return Time']}`    : ''}
                  </p>

                  {/* Herdsman */}
                  {herdsman && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0H3z"/>
                        </svg>
                      </span>
                      <span className="text-xs text-gray-700">{herdsman.fields['Name']}</span>
                      {herdsman.fields['Phone'] && (
                        <a
                          href={`tel:${herdsman.fields['Phone']}`}
                          className="ml-auto text-xs text-green-primary font-medium flex items-center gap-1 hover:underline"
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
                          </svg>
                          {herdsman.fields['Phone']}
                        </a>
                      )}
                    </div>
                  )}

                  {/* AM / PM / Variance */}
                  <div className="flex gap-2 mb-3">
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

                  {/* Footer row: movement count + expand toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {sessMovements.length > 0
                        ? `${sessMovements.length} movement${sessMovements.length > 1 ? 's' : ''}`
                        : 'No movements'}
                    </span>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : sess.id)}
                      className="text-xs text-green-primary font-medium flex items-center gap-1 hover:underline"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                      <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">

                    {/* Herdsman field updates */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Herdsman Field Updates</p>
                      {sessUpdates.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No field updates submitted today.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {sessUpdates.map((u) => (
                            <div key={u.id} className="flex items-start gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-800">Count: {u.fields['Current Count in Field']}</span>
                                  {amCount > 0 && u.fields['Current Count in Field'] != null && (
                                    <span className={`font-medium ${
                                      u.fields['Current Count in Field'] < amCount ? 'text-red-500' :
                                      u.fields['Current Count in Field'] === amCount ? 'text-green-600' : 'text-amber'
                                    }`}>
                                      ({u.fields['Current Count in Field'] > amCount ? '+' : ''}{u.fields['Current Count in Field'] - amCount} from AM)
                                    </span>
                                  )}
                                </div>
                                {u.fields['Issues Reported'] && (
                                  <p className="text-gray-500 mt-0.5 truncate">{u.fields['Issues Reported']}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                                  u.fields['Alert Level'] === 'Urgent'   ? 'bg-red-100 text-red-700' :
                                  u.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                                  'bg-green-100 text-green-700'
                                }`}>{u.fields['Alert Level']}</span>
                                {u.fields['Timestamp'] && (
                                  <span className="text-gray-400">{format(new Date(u.fields['Timestamp']), 'HH:mm')}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Supervisor session status */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Supervisor Status</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`px-2 py-1 rounded-full font-medium ${
                          sess.fields['Supervisor Signature'] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sess.fields['Supervisor Signature'] ? 'Supervisor signed' : 'Awaiting supervisor'}
                        </span>
                        <span className={`px-2 py-1 rounded-full font-medium ${
                          sess.fields['Herdsman Signature'] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sess.fields['Herdsman Signature'] ? 'Herdsman signed' : 'Awaiting herdsman'}
                        </span>
                        {sess.fields['Date/Time Signed'] && (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                            Signed {format(new Date(sess.fields['Date/Time Signed']), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      {sess.fields['Notes'] && (
                        <p className="mt-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span className="font-medium text-gray-500">Notes: </span>{sess.fields['Notes']}
                        </p>
                      )}
                    </div>

                    {/* Animal Movements */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Animal Movements</p>
                      {sessMovements.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No movements recorded today.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {sessMovements.map((m) => (
                            <div key={m.id} className="flex items-start gap-2 text-xs text-gray-700">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${REASON_BADGE[m.fields['Reason']] || 'bg-gray-100 text-gray-600'}`}>
                                {m.fields['Reason']}
                              </span>
                              <span className="font-mono">{m.fields['Ear Tag']}</span>
                              {m.fields['Health/Condition Notes'] && (
                                <span className="text-gray-400 italic truncate">— {m.fields['Health/Condition Notes']}</span>
                              )}
                              {m.fields['Time'] && <span className="ml-auto text-gray-400 flex-shrink-0">{m.fields['Time']}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Farm Manager Review */}
                    {(sess.fields['Status'] === 'Complete' || sess.fields['Status'] === 'Discrepancy') && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Your Review</p>
                        <select
                          defaultValue={sess.fields['Farm Manager Reviewed'] || ''}
                          onChange={(e) => handleReview(sess.id, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-mid bg-white"
                        >
                          <option value="">— Pending —</option>
                          {REVIEW_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Manager comment */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Manager Notes</p>
                      <textarea
                        rows={2}
                        value={existingNote}
                        onChange={(e) => setCommentDraft((d) => ({ ...d, [sess.id]: e.target.value }))}
                        placeholder="Add a note for this group…"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-mid bg-white"
                      />
                      <button
                        onClick={() => handleSaveComment(sess.id)}
                        disabled={savingComment === sess.id}
                        className="mt-1.5 px-3 py-1 bg-green-primary text-white text-xs font-medium rounded-lg hover:bg-green-deep disabled:opacity-60 transition-colors"
                      >
                        {savingComment === sess.id ? 'Saving…' : 'Save note'}
                      </button>
                    </div>
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

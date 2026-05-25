import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../../auth/AuthContext'
import { getAllGroups } from '../../api/groupsService'
import { getSessionsForDate } from '../../api/sessionsService'
import { createFieldUpdate, getUpdatesForSession } from '../../api/fieldUpdatesService'
import { getAllStaff } from '../../api/staffService'
import { queueUpdate, getQueue, clearQueue } from '../../utils/offlineCache'
import AppShell from '../../components/layout/AppShell'

const ALERT_LEVELS = ['None', 'Advisory', 'Urgent']

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

function pctChange(am, current) {
  if (am == null || current == null || am === 0) return null
  return ((current - am) / am) * 100
}

function PctBadge({ am, current }) {
  const pct = pctChange(am, current)
  if (pct === null) return <span className="text-gray-300 font-bold text-lg">—</span>
  const delta = current - am
  const colour = pct < 0 ? 'text-red-500' : pct === 0 ? 'text-green-600' : 'text-amber'
  return (
    <span className={`font-bold text-lg ${colour}`}>
      {delta > 0 ? '+' : ''}{delta} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  )
}

export default function FieldViewPage() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [tab, setTab]             = useState('mine')
  const [loading, setLoading]     = useState(true)
  const [online, setOnline]       = useState(navigator.onLine)

  // My herd
  const [mySession, setMySession] = useState(null)
  const [myGroup, setMyGroup]     = useState(null)
  const [myUpdates, setMyUpdates] = useState([])

  // Team today
  const [allSessions, setAllSessions] = useState([])
  const [allGroups, setAllGroups]     = useState([])
  const [allStaff, setAllStaff]       = useState([])
  const [teamUpdates, setTeamUpdates] = useState({}) // { [sessionId]: update[] }

  // Update form
  const [count, setCount]               = useState('')
  const [issues, setIssues]             = useState('')
  const [alertLevel, setAlertLevel]     = useState('None')
  const [submitting, setSubmitting]     = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError]   = useState('')

  useEffect(() => {
    const goOnline  = () => { setOnline(true); flushQueue() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [mySession])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [sessions, groups, staff] = await Promise.all([
          getSessionsForDate(today),
          getAllGroups(),
          getAllStaff(),
        ])

        setAllSessions(sessions)
        setAllGroups(groups)
        setAllStaff(staff)
        setLoading(false)

        const mine = sessions.find((s) => s.fields['Herdsman']?.includes(user.id))
        if (mine) {
          setMySession(mine)
          setMyGroup(groups.find((g) => g.id === mine.fields['Group']?.[0]) || null)
          const updates = await getUpdatesForSession(mine.id)
          setMyUpdates(updates)
        }

        // Load latest update for each session for team view
        const updatesMap = {}
        await Promise.all(
          sessions.map(async (s) => {
            try {
              const u = await getUpdatesForSession(s.id)
              updatesMap[s.id] = u
            } catch (_) {}
          })
        )
        setTeamUpdates(updatesMap)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }
    load()
  }, [user.id, today])

  async function flushQueue() {
    if (!mySession) return
    const queue = getQueue()
    if (!queue.length) return
    try {
      for (const entry of queue) await createFieldUpdate(entry.fields)
      clearQueue()
      const fresh = await getUpdatesForSession(mySession.id)
      setMyUpdates(fresh)
    } catch (_) {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    if (!count) { setSubmitError('Current count is required'); return }

    const fields = {
      Session:                    [mySession.id],
      'Submitted By':             [user.id],
      Timestamp:                  new Date().toISOString(),
      'Current Count in Field':   Number(count),
      'Issues Reported':          issues,
      'Alert Level':              alertLevel,
      'Acknowledged By Supervisor': false,
    }

    setSubmitting(true)
    try {
      if (!online) {
        queueUpdate({ fields })
        setMyUpdates((prev) => [...prev, { id: `queued-${Date.now()}`, fields, queued: true }])
      } else {
        const created = await createFieldUpdate(fields)
        setMyUpdates((prev) => [created, ...prev])
      }
      setSubmitSuccess(true)
      setCount('')
      setIssues('')
      setAlertLevel('None')
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (err) {
      setSubmitError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading…</div></AppShell>

  const amCount   = mySession?.fields['AM Count'] ?? null
  const latestUpdate = myUpdates[0]
  const latestCount  = latestUpdate?.fields['Current Count in Field'] ?? null
  const countPreview = count !== '' ? Number(count) : null

  return (
    <AppShell>
      <div className="space-y-4 max-w-lg mx-auto">

        {/* Offline banner */}
        {!online && (
          <div className="bg-amber-pale border border-amber rounded-xl px-4 py-3 text-sm text-amber font-medium">
            You are offline. Updates will sync when connection resumes.
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {[['mine', 'My Herd'], ['team', 'Team Today']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === key
                  ? 'bg-white text-green-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── MY HERD TAB ── */}
        {tab === 'mine' && (
          <>
            {!mySession ? (
              <div className="flex items-center justify-center h-48 text-center">
                <div>
                  <p className="text-gray-500 font-medium">No session assigned for today.</p>
                  <p className="text-gray-400 text-sm mt-1">Contact your supervisor.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Hero card */}
                <div className="bg-green-primary text-white rounded-2xl p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-1 gap-2">
                    <div className="min-w-0">
                      <p className="text-green-light text-xs uppercase tracking-wide">My Group</p>
                      <h1 className="text-xl sm:text-2xl font-bold mt-0.5 truncate">{myGroup?.fields['Group Name'] || 'Group'}</h1>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 mt-1 ${
                      mySession.fields['Status'] === 'Complete'    ? 'bg-green-700 text-white' :
                      mySession.fields['Status'] === 'Discrepancy' ? 'bg-red-500 text-white' :
                      'bg-white/20 text-white'
                    }`}>
                      {mySession.fields['Status'] || 'Open'}
                    </span>
                  </div>

                  <p className="text-green-light text-xs sm:text-sm mt-1.5">
                    {format(new Date(), 'EEEE, d MMMM yyyy')}
                  </p>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-green-light text-xs mt-1">
                    {mySession.fields['Grazing Ground'] && (
                      <span>Ground: <span className="text-white font-medium">{mySession.fields['Grazing Ground']}</span></span>
                    )}
                    {mySession.fields['AM Departure Time'] && (
                      <span>Out: <span className="text-white font-medium">{mySession.fields['AM Departure Time']}</span></span>
                    )}
                    {mySession.fields['Weather'] && (
                      <span className="truncate">{mySession.fields['Weather']}</span>
                    )}
                  </div>

                  {/* Stat boxes */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="bg-green-deep rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-green-light text-xs mb-0.5">AM</p>
                      <p className="text-xl sm:text-2xl font-bold">{amCount ?? '—'}</p>
                    </div>
                    <div className="bg-green-deep rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-green-light text-xs mb-0.5">Field</p>
                      <p className="text-xl sm:text-2xl font-bold">{latestCount ?? '—'}</p>
                    </div>
                    <div className="bg-green-deep rounded-xl p-2 sm:p-3 text-center">
                      <p className="text-green-light text-xs mb-0.5">Change</p>
                      <PctBadge am={amCount} current={latestCount} />
                    </div>
                  </div>
                </div>

                {/* Update form */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <h2 className="text-base font-semibold text-green-primary">Submit Field Update</h2>

                  {submitError   && <p className="text-red-600 text-sm">{submitError}</p>}
                  {submitSuccess && <p className="text-green-600 text-sm font-medium">{online ? 'Update submitted' : 'Saved offline — will sync shortly'}</p>}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Current Count in Field *
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-green-mid"
                        placeholder="0"
                        required
                      />
                      {/* Live variance preview */}
                      {countPreview !== null && amCount != null && (
                        <p className={`text-center text-sm font-medium mt-1 ${
                          countPreview < amCount ? 'text-red-500' :
                          countPreview === amCount ? 'text-green-600' : 'text-amber'
                        }`}>
                          {countPreview === amCount
                            ? 'No change from AM count'
                            : `${countPreview > amCount ? '+' : ''}${countPreview - amCount} from AM (${pctChange(amCount, countPreview) > 0 ? '+' : ''}${pctChange(amCount, countPreview)?.toFixed(1)}%)`
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issues / Field Notes</label>
                      <textarea
                        value={issues}
                        onChange={(e) => setIssues(e.target.value)}
                        rows={3}
                        placeholder="Any issues to report…"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-mid resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Alert Level</label>
                      <div className="flex gap-3">
                        {ALERT_LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setAlertLevel(level)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                              alertLevel === level
                                ? level === 'None'     ? 'border-green-primary bg-green-primary text-white'
                                  : level === 'Advisory' ? 'border-amber bg-amber text-green-primary'
                                  : 'border-red-500 bg-red-500 text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-green-primary text-white font-semibold rounded-xl hover:bg-green-deep transition-colors disabled:opacity-60 text-base"
                    >
                      {submitting ? 'Submitting…' : 'Submit Update'}
                    </button>
                  </form>
                </div>

                {/* Updates timeline */}
                {myUpdates.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Today's Updates</h2>
                    <div className="space-y-3">
                      {myUpdates.map((u) => {
                        const uCount = u.fields['Current Count in Field']
                        const delta  = amCount != null && uCount != null ? uCount - amCount : null
                        return (
                          <div key={u.id} className="flex items-start justify-between text-sm border-t border-gray-50 pt-3 first:border-0 first:pt-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-800">Count: {uCount}</p>
                                {delta !== null && (
                                  <span className={`text-xs font-medium ${delta < 0 ? 'text-red-500' : delta === 0 ? 'text-green-600' : 'text-amber'}`}>
                                    ({delta > 0 ? '+' : ''}{delta} from AM)
                                  </span>
                                )}
                              </div>
                              {u.fields['Issues Reported'] && (
                                <p className="text-gray-500 text-xs mt-0.5 truncate">{u.fields['Issues Reported']}</p>
                              )}
                              {u.queued && <p className="text-amber text-xs mt-0.5">Pending sync…</p>}
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.fields['Alert Level'] === 'Urgent'   ? 'bg-red-100 text-red-700' :
                                u.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {u.fields['Alert Level']}
                              </span>
                              <p className="text-gray-400 text-xs mt-1">
                                {u.fields['Timestamp'] ? format(new Date(u.fields['Timestamp']), 'HH:mm') : '—'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── TEAM TODAY TAB ── */}
        {tab === 'team' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">
              {format(new Date(), 'EEEE, d MMMM yyyy')} · {allSessions.length} groups out
            </p>

            {GROUP_ORDER.map((name) => {
              const group   = allGroups.find((g) => g.fields['Group Name'] === name)
              const sess    = allSessions.find((s) => s.fields['Group']?.[0] === group?.id)
              if (!sess) return null

              const herdsmanId   = sess.fields['Herdsman']?.[0]
              const herdsman     = allStaff.find((s) => s.id === herdsmanId)
              const isMe         = herdsmanId === user.id
              const sessUpdates  = teamUpdates[sess.id] || []
              const latest       = sessUpdates[0]
              const hasAlert     = sessUpdates.some((u) =>
                u.fields['Alert Level'] === 'Urgent' || u.fields['Alert Level'] === 'Advisory'
              )
              const amCt         = sess.fields['AM Count'] ?? '—'
              const latestCt     = latest?.fields['Current Count in Field']
              const sessDelta    = (sess.fields['AM Count'] != null && latestCt != null)
                ? latestCt - sess.fields['AM Count'] : null

              return (
                <div
                  key={sess.id}
                  className={`bg-white rounded-2xl border overflow-hidden ${
                    isMe ? 'border-l-4 border-l-green-primary border-gray-100' : 'border-gray-100'
                  }`}
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          isMe ? 'bg-green-primary text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {herdsman ? herdsman.fields['Name'].charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold text-sm truncate ${isMe ? 'text-green-primary' : 'text-gray-800'}`}>
                            {herdsman ? herdsman.fields['Name'] : <span className="italic text-gray-400">Unassigned</span>}
                            {isMe && <span className="ml-1 text-xs font-normal text-green-mid">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{name}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {hasAlert && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Alert</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          sess.fields['Status'] === 'Complete'    ? 'bg-green-100 text-green-700' :
                          sess.fields['Status'] === 'Discrepancy' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {sess.fields['Status'] || 'Open'}
                        </span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-2.5 flex gap-1.5 text-xs">
                      <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-gray-400">AM</p>
                        <p className="font-bold text-gray-800 text-sm sm:text-base">{amCt}</p>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-gray-400">Field</p>
                        <p className={`font-bold text-sm sm:text-base ${latestCt == null ? 'text-gray-300' : 'text-gray-800'}`}>
                          {latestCt ?? '—'}
                        </p>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-gray-400">Δ</p>
                        <p className={`font-bold text-sm sm:text-base ${
                          sessDelta == null ? 'text-gray-300' :
                          sessDelta < 0 ? 'text-red-500' :
                          sessDelta === 0 ? 'text-green-600' : 'text-amber'
                        }`}>
                          {sessDelta == null ? '—' : sessDelta > 0 ? `+${sessDelta}` : sessDelta}
                        </p>
                      </div>
                    </div>

                    {/* Ground + last update */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400 gap-2">
                      <span className="truncate">{sess.fields['Grazing Ground'] || '—'}</span>
                      {latest
                        ? <span className="flex-shrink-0">Updated {format(new Date(latest.fields['Timestamp']), 'HH:mm')}</span>
                        : <span className="italic flex-shrink-0">No update yet</span>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </AppShell>
  )
}

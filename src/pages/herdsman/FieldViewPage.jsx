import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../../auth/AuthContext'
import { getAllGroups } from '../../api/groupsService'
import { getSessionsForHerdsman } from '../../api/sessionsService'
import { createFieldUpdate, getUpdatesForSession } from '../../api/fieldUpdatesService'
import { queueUpdate, getQueue, clearQueue } from '../../utils/offlineCache'
import AppShell from '../../components/layout/AppShell'

const ALERT_LEVELS = ['None', 'Advisory', 'Urgent']

export default function FieldViewPage() {
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [group, setGroup] = useState(null)
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)

  const [count, setCount] = useState('')
  const [issues, setIssues] = useState('')
  const [alertLevel, setAlertLevel] = useState('None')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Track online/offline
  useEffect(() => {
    const goOnline = () => { setOnline(true); flushQueue() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [session])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [sessions, groups] = await Promise.all([
          getSessionsForHerdsman(user.id),
          getAllGroups(),
        ])
        const today = format(new Date(), 'yyyy-MM-dd')
        const todaySession = sessions.find((s) => s.fields['Date'] === today)
        if (todaySession) {
          setSession(todaySession)
          const grp = groups.find((g) => g.id === todaySession.fields['Group']?.[0])
          setGroup(grp || null)
          const existingUpdates = await getUpdatesForSession(todaySession.id)
          setUpdates(existingUpdates)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user.id])

  async function flushQueue() {
    if (!session) return
    const queue = getQueue()
    if (!queue.length) return
    try {
      for (const entry of queue) {
        await createFieldUpdate(entry.fields)
      }
      clearQueue()
      const fresh = await getUpdatesForSession(session.id)
      setUpdates(fresh)
    } catch (_) {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    if (!count) { setSubmitError('Current count is required'); return }

    const fields = {
      Session: [session.id],
      'Submitted By': [user.id],
      Timestamp: new Date().toISOString(),
      'Current Count in Field': Number(count),
      'Issues Reported': issues,
      'Alert Level': alertLevel,
      'Acknowledged By Supervisor': false,
    }

    setSubmitting(true)
    try {
      if (!online) {
        queueUpdate({ fields })
        setUpdates((prev) => [...prev, { id: `queued-${Date.now()}`, fields, queued: true }])
        setSubmitSuccess(true)
      } else {
        const created = await createFieldUpdate(fields)
        setUpdates((prev) => [...prev, created])
        setSubmitSuccess(true)
      }
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

  if (!session) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500 font-medium">No session assigned for today.</p>
            <p className="text-gray-400 text-sm mt-1">Contact your supervisor.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-lg mx-auto">

        {/* Offline banner */}
        {!online && (
          <div className="bg-amber-pale border border-amber rounded-xl px-4 py-3 text-sm text-amber font-medium">
            You are offline. Updates will sync when connection resumes.
          </div>
        )}

        {/* Session card */}
        <div className="bg-green-primary text-white rounded-2xl p-6">
          <p className="text-green-light text-xs uppercase tracking-wide mb-1">My Group</p>
          <h1 className="text-2xl font-bold">{group?.fields['Group Name'] || 'Group'}</h1>
          <p className="text-green-light text-sm mt-2">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-green-deep rounded-xl p-3">
              <p className="text-green-light text-xs mb-1">AM Count</p>
              <p className="text-2xl font-bold">{session.fields['AM Count'] ?? '—'}</p>
            </div>
            <div className="bg-green-deep rounded-xl p-3">
              <p className="text-green-light text-xs mb-1">Departure</p>
              <p className="text-2xl font-bold">{session.fields['AM Departure Time'] || '—'}</p>
            </div>
          </div>
          <div className="mt-3 text-sm">
            <span className="text-green-light">Grazing Ground: </span>
            <span>{session.fields['Grazing Ground'] || 'Not set'}</span>
          </div>
        </div>

        {/* Mid-day update form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-green-primary mb-4">Submit Mid-Day Update</h2>

          {submitError && <p className="text-red-600 text-sm mb-3">{submitError}</p>}
          {submitSuccess && <p className="text-green-600 text-sm mb-3 font-medium">{online ? 'Update submitted' : 'Saved offline — will sync shortly'}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Count in Field *</label>
              <input
                type="number"
                min={0}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-green-mid"
                placeholder="0"
                required
              />
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
                        ? level === 'None' ? 'border-green-primary bg-green-primary text-white'
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

        {/* Past updates today */}
        {updates.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Today's Updates</h2>
            <div className="space-y-3">
              {updates.map((u) => (
                <div key={u.id} className="flex items-start justify-between text-sm border-t border-gray-50 pt-3 first:border-0 first:pt-0">
                  <div>
                    <p className="font-medium text-gray-800">Count: {u.fields['Current Count in Field']}</p>
                    {u.fields['Issues Reported'] && <p className="text-gray-500 mt-0.5">{u.fields['Issues Reported']}</p>}
                    {u.queued && <p className="text-amber text-xs mt-0.5">Pending sync…</p>}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.fields['Alert Level'] === 'Urgent' ? 'bg-red-100 text-red-700' :
                      u.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                      'bg-green-100 text-green-700'
                    }`}>{u.fields['Alert Level']}</span>
                    <p className="text-gray-400 text-xs mt-1">
                      {u.fields['Timestamp'] ? format(new Date(u.fields['Timestamp']), 'HH:mm') : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

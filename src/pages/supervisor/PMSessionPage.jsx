import { useState } from 'react'
import { format } from 'date-fns'
import { useSessionStore } from '../../store/sessionStore'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { updateSession } from '../../api/sessionsService'
import { computeFarmTotals, farmGrandTotal } from '../../utils/countIntegrity'
import { useAlertStore } from '../../store/alertStore'
import AppShell from '../../components/layout/AppShell'
import { useAuth } from '../../auth/AuthContext'

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

export default function PMSessionPage() {
  const { user } = useAuth()
  const { sessions, groups, movements, updateSessionLocally, loading } = useSessionStore()
  const { reload } = useTodaySessions()
  const addAlert = useAlertStore((s) => s.addAlert)

  const [pmTime, setPmTime] = useState('')
  const [supervisorSig, setSupervisorSig] = useState(false)
  const [herdsmanSig, setHerdsmanSig] = useState(false)
  const [witnessSig, setWitnessSig] = useState(false)
  const [discrepancyNote, setDiscrepancyNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return sessions.find((s) => s.fields['Group']?.[0] === group?.id)
  }).filter(Boolean)

  const tallyRows = computeFarmTotals(sortedSessions, movements, groups)
  const grand = farmGrandTotal(tallyRows)
  const hasDiscrepancy = tallyRows.some((r) => r.variance !== null && r.variance < 0)
  const allPMEntered = tallyRows.every((r) => r.pmCount != null)

  function handlePMChange(sessionId, val) {
    updateSessionLocally(sessionId, { 'PM Count': val === '' ? null : Number(val) })
  }

  async function handleSubmit() {
    setSaveError('')
    if (!pmTime) { setSaveError('PM Return Time is required'); return }
    if (!supervisorSig) { setSaveError('Supervisor signature required'); return }
    if (hasDiscrepancy && !discrepancyNote.trim()) {
      setSaveError('An explanatory note is required when there is a count discrepancy')
      return
    }

    setSaving(true)
    try {
      await Promise.all(
        sortedSessions.map((sess) =>
          updateSession(sess.id, {
            'PM Return Time': pmTime,
            'PM Count': sess.fields['PM Count'],
            Status: hasDiscrepancy ? 'Discrepancy' : 'Complete',
            'Supervisor Signature': supervisorSig,
            'Herdsman Signature': herdsmanSig,
            'Witness Signature': witnessSig,
            'Date/Time Signed': new Date().toISOString(),
            Notes: discrepancyNote || sess.fields['Notes'],
          })
        )
      )

      // Fire alerts
      tallyRows.forEach((row) => {
        if (row.pmCount != null && row.pmCount < row.amCount) {
          addAlert(`Missing animals in ${row.groupName}: AM=${row.amCount}, PM=${row.pmCount}`, 'red')
        }
      })
      if (grand.pmCount != null && grand.pmCount < grand.amCount) {
        addAlert(`Farm-wide shortage: total AM=${grand.amCount}, PM=${grand.pmCount}`, 'red')
      }

      setSaveSuccess(true)
      reload()
    } catch (err) {
      setSaveError(err.message || 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-gray-500">Loading…</div></AppShell>

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-green-primary">PM Evening Return</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>

        {saveError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{saveError}</div>}

        {/* PM Return Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">PM Return Time *</label>
          <input
            type="time"
            value={pmTime}
            onChange={(e) => setPmTime(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid w-48"
          />
        </div>

        {/* Section 5 — Farm Tally Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <h2 className="text-base font-semibold text-green-primary">Farm Tally Summary — PM</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                  <th className="px-3 py-3">Group</th>
                  <th className="px-3 py-3 text-center">AM</th>
                  <th className="px-3 py-3 text-center">Moved Out</th>
                  <th className="px-3 py-3 text-center">Moved In</th>
                  <th className="px-3 py-3 text-center w-28">PM Count</th>
                  <th className="px-3 py-3 text-center">Variance</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {tallyRows.map((row, i) => (
                  <tr key={row.sessionId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-800">{row.groupName}</td>
                    <td className="px-3 py-3 text-center">{row.amCount}</td>
                    <td className="px-3 py-3 text-center text-red-600">{row.movedOut > 0 ? `-${row.movedOut}` : '—'}</td>
                    <td className="px-3 py-3 text-center text-green-600">{row.movedIn > 0 ? `+${row.movedIn}` : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={sortedSessions[i]?.fields['PM Count'] ?? ''}
                        onChange={(e) => handlePMChange(sortedSessions[i]?.id, e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">
                      {row.variance != null ? (
                        <span className={row.variance < 0 ? 'text-red-600' : row.variance === 0 ? 'text-green-600' : 'text-amber'}>
                          {row.variance > 0 ? '+' : ''}{row.variance}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.variance == null ? '—' : row.variance < 0
                        ? <span className="text-red-600 font-bold">Discrepancy</span>
                        : <span className="text-green-600 font-medium">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-50 border-t-2 border-green-200 font-semibold text-green-primary">
                  <td className="px-3 py-3">Grand Total</td>
                  <td className="px-3 py-3 text-center">{grand.amCount}</td>
                  <td className="px-3 py-3 text-center text-red-600">{grand.movedOut > 0 ? `-${grand.movedOut}` : '—'}</td>
                  <td className="px-3 py-3 text-center text-green-600">{grand.movedIn > 0 ? `+${grand.movedIn}` : '—'}</td>
                  <td className="px-3 py-3 text-center">{grand.pmCount ?? '—'}</td>
                  <td className="px-3 py-3 text-center">
                    {grand.pmCount != null ? (
                      <span className={grand.pmCount < grand.amCount ? 'text-red-600' : 'text-green-600'}>
                        {grand.pmCount - grand.amCount > 0 ? '+' : ''}{grand.pmCount - grand.amCount}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {grand.pmCount != null
                      ? grand.pmCount < grand.amCount
                        ? <span className="text-red-600 font-bold">Discrepancy</span>
                        : <span className="text-green-600">OK</span>
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Discrepancy note */}
        {hasDiscrepancy && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Discrepancy Explanation Required *</h3>
            <textarea
              value={discrepancyNote}
              onChange={(e) => setDiscrepancyNote(e.target.value)}
              rows={3}
              placeholder="Explain the count discrepancy…"
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        )}

        {/* Declaration */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-green-primary mb-4">Declaration & Verification</h2>
          <p className="text-xs text-gray-500 mb-4">
            By signing below, the undersigned confirm the accuracy of this daily animal register for{' '}
            {format(new Date(), 'd MMMM yyyy')}.
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={supervisorSig} onChange={(e) => setSupervisorSig(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-primary" />
              <div>
                <p className="text-sm font-medium text-gray-800">{user.name} (Supervisor)</p>
                <p className="text-xs text-gray-500">I confirm the above records are accurate and complete.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={herdsmanSig} onChange={(e) => setHerdsmanSig(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-primary" />
              <div>
                <p className="text-sm font-medium text-gray-800">Herdsman Acknowledgement</p>
                <p className="text-xs text-gray-500">Herdsman confirms animal counts at return.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={witnessSig} onChange={(e) => setWitnessSig(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-primary" />
              <div>
                <p className="text-sm font-medium text-gray-800">Witness Acknowledgement</p>
                <p className="text-xs text-gray-500">Independent witness confirms the above.</p>
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-4">Date/Time Signed: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving || saveSuccess}
            className="px-6 py-3 bg-green-primary text-white font-semibold rounded-xl hover:bg-green-deep transition-colors disabled:opacity-60"
          >
            {saving ? 'Submitting…' : saveSuccess ? 'Submitted' : 'Submit PM Session'}
          </button>
          {saveSuccess && <span className="text-green-600 font-medium text-sm">Session submitted successfully</span>}
          {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
        </div>
      </div>
    </AppShell>
  )
}

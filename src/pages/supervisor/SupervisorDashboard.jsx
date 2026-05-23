import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useSessionStore } from '../../store/sessionStore'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { getAllStaff } from '../../api/staffService'
import { updateSession } from '../../api/sessionsService'
import { upsertGrazingGround } from '../../api/grazingGroundsService'
import GroupTallyRow from '../../components/forms/GroupTallyRow'
import MovementLog from '../../components/forms/MovementLog'
import AppShell from '../../components/layout/AppShell'

const GROUP_ORDER = [
  'Annex Farm',
  'Main Farm',
  'Horsefield',
  'Paddock - Mothers',
  'Paddock - Kids',
  'Paddock - Males',
  'Sick/Vulnerable Flock',
]

export default function SupervisorDashboard() {
  const { sessions, groups, loading, error, updateSessionLocally } = useSessionStore()
  const { reload } = useTodaySessions()
  const [staff, setStaff] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Form header state
  const [amTime, setAmTime] = useState('')
  const [weather, setWeather] = useState('')
  const [countingSupervisor, setCountingSupervisor] = useState('')
  const [herdsmanInCharge, setHerdsmanInCharge] = useState('')
  const [witness, setWitness] = useState('')

  useEffect(() => {
    getAllStaff().then(setStaff).catch(console.error)
  }, [])

  const supervisors = staff.filter((s) => s.fields['Role'] === 'Supervisor')
  const herdsmen = staff.filter((s) => s.fields['Role'] === 'Herdsman')
  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  // Sort sessions by GROUP_ORDER
  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return sessions.find((s) => s.fields['Group']?.[0] === group?.id)
  }).filter(Boolean)

  const totalAM = sortedSessions.reduce((sum, s) => sum + (s.fields['AM Count'] || 0), 0)

  function handleRowChange(sessionId, fields) {
    updateSessionLocally(sessionId, fields)
  }

  async function handleSaveAM() {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      await Promise.all(
        sortedSessions.map(async (sess) => {
          const grazingGround = sess.fields['Grazing Ground']
          if (grazingGround && grazingGround !== 'Enclosure (N/A)') {
            await upsertGrazingGround(grazingGround)
          }
          return updateSession(sess.id, {
            'AM Departure Time': amTime,
            'Grazing Ground': sess.fields['Grazing Ground'],
            'AM Count': sess.fields['AM Count'],
            'Herdsman': sess.fields['Herdsman'],
            'Notes': sess.fields['Notes'],
            'Counting Supervisor': countingSupervisor ? [countingSupervisor] : undefined,
            'Herdsman In Charge': herdsmanInCharge ? [herdsmanInCharge] : undefined,
            'Witness': witness ? [witness] : undefined,
            Weather: weather,
            Status: 'Open',
          })
        })
      )
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-500">Loading today's sessions…</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-green-primary">Daily Animal Register</h1>
            <p className="text-gray-500 text-sm mt-1">{today} · Form DAR-{format(new Date(), 'yyyyMMdd')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-green-primary text-white rounded-xl px-5 py-3 text-center">
              <p className="text-xs text-green-light">Total Animals Out (AM)</p>
              <p className="text-3xl font-bold">{totalAM}</p>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        {/* Section 1 — Session Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-green-primary mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Session Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AM Departure Time</label>
              <input
                type="time"
                value={amTime}
                onChange={(e) => setAmTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weather (optional)</label>
              <input
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g. Clear, 24°C"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Personnel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-green-primary mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Personnel on Duty
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Counting Supervisor</label>
              <select
                value={countingSupervisor}
                onChange={(e) => setCountingSupervisor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
              >
                <option value="">— Select —</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>{s.fields['Name']}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Herdsman-in-Charge</label>
              <select
                value={herdsmanInCharge}
                onChange={(e) => setHerdsmanInCharge(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
              >
                <option value="">— Select —</option>
                {herdsmen.map((s) => (
                  <option key={s.id} value={s.id}>{s.fields['Name']}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Independent Witness</label>
              <select
                value={witness}
                onChange={(e) => setWitness(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
              >
                <option value="">— Select —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.fields['Name']}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3 — Group Tally (AM) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <h2 className="text-base font-semibold text-green-primary">Group Tally — AM</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-3 font-medium">Group</th>
                  <th className="px-3 py-3 font-medium">Herdsman</th>
                  <th className="px-3 py-3 font-medium">Grazing Ground</th>
                  <th className="px-3 py-3 font-medium text-center">AM Count</th>
                  <th className="px-3 py-3 font-medium text-center">VAR</th>
                  <th className="px-3 py-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((sess, i) => (
                  <GroupTallyRow
                    key={sess.id}
                    session={sess}
                    groupName={GROUP_ORDER[i]}
                    staffOptions={herdsmen}
                    onChange={handleRowChange}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-50 border-t-2 border-green-200">
                  <td colSpan={3} className="px-3 py-3 text-sm font-semibold text-green-primary">Grand Total</td>
                  <td className="px-3 py-3 text-center font-bold text-green-primary">{totalAM}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Save AM button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveAM}
            disabled={saving}
            className="px-6 py-3 bg-green-primary text-white font-semibold rounded-xl hover:bg-green-deep transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save AM Session'}
          </button>
          {saveSuccess && <span className="text-green-600 text-sm font-medium">Saved successfully</span>}
          {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
        </div>

        {/* Section 4 — Animal Movements */}
        <MovementLog sessions={sortedSessions} groups={groups} staff={staff} onReload={reload} />

      </div>
    </AppShell>
  )
}

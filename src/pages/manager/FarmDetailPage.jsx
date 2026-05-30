import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { getAllStaff } from '../../api/staffService'
import { getSessionsByGrazingGround } from '../../api/sessionsService'
import AppShell from '../../components/layout/AppShell'
import { slugify } from '../../components/layout/NavBar'

const FARMS = [
  'Acacia Hill Estate',
  'Acacia Ridge Farm',
  'Acacia Springs Farm',
  'Acacia Tumaini Farm',
]

// Static dummy field metrics (will be replaced by sensor/RFID data later)
const DUMMY_FIELD_METRICS = {
  'acacia-hill-estate':  { capacity: 73, condition: 'Good',      conditionColor: 'text-green-600',  hectares: 42, waterPoints: 3 },
  'acacia-ridge-farm':   { capacity: 61, condition: 'Fair',      conditionColor: 'text-amber',      hectares: 35, waterPoints: 2 },
  'acacia-springs-farm': { capacity: 89, condition: 'Excellent', conditionColor: 'text-green-700',  hectares: 58, waterPoints: 4 },
  'acacia-tumaini-farm': { capacity: 45, condition: 'Good',      conditionColor: 'text-green-600',  hectares: 29, waterPoints: 2 },
}

const ENCLOSURE_GROUPS = ['Sick/Vulnerable Flock']

function MetricTile({ label, value, sub, color = 'text-green-primary', small = false }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold tabular-nums mt-0.5 ${color} ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Capacity bar
function CapacityBar({ pct }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber' : 'bg-red-400'
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Capacity utilisation</p>
      <p className="text-2xl font-bold text-green-primary mt-0.5 tabular-nums">{pct}%</p>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Dummy — sensor data coming</p>
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    Complete:    'bg-green-100 text-green-700',
    Open:        'bg-blue-100 text-blue-700',
    Discrepancy: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status || 'Open'}
    </span>
  )
}

function VarCell({ am, pm }) {
  if (pm == null) return <span className="text-gray-300">—</span>
  const v = pm - am
  return (
    <span className={`font-mono tabular-nums font-semibold ${v < 0 ? 'text-red-600' : v > 0 ? 'text-amber' : 'text-green-600'}`}>
      {v > 0 ? '+' : ''}{v}
    </span>
  )
}

export default function FarmDetailPage() {
  const { slug }   = useParams()
  const navigate   = useNavigate()
  const { sessions, groups, fieldUpdates, loading } = useSessionStore()
  useTodaySessions()

  const [staff, setStaff]       = useState([])
  const [history, setHistory]   = useState(null) // null = loading
  const [allGroups, setAllGroups] = useState([]) // groups from history records

  // Resolve farm name from slug
  const farmName = FARMS.find(f => slugify(f) === slug) || slug
  const dummyMetrics = DUMMY_FIELD_METRICS[slug] || { capacity: 60, condition: 'Good', conditionColor: 'text-green-600', hectares: 35, waterPoints: 2 }

  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  useEffect(() => {
    if (!farmName) return
    setHistory(null)
    getSessionsByGrazingGround(farmName)
      .then(records => {
        setHistory(records)
      })
      .catch(() => setHistory([]))
  }, [farmName])

  // Today's groups at this farm (from sessionStore)
  const todayGroups = sessions.filter(s => {
    const grp = groups.find(g => g.id === s.fields['Group']?.[0])
    return (
      s.fields['Grazing Ground'] === farmName &&
      !ENCLOSURE_GROUPS.includes(grp?.fields?.['Group Name'])
    )
  })

  // Helper: resolve group name from ID using sessionStore groups OR history context
  function resolveGroupName(groupId) {
    const g = groups.find(g => g.id === groupId)
    return g?.fields?.['Group Name'] || groupId
  }

  function resolveHerdsman(id) {
    return staff.find(s => s.id === id)?.fields?.['Name'] || '—'
  }

  // Compute metrics from history
  const histMetrics = (() => {
    if (!history || history.length === 0) return null
    const totalVisits     = history.length
    const totalAnimalDays = history.reduce((s, r) => s + (r.fields['AM Count'] || 0), 0)
    const avgGroupSize    = totalVisits > 0 ? Math.round(totalAnimalDays / totalVisits) : 0
    const lastVisitDate   = history[0]?.fields['Date']

    // Most frequent group
    const tally = {}
    history.forEach(r => {
      const gid = r.fields['Group']?.[0]
      if (gid) tally[gid] = (tally[gid] || 0) + 1
    })
    const topGroupId   = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topGroupName = topGroupId ? resolveGroupName(topGroupId) : '—'

    return { totalVisits, totalAnimalDays, avgGroupSize, lastVisitDate, topGroupName }
  })()

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-5xl">

        {/* ── Back + header ─────────────────────────────────────────────── */}
        <div>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-primary transition-colors mb-3">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-green-primary tracking-tight">{farmName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')} · Grazing field overview</p>
        </div>

        {/* ── Field info + dummy metrics ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile label="Area" value={`${dummyMetrics.hectares} ha`} sub="Total grazing area" />
          <MetricTile label="Water points" value={dummyMetrics.waterPoints} sub="Dummy — sensor pending" />
          <MetricTile
            label="Field condition"
            value={dummyMetrics.condition}
            color={dummyMetrics.conditionColor}
            sub="Dummy — sensor pending"
          />
          <CapacityBar pct={dummyMetrics.capacity} />
        </div>

        {/* ── Usage metrics from real history ──────────────────────────── */}
        {histMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricTile label="Visits (12 days)"    value={histMetrics.totalVisits}    small />
            <MetricTile label="Total animal-days"   value={histMetrics.totalAnimalDays} small />
            <MetricTile label="Avg group size"      value={histMetrics.avgGroupSize}   small sub="per visit" />
            <MetricTile label="Most frequent group" value={histMetrics.topGroupName}   small color="text-gray-800" />
            <MetricTile label="Last used"
              value={histMetrics.lastVisitDate ? format(parseISO(histMetrics.lastVisitDate), 'd MMM') : '—'}
              small />
          </div>
        )}

        {/* ── Today's flock ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Today's flock{todayGroups.length > 0 ? ` · ${todayGroups.length} group${todayGroups.length !== 1 ? 's' : ''}` : ''}
            </h2>
          </div>

          {todayGroups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 italic">No groups assigned to this farm today.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayGroups.map(sess => {
                const group      = groups.find(g => g.id === sess.fields['Group']?.[0])
                const herdsman   = staff.find(s => s.id === sess.fields['Herdsman']?.[0])
                const amCount    = sess.fields['AM Count'] ?? 0
                const pmCount    = sess.fields['PM Count']
                const variance   = pmCount != null ? pmCount - amCount : null
                const updates    = (fieldUpdates[sess.id] || [])
                  .slice()
                  .sort((a, b) => new Date(b.fields['Timestamp']) - new Date(a.fields['Timestamp']))
                const latest     = updates[0]
                const alerts     = updates.filter(u => u.fields['Alert Level'] === 'Urgent' || u.fields['Alert Level'] === 'Advisory').length

                return (
                  <div key={sess.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{group?.fields?.['Group Name'] || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Herdsman: <span className="font-medium text-gray-600">{herdsman?.fields?.['Name'] || 'Unassigned'}</span>
                          {herdsman?.fields?.['Phone'] && (
                            <a href={`tel:${herdsman.fields['Phone']}`}
                              className="ml-2 text-green-primary hover:underline font-medium">
                              Call
                            </a>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {alerts > 0 && (
                          <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                            {alerts} alert{alerts !== 1 ? 's' : ''}
                          </span>
                        )}
                        <StatusChip status={sess.fields['Status']} />
                      </div>
                    </div>

                    {/* Count strip */}
                    <div className="flex gap-3 text-sm mb-3">
                      {[
                        { label: 'AM', val: amCount },
                        { label: 'PM', val: pmCount ?? '—' },
                        { label: 'Var', val: variance != null ? (variance > 0 ? `+${variance}` : String(variance)) : '—',
                          color: variance == null ? 'text-gray-300' : variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber' : 'text-green-600' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[60px]">
                          <p className="text-[10px] text-gray-400 uppercase">{label}</p>
                          <p className={`font-mono font-bold text-lg tabular-nums ${color || 'text-gray-800'}`}>{val}</p>
                        </div>
                      ))}
                      {latest && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[80px]">
                          <p className="text-[10px] text-gray-400 uppercase">Field count</p>
                          <p className="font-mono font-bold text-lg tabular-nums text-gray-800">
                            {latest.fields['Current Count in Field']}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Latest field report */}
                    {latest && (
                      <div className="border border-gray-100 rounded-lg px-3 py-2.5 text-xs bg-gray-50/40">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Latest field report</p>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {latest.fields['Issues Reported']
                              ? <p className="text-gray-700">{latest.fields['Issues Reported']}</p>
                              : <p className="text-gray-400 italic">No issues reported.</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {latest.fields['Alert Level'] && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                latest.fields['Alert Level'] === 'Urgent'   ? 'bg-red-100 text-red-700' :
                                latest.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                                'bg-green-100 text-green-700'
                              }`}>{latest.fields['Alert Level']}</span>
                            )}
                            {latest.fields['Timestamp'] && (
                              <span className="text-gray-400 text-[10px]">
                                {format(new Date(latest.fields['Timestamp']), 'HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Historical records table ──────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Field history</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Last 12 days · one row per group visit</p>
            </div>
            {history && (
              <span className="text-xs text-gray-400">{history.length} session{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {history === null ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center italic">No historical visits found for this farm.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/30">
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Group</th>
                    <th className="px-4 py-2.5 text-left font-medium">Herdsman</th>
                    <th className="px-4 py-2.5 text-right font-medium">AM</th>
                    <th className="px-4 py-2.5 text-right font-medium">PM</th>
                    <th className="px-4 py-2.5 text-right font-medium">Var</th>
                    <th className="px-4 py-2.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => {
                    const am = r.fields['AM Count'] ?? 0
                    const pm = r.fields['PM Count']
                    const dateStr = r.fields['Date']
                    const groupId = r.fields['Group']?.[0]
                    const herdsmanId = r.fields['Herdsman']?.[0]

                    return (
                      <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                          {dateStr ? format(parseISO(dateStr), 'd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {resolveGroupName(groupId)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {resolveHerdsman(herdsmanId)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">{am}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {pm ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <VarCell am={am} pm={pm} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <StatusChip status={r.fields['Status']} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { getAllStaff } from '../../api/staffService'
import { getAnimalsByGroup } from '../../api/registryService'
import AppShell from '../../components/layout/AppShell'
import { slugify } from '../../components/layout/NavBar'

const FARMS = [
  'Acacia Hill Estate',
  'Acacia Ridge Farm',
  'Acacia Springs Farm',
  'Acacia Tumaini Farm',
]

// Groups excluded from Live Status (always in enclosure)
const ENCLOSURE_GROUPS = ['Sick/Vulnerable Flock']

function AlertBadge({ level }) {
  if (!level) return null
  const cls = level === 'Urgent'   ? 'bg-red-100 text-red-700' :
              level === 'Advisory' ? 'bg-amber-pale text-amber' :
                                     'bg-green-100 text-green-700'
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{level}</span>
}

// ── Breed breakdown for one group (lazy-loaded) ───────────────────────────────
function BreedBreakdown({ groupId }) {
  const [animals, setAnimals] = useState(null)

  useEffect(() => {
    getAnimalsByGroup(groupId)
      .then(records => {
        const tally = {}
        records.filter(r => r.fields['Status'] === 'Active').forEach(r => {
          const b = r.fields['Breed'] || 'Unknown'
          tally[b] = (tally[b] || 0) + 1
        })
        setAnimals(tally)
      })
      .catch(() => setAnimals({}))
  }, [groupId])

  if (animals === null) return <p className="text-xs text-gray-400 italic">Loading breeds…</p>

  const entries = Object.entries(animals).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <p className="text-xs text-gray-400 italic">No registry data.</p>

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([breed, count]) => (
        <span key={breed} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-mid/20 rounded text-[11px] text-green-primary">
          <span className="font-semibold">{breed}</span>
          <span className="text-green-light">×{count}</span>
        </span>
      ))}
    </div>
  )
}

// ── Single group card within a farm section ───────────────────────────────────
function GroupCard({ sess, group, herdsman, sessUpdates, amCount }) {
  const [expanded, setExpanded] = useState(false)
  const latestUpdate = sessUpdates[0]

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* Header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/70 transition-colors"
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          sess.fields['Status'] === 'Discrepancy' ? 'bg-red-500' :
          sess.fields['Status'] === 'Complete'    ? 'bg-green-500' : 'bg-blue-400'
        }`} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">
            {group?.fields?.['Group Name']}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {herdsman?.fields?.['Name'] || 'Unassigned'}
          </p>
        </div>

        {/* AM count */}
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">AM</p>
          <p className="font-mono font-bold text-lg text-green-primary tabular-nums">{amCount}</p>
        </div>

        {/* Latest field update quick view */}
        {latestUpdate && (
          <div className="text-right flex-shrink-0 hidden sm:block">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Field count</p>
            <p className="font-mono font-semibold text-sm tabular-nums">
              {latestUpdate.fields['Current Count in Field']}
              <span className={`ml-1 text-[10px] ${
                latestUpdate.fields['Current Count in Field'] < amCount ? 'text-red-500' :
                latestUpdate.fields['Current Count in Field'] > amCount ? 'text-amber' : 'text-green-600'
              }`}>
                ({latestUpdate.fields['Current Count in Field'] > amCount ? '+' : ''}
                {latestUpdate.fields['Current Count in Field'] - amCount})
              </span>
            </p>
          </div>
        )}

        {latestUpdate?.fields['Alert Level'] && (
          <div className="flex-shrink-0">
            <AlertBadge level={latestUpdate.fields['Alert Level']} />
          </div>
        )}

        {/* Chevron */}
        <svg viewBox="0 0 16 16" fill="currentColor"
          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-4">

          {/* Herdsman mid-day reports */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Mid-day field reports
            </p>
            {sessUpdates.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No reports submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {sessUpdates.map(u => (
                  <div key={u.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">
                            Count: {u.fields['Current Count in Field']}
                          </span>
                          {amCount > 0 && u.fields['Current Count in Field'] != null && (
                            <span className={`font-medium ${
                              u.fields['Current Count in Field'] < amCount ? 'text-red-500' :
                              u.fields['Current Count in Field'] > amCount ? 'text-amber' : 'text-green-600'
                            }`}>
                              ({u.fields['Current Count in Field'] > amCount ? '+' : ''}
                              {u.fields['Current Count in Field'] - amCount} from AM)
                            </span>
                          )}
                        </div>
                        {u.fields['Issues Reported'] && (
                          <p className="text-gray-500">{u.fields['Issues Reported']}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <AlertBadge level={u.fields['Alert Level']} />
                        {u.fields['Timestamp'] && (
                          <span className="text-gray-400 text-[10px]">
                            {format(new Date(u.fields['Timestamp']), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Breed breakdown */}
          {group?.id && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Breed composition
              </p>
              <BreedBreakdown groupId={group.id} />
            </div>
          )}

          {/* Herdsman contact */}
          {herdsman?.fields?.['Phone'] && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Herdsman contact
              </p>
              <a href={`tel:${herdsman.fields['Phone']}`}
                className="inline-flex items-center gap-2 text-xs text-green-primary font-medium hover:underline">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
                </svg>
                {herdsman.fields['Name']} · {herdsman.fields['Phone']}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Farm section ──────────────────────────────────────────────────────────────
function FarmSection({ farmName, sessions, groups, staff, movements, fieldUpdates, isHighlit, onViewFarm }) {
  const farmSessions = sessions.filter(
    s => s.fields['Grazing Ground'] === farmName &&
         !ENCLOSURE_GROUPS.includes(
           groups.find(g => g.id === s.fields['Group']?.[0])?.fields['Group Name']
         )
  )

  const totalAM = farmSessions.reduce((sum, s) => sum + (s.fields['AM Count'] || 0), 0)
  const alerts  = farmSessions.reduce((sum, s) => {
    const updates = fieldUpdates[s.id] || []
    return sum + updates.filter(u => u.fields['Alert Level'] === 'Urgent' || u.fields['Alert Level'] === 'Advisory').length
  }, 0)

  return (
    <div id={slugify(farmName)}
      className={`rounded-xl border overflow-hidden transition-colors duration-700 ${
        isHighlit ? 'border-amber/50 shadow-md' : 'border-gray-100'
      }`}
    >
      {/* Farm header */}
      <div className={`px-5 py-3 flex items-center justify-between ${
        isHighlit ? 'bg-amber-pale/50' : 'bg-white'
      }`}>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-green-primary text-sm">{farmName}</h2>
            <button
              onClick={onViewFarm}
              className="text-[10px] text-amber font-semibold hover:text-amber-light transition-colors flex items-center gap-1"
            >
              View farm
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {farmSessions.length} group{farmSessions.length !== 1 ? 's' : ''} grazing today
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total AM</p>
            <p className="font-mono font-bold text-xl tabular-nums text-green-primary">{totalAM}</p>
          </div>
          {alerts > 0 && (
            <div className="flex items-center gap-1 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-xs font-semibold text-red-700">{alerts} alert{alerts !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Groups in this farm */}
      <div className="bg-gray-50/40 p-4 space-y-3">
        {farmSessions.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">No groups assigned to this farm today.</p>
        ) : (
          farmSessions.map(sess => {
            const group     = groups.find(g => g.id === sess.fields['Group']?.[0])
            const herdsman  = staff.find(s => s.id === sess.fields['Herdsman']?.[0])
            const amCount   = sess.fields['AM Count'] ?? 0
            const sessUpdates = (fieldUpdates[sess.id] || [])
              .slice()
              .sort((a, b) => new Date(b.fields['Timestamp']) - new Date(a.fields['Timestamp']))

            return (
              <GroupCard
                key={sess.id}
                sess={sess}
                group={group}
                herdsman={herdsman}
                sessUpdates={sessUpdates}
                amCount={amCount}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LiveStatusPage() {
  const { sessions, groups, fieldUpdates, loading } = useSessionStore()
  const location = useLocation()
  const navigate = useNavigate()
  useTodaySessions()

  const [staff, setStaff]           = useState([])
  const [highlightId, setHighlightId] = useState(null)

  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  // Anchor scroll from sidebar farm sub-items
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightId(id)
      const t = setTimeout(() => setHighlightId(null), 2000)
      return () => clearTimeout(t)
    }
  }, [location.hash])

  // Aggregate stats for the stat strip
  const activeSessions = sessions.filter(
    s => !ENCLOSURE_GROUPS.includes(
      groups.find(g => g.id === s.fields['Group']?.[0])?.fields['Group Name']
    )
  )
  const totalAM     = activeSessions.reduce((sum, s) => sum + (s.fields['AM Count'] || 0), 0)
  const farmsActive = new Set(
    activeSessions.map(s => s.fields['Grazing Ground']).filter(Boolean)
  ).size
  const urgentAlerts = Object.values(fieldUpdates).flat()
    .filter(u => u.fields['Alert Level'] === 'Urgent').length

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-green-primary tracking-tight">Live Status</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(new Date(), 'EEEE, d MMMM yyyy')} · Real-time herd activity across grazing farms
          </p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Animals out',   value: totalAM,     color: 'text-green-primary' },
            { label: 'Active farms',  value: farmsActive,  color: 'text-green-primary' },
            { label: 'Urgent alerts', value: urgentAlerts, color: urgentAlerts > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* One section per farm */}
        {FARMS.map(farmName => (
          <FarmSection
            key={farmName}
            farmName={farmName}
            sessions={sessions}
            groups={groups}
            staff={staff}
            fieldUpdates={fieldUpdates}
            isHighlit={highlightId === slugify(farmName)}
            onViewFarm={() => navigate(`/farm/${slugify(farmName)}`)}
          />
        ))}
      </div>
    </AppShell>
  )
}

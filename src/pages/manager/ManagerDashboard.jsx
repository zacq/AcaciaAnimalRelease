import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { updateSession } from '../../api/sessionsService'
import { getAllStaff } from '../../api/staffService'
import AppShell from '../../components/layout/AppShell'
import { requestNotificationPermission } from '../../utils/notifications'
import { slugify } from '../../components/layout/NavBar'

const REVIEW_OPTIONS = ['Approved', 'Query', 'Discrepancy Noted']

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
]

const REASON_BADGE = {
  Death:          'bg-red-100 text-red-700',
  Sale:           'bg-orange-100 text-orange-700',
  Birth:          'bg-green-100 text-green-700',
  Transfer:       'bg-blue-100 text-blue-700',
  'Vet Referral': 'bg-purple-100 text-purple-700',
  Other:          'bg-gray-100 text-gray-600',
}

function VarBadge({ value }) {
  if (value == null) return <span className="text-gray-300 font-mono tabular-nums">—</span>
  const cls = value < 0 ? 'text-red-600' : value > 0 ? 'text-amber' : 'text-green-600'
  return (
    <span className={`font-mono font-semibold tabular-nums ${cls}`}>
      {value > 0 ? '+' : ''}{value}
    </span>
  )
}

function StatusChip({ status }) {
  const map = {
    Complete:    'bg-green-100 text-green-700',
    Open:        'bg-blue-100 text-blue-700',
    Discrepancy: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status || 'Open'}
    </span>
  )
}

export default function ManagerDashboard() {
  const { sessions, groups, movements, fieldUpdates, loading } = useSessionStore()
  const location = useLocation()
  useTodaySessions()

  const [staff, setStaff]                   = useState([])
  const navigate = useNavigate()
  const [expandedId, setExpandedId]     = useState(null)
  const [highlightId, setHighlightId]   = useState(null)
  const [commentDraft, setCommentDraft] = useState({})
  const [savingComment, setSavingComment] = useState(null)

  useEffect(() => { requestNotificationPermission() }, [])
  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  // Anchor scroll from sidebar group sub-items
  useEffect(() => {
    if (!location.hash) return
    const id  = location.hash.slice(1)
    const el  = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(id)
      setExpandedId(null)
      const t = setTimeout(() => setHighlightId(null), 1800)
      return () => clearTimeout(t)
    }
  }, [location.hash])

  const resolveStaff = useCallback((id) => staff.find((s) => s.id === id), [staff])

  async function handleReview(sessionId, value) {
    await updateSession(sessionId, { 'Farm Manager Reviewed': value })
  }

  async function handleSaveComment(sessionId) {
    const note = commentDraft[sessionId] ?? ''
    setSavingComment(sessionId)
    try { await updateSession(sessionId, { Notes: note }) }
    finally { setSavingComment(null) }
  }

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return { name, group, session: sessions.find((s) => s.fields['Group']?.[0] === group?.id) }
  }).filter(({ session }) => session)

  const totalAM = sortedSessions.reduce((s, { session }) => s + (session?.fields['AM Count'] || 0), 0)
  const totalPM = sortedSessions.every(({ session }) => session?.fields['PM Count'] != null)
    ? sortedSessions.reduce((s, { session }) => s + (session?.fields['PM Count'] || 0), 0)
    : null
  const totalVar        = totalPM != null ? totalPM - totalAM : null
  const discrepancies   = sortedSessions.filter(({ session }) => session?.fields['Status'] === 'Discrepancy').length
  const openSessions    = sortedSessions.filter(({ session }) => session?.fields['Status'] === 'Open').length

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading sessions…</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-6xl">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-green-primary tracking-tight">Farm Overview</h1>
            <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')} · Read-only</p>
          </div>
        </div>

        {/* ── Stat strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total AM',      value: totalAM,                   color: 'text-green-primary' },
            { label: 'Total PM',      value: totalPM ?? '—',             color: totalVar < 0 ? 'text-red-600' : 'text-green-primary' },
            { label: 'Variance',      value: totalVar != null ? (totalVar > 0 ? `+${totalVar}` : totalVar) : '—', color: totalVar < 0 ? 'text-red-600' : totalVar > 0 ? 'text-amber' : 'text-green-600' },
            { label: 'Discrepancies', value: discrepancies,              color: discrepancies > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Group data table ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Group</th>
                  <th className="px-4 py-3 text-left font-medium">Herdsman</th>
                  <th className="px-4 py-3 text-left font-medium">Grazing</th>
                  <th className="px-4 py-3 text-right font-medium">AM</th>
                  <th className="px-4 py-3 text-right font-medium">PM</th>
                  <th className="px-4 py-3 text-right font-medium">Var</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Moves</th>
                  <th className="px-5 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map(({ name, group, session: sess }) => {
                  const amCount   = sess.fields['AM Count'] ?? 0
                  const pmCount   = sess.fields['PM Count']
                  const variance  = pmCount != null ? pmCount - amCount : null
                  const herdsman  = resolveStaff(sess.fields['Herdsman']?.[0])
                  const sessMovements = movements[sess.id] || []
                  const sessUpdates   = fieldUpdates[sess.id] || []
                  const isExpanded = expandedId === sess.id
                  const slug       = slugify(name)
                  const isHighlit  = highlightId === slug

                  return [
                    // Main row
                    <tr
                      key={sess.id}
                      id={slug}
                      onClick={() => setExpandedId(isExpanded ? null : sess.id)}
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${
                        isHighlit   ? 'bg-amber-pale/60 ring-2 ring-amber/30' :
                        isExpanded  ? 'bg-green-50/60' :
                        'hover:bg-gray-50/70'
                      }`}
                    >
                      <td className="px-5 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${
                          sess.fields['Status'] === 'Discrepancy' ? 'bg-red-500' :
                          sess.fields['Status'] === 'Complete'    ? 'bg-green-500' : 'bg-blue-400'
                        }`} />
                        {name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{herdsman?.fields['Name'] || '—'}</td>
                      <td className="px-4 py-3.5 text-gray-500 max-w-[140px] truncate">{sess.fields['Grazing Ground'] || '—'}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium">{amCount}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums">{pmCount ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3.5 text-right"><VarBadge value={variance} /></td>
                      <td className="px-4 py-3.5 text-center"><StatusChip status={sess.fields['Status']} /></td>
                      <td className="px-4 py-3.5 text-center text-gray-500 tabular-nums">{sessMovements.length || '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/group/${slugify(name)}`) }}
                            className="text-xs text-amber font-medium hover:text-amber-light transition-colors"
                          >
                            View group
                          </button>
                          <span className={`text-xs text-green-primary font-medium flex items-center gap-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </span>
                        </div>
                      </td>
                    </tr>,

                    // Inline expansion row
                    isExpanded && (
                      <tr key={`${sess.id}-detail`}>
                        <td colSpan={9} className="p-0 border-t border-gray-100">
                          <ExpandedDetail
                            sess={sess}
                            sessMovements={sessMovements}
                            sessUpdates={sessUpdates}
                            amCount={amCount}
                            groups={groups}
                            commentDraft={commentDraft[sess.id] ?? sess.fields['Notes'] ?? ''}
                            onDraftChange={(v) => setCommentDraft((d) => ({ ...d, [sess.id]: v }))}
                            onReview={handleReview}
                            onSaveComment={() => handleSaveComment(sess.id)}
                            saving={savingComment === sess.id}
                          />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked rows */}
          <div className="md:hidden divide-y divide-gray-50">
            {sortedSessions.map(({ name, group, session: sess }) => {
              const amCount   = sess.fields['AM Count'] ?? 0
              const pmCount   = sess.fields['PM Count']
              const variance  = pmCount != null ? pmCount - amCount : null
              const herdsman  = resolveStaff(sess.fields['Herdsman']?.[0])
              const sessMovements = movements[sess.id] || []
              const sessUpdates   = fieldUpdates[sess.id] || []
              const isExpanded    = expandedId === sess.id
              const slug          = slugify(name)
              const isHighlit     = highlightId === slug

              return (
                <div key={sess.id} id={slug}
                  className={`transition-colors ${isHighlit ? 'bg-amber-pale/50' : ''}`}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sess.id)}
                    className={`px-4 py-3 cursor-pointer ${isExpanded ? 'bg-green-50/60' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          sess.fields['Status'] === 'Discrepancy' ? 'bg-red-500' :
                          sess.fields['Status'] === 'Complete'    ? 'bg-green-500' : 'bg-blue-400'
                        }`} />
                        <span className="font-semibold text-sm text-gray-800">{name}</span>
                      </div>
                      <StatusChip status={sess.fields['Status']} />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400 text-xs">AM <span className="text-gray-700 font-mono font-semibold">{amCount}</span></span>
                      <span className="text-gray-400 text-xs">PM <span className="text-gray-700 font-mono font-semibold">{pmCount ?? '—'}</span></span>
                      <VarBadge value={variance} />
                      <span className="text-gray-400 text-xs ml-auto">{herdsman?.fields['Name'] || '—'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <ExpandedDetail
                        sess={sess}
                        sessMovements={sessMovements}
                        sessUpdates={sessUpdates}
                        amCount={amCount}
                        groups={groups}
                        commentDraft={commentDraft[sess.id] ?? sess.fields['Notes'] ?? ''}
                        onDraftChange={(v) => setCommentDraft((d) => ({ ...d, [sess.id]: v }))}
                        onReview={handleReview}
                        onSaveComment={() => handleSaveComment(sess.id)}
                        saving={savingComment === sess.id}
                        onViewGroup={() => navigate(`/group/${slugify(name)}`)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </AppShell>
  )
}

// ── Shared inline detail panel ────────────────────────────────────────────────
function ExpandedDetail({
  sess, sessMovements, sessUpdates, amCount, groups,
  commentDraft, onDraftChange, onReview, onSaveComment, saving, onViewGroup,
}) {
  function groupName(id) {
    return groups.find((g) => g.id === id)?.fields['Group Name'] || '—'
  }

  return (
    <div className="bg-gray-50/70 px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-5 max-h-[60vh] overflow-y-auto overscroll-contain text-xs">

      {/* Movements */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Movements today</p>
        {sessMovements.length === 0 ? (
          <p className="text-gray-400 italic">None recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {sessMovements.map((m) => (
              <div key={m.id} className="flex items-start gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${REASON_BADGE[m.fields['Reason']] || 'bg-gray-100 text-gray-600'}`}>
                  {m.fields['Reason']}
                </span>
                <span className="font-mono text-gray-700">{m.fields['Ear Tag']}</span>
                {m.fields['Health/Condition Notes'] && (
                  <span className="text-gray-400 italic truncate">— {m.fields['Health/Condition Notes']}</span>
                )}
                <span className="ml-auto text-gray-300 flex-shrink-0">{m.fields['Time']}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Field updates */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Field updates</p>
        {sessUpdates.length === 0 ? (
          <p className="text-gray-400 italic">No updates yet.</p>
        ) : (
          <div className="space-y-1.5">
            {sessUpdates.map((u) => (
              <div key={u.id} className="flex items-start justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-100 gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-gray-800">Count: {u.fields['Current Count in Field']}</span>
                  {amCount > 0 && u.fields['Current Count in Field'] != null && (
                    <span className={`ml-1.5 font-medium ${
                      u.fields['Current Count in Field'] < amCount ? 'text-red-500' :
                      u.fields['Current Count in Field'] === amCount ? 'text-green-600' : 'text-amber'
                    }`}>
                      ({u.fields['Current Count in Field'] > amCount ? '+' : ''}{u.fields['Current Count in Field'] - amCount})
                    </span>
                  )}
                  {u.fields['Issues Reported'] && (
                    <p className="text-gray-400 mt-0.5 truncate">{u.fields['Issues Reported']}</p>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                  u.fields['Alert Level'] === 'Urgent'   ? 'bg-red-100 text-red-700' :
                  u.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                  'bg-green-100 text-green-700'
                }`}>{u.fields['Alert Level']}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review + notes */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Supervisor status</p>
          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              sess.fields['Supervisor Signature'] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{sess.fields['Supervisor Signature'] ? 'Sup. signed' : 'Awaiting sup.'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              sess.fields['Herdsman Signature'] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{sess.fields['Herdsman Signature'] ? 'H/man signed' : 'Awaiting h/man'}</span>
          </div>
        </div>

        {(sess.fields['Status'] === 'Complete' || sess.fields['Status'] === 'Discrepancy') && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Your review</p>
            <select
              defaultValue={sess.fields['Farm Manager Reviewed'] || ''}
              onChange={(e) => onReview(sess.id, e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-mid"
            >
              <option value="">— Pending —</option>
              {REVIEW_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Notes</p>
          <textarea
            rows={2}
            value={commentDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Add a note…"
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs resize-none bg-white focus:outline-none focus:ring-1 focus:ring-green-mid"
          />
          <button
            onClick={onSaveComment}
            disabled={saving}
            className="mt-1 px-3 py-1 bg-green-primary text-white text-[10px] font-medium rounded-lg hover:bg-green-deep disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>

        {onViewGroup && (
          <button onClick={onViewGroup}
            className="text-xs text-amber font-semibold hover:text-amber-light transition-colors flex items-center gap-1">
            View full group page
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

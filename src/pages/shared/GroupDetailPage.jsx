import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useSessionStore } from '../../store/sessionStore'
import { useAuth } from '../../auth/AuthContext'
import { getAllStaff } from '../../api/staffService'
import { getAnimalsByGroup } from '../../api/registryService'
import { updateSession } from '../../api/sessionsService'
import AppShell from '../../components/layout/AppShell'
import { slugify } from '../../components/layout/NavBar'

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

const STATUS_COLORS = {
  Active:              'bg-green-100 text-green-700',
  Sold:                'bg-blue-100 text-blue-700',
  Deceased:            'bg-gray-100 text-gray-500',
  Sick:                'bg-red-100 text-red-700',
  'Born (pending tag)':'bg-amber-pale text-amber',
}

const REVIEW_OPTIONS = ['Approved', 'Query', 'Discrepancy Noted']

function StatTile({ label, value, sub, color = 'text-green-primary' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  )
}

export default function GroupDetailPage() {
  const { slug }      = useParams()
  const navigate      = useNavigate()
  const { user }      = useAuth()
  const { sessions, groups, movements, fieldUpdates, loading } = useSessionStore()
  useTodaySessions()

  const [staff, setStaff]           = useState([])
  const [animals, setAnimals]       = useState(null)   // null = loading
  const [animalSearch, setAnimalSearch] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [reviewSaving, setReviewSaving]   = useState(false)

  useEffect(() => { getAllStaff().then(setStaff).catch(console.error) }, [])

  // Resolve group from slug
  const group = groups.find(g => slugify(g.fields['Group Name']) === slug)
  const groupName = group
    ? group.fields['Group Name']
    : GROUP_ORDER.find(n => slugify(n) === slug) || slug

  // Resolve today's session for this group
  const session = sessions.find(s => s.fields['Group']?.[0] === group?.id)

  // Load animals once group is known
  useEffect(() => {
    if (!group?.id) return
    setAnimals(null)
    getAnimalsByGroup(group.id)
      .then(setAnimals)
      .catch(() => setAnimals([]))
  }, [group?.id])

  // Sync comment draft from session
  useEffect(() => {
    if (session) setCommentDraft(session.fields['Notes'] || '')
  }, [session?.id])

  const sessMovements = session ? (movements[session.id] || []) : []
  const sessUpdates   = session
    ? (fieldUpdates[session.id] || [])
        .slice()
        .sort((a, b) => new Date(b.fields['Timestamp']) - new Date(a.fields['Timestamp']))
    : []

  const herdsman    = staff.find(s => s.id === session?.fields['Herdsman']?.[0])
  const supervisor  = staff.find(s => s.id === session?.fields['Counting Supervisor']?.[0])
  const amCount     = session?.fields['AM Count'] ?? 0
  const pmCount     = session?.fields['PM Count']
  const variance    = pmCount != null ? pmCount - amCount : null
  const status      = session?.fields['Status'] || 'Open'

  // Animal table filter
  const filteredAnimals = (animals || []).filter(a => {
    if (!animalSearch) return true
    const q = animalSearch.toLowerCase()
    return (
      (a.fields['Left Tag']  || '').toLowerCase().includes(q) ||
      (a.fields['Right Tag'] || '').toLowerCase().includes(q) ||
      (a.fields['Breed']     || '').toLowerCase().includes(q) ||
      (a.fields['Ear Tag']   || '').toLowerCase().includes(q)
    )
  })

  async function handleReview(value) {
    if (!session) return
    setReviewSaving(true)
    try { await updateSession(session.id, { 'Farm Manager Reviewed': value }) }
    finally { setReviewSaving(false) }
  }

  async function handleSaveComment() {
    if (!session) return
    setSavingComment(true)
    try { await updateSession(session.id, { Notes: commentDraft }) }
    finally { setSavingComment(false) }
  }

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
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-primary transition-colors mb-3"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
            Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-green-primary tracking-tight">{groupName}</h1>
              <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
              status === 'Complete'    ? 'bg-green-100 text-green-700' :
              status === 'Discrepancy'? 'bg-red-100 text-red-700'     :
                                        'bg-blue-100 text-blue-700'
            }`}>{status}</span>
          </div>
        </div>

        {/* ── Stat strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="AM Count" value={amCount} />
          <StatTile
            label="PM Count"
            value={pmCount ?? '—'}
            color={pmCount == null ? 'text-gray-300' : variance < 0 ? 'text-red-600' : 'text-green-primary'}
          />
          <StatTile
            label="Variance"
            value={variance != null ? (variance > 0 ? `+${variance}` : variance) : '—'}
            color={variance == null ? 'text-gray-300' : variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber' : 'text-green-600'}
            sub={variance === 0 ? 'No change' : variance < 0 ? 'Animals unaccounted' : 'Above opening count'}
          />
          <StatTile
            label="Status"
            value={status}
            color={status === 'Discrepancy' ? 'text-red-600' : status === 'Complete' ? 'text-green-primary' : 'text-blue-600'}
          />
        </div>

        {/* ── Session info ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Today's session</h2>
          <div>
            <InfoRow label="Herdsman"         value={herdsman?.fields['Name']} />
            <InfoRow label="Supervisor"       value={supervisor?.fields['Name']} />
            <InfoRow label="Grazing farm"     value={session?.fields['Grazing Ground']} />
            <InfoRow label="Departed"         value={session?.fields['AM Departure Time']} />
            <InfoRow label="Returned"         value={session?.fields['PM Return Time']} />
            <InfoRow label="Weather"          value={session?.fields['Weather']} />
            {session?.fields['Supervisor Signature'] && (
              <InfoRow label="Signatures" value={[
                session.fields['Supervisor Signature'] ? 'Supervisor ✓' : null,
                session.fields['Herdsman Signature']   ? 'Herdsman ✓'   : null,
              ].filter(Boolean).join('  ·  ')} />
            )}
          </div>
          {herdsman?.fields['Phone'] && (
            <a href={`tel:${herdsman.fields['Phone']}`}
              className="inline-flex items-center gap-2 mt-3 text-xs text-green-primary font-medium hover:underline">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
              </svg>
              Call {herdsman.fields['Name']} · {herdsman.fields['Phone']}
            </a>
          )}
        </div>

        {/* ── Herdsman field reports ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Mid-day field reports
          </h2>
          {sessUpdates.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No reports submitted today.</p>
          ) : (
            <div className="space-y-2">
              {sessUpdates.map(u => (
                <div key={u.id} className="flex items-start justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2.5 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">
                        Count: {u.fields['Current Count in Field']}
                      </span>
                      {amCount > 0 && u.fields['Current Count in Field'] != null && (
                        <span className={`text-xs font-medium ${
                          u.fields['Current Count in Field'] < amCount ? 'text-red-500' :
                          u.fields['Current Count in Field'] > amCount ? 'text-amber'   : 'text-green-600'
                        }`}>
                          ({u.fields['Current Count in Field'] > amCount ? '+' : ''}
                          {u.fields['Current Count in Field'] - amCount} from AM)
                        </span>
                      )}
                    </div>
                    {u.fields['Issues Reported'] && (
                      <p className="text-gray-500 text-xs">{u.fields['Issues Reported']}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {u.fields['Alert Level'] && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.fields['Alert Level'] === 'Urgent'   ? 'bg-red-100 text-red-700' :
                        u.fields['Alert Level'] === 'Advisory' ? 'bg-amber-pale text-amber' :
                        'bg-green-100 text-green-700'
                      }`}>{u.fields['Alert Level']}</span>
                    )}
                    {u.fields['Timestamp'] && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(u.fields['Timestamp']), 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Movements today ──────────────────────────────────────────── */}
        {sessMovements.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Movements today
            </h2>
            <div className="space-y-1.5">
              {sessMovements.map(m => (
                <div key={m.id} className="flex items-start gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${REASON_BADGE[m.fields['Reason']] || 'bg-gray-100 text-gray-600'}`}>
                    {m.fields['Reason']}
                  </span>
                  <span className="font-mono text-gray-700">{m.fields['Ear Tag']}</span>
                  {m.fields['Health/Condition Notes'] && (
                    <span className="text-gray-400 italic text-xs truncate">— {m.fields['Health/Condition Notes']}</span>
                  )}
                  {m.fields['Time'] && (
                    <span className="ml-auto text-gray-400 text-xs flex-shrink-0">{m.fields['Time']}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Animal registry table ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Animal registry
              </h2>
              {animals !== null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {animals.length} registered · {amCount} in today's session
                  {animals.length < amCount && (
                    <span className="text-amber ml-1">· {amCount - animals.length} not yet tagged</span>
                  )}
                </p>
              )}
            </div>
            <input
              type="text"
              value={animalSearch}
              onChange={e => setAnimalSearch(e.target.value)}
              placeholder="Filter by tag or breed…"
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-mid w-48"
            />
          </div>

          {animals === null ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Loading animals…</p>
          ) : filteredAnimals.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center italic">
              {animals.length === 0 ? 'No animals registered in this group yet.' : 'No animals match that filter.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left font-medium">Left Tag</th>
                    <th className="px-4 py-2.5 text-left font-medium">Right Tag</th>
                    <th className="px-4 py-2.5 text-left font-medium">Breed</th>
                    <th className="px-4 py-2.5 text-left font-medium">Gender</th>
                    <th className="px-4 py-2.5 text-right font-medium">Weight (kg)</th>
                    <th className="px-4 py-2.5 text-left font-medium">DOB / Year</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnimals.map(a => {
                    const f = a.fields
                    const dob = f['Date of Birth']
                      ? format(new Date(f['Date of Birth']), 'd MMM yyyy')
                      : f['Birth Year']
                        ? String(f['Birth Year'])
                        : '—'
                    return (
                      <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-green-primary">
                          {f['Left Tag'] || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-green-primary">
                          {f['Right Tag'] || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{f['Breed'] || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{f['Gender'] || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {f['Current Weight kg'] != null
                            ? <span className="font-medium">{f['Current Weight kg']}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{dob}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[f['Status']] || 'bg-gray-100 text-gray-600'}`}>
                            {f['Status'] || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── FM review + notes (Farm Manager only) ────────────────────── */}
        {user.role === 'Farm Manager' && session && (
          (session.fields['Status'] === 'Complete' || session.fields['Status'] === 'Discrepancy') && (
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Your review</h2>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Review status</label>
                <select
                  defaultValue={session.fields['Farm Manager Reviewed'] || ''}
                  onChange={e => handleReview(e.target.value)}
                  disabled={reviewSaving}
                  className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-mid disabled:opacity-60"
                >
                  <option value="">— Pending —</option>
                  {REVIEW_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Notes</label>
                <textarea
                  rows={3}
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder="Add a note for this group…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-mid"
                />
                <button
                  onClick={handleSaveComment}
                  disabled={savingComment}
                  className="mt-2 px-4 py-1.5 bg-green-primary text-white text-xs font-medium rounded-lg hover:bg-green-deep disabled:opacity-60 transition-colors"
                >
                  {savingComment ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </div>
          )
        )}

      </div>
    </AppShell>
  )
}

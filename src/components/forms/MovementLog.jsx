import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useSessionStore } from '../../store/sessionStore'
import { createMovement, deleteMovement } from '../../api/movementsService'
import { updateGroupCount } from '../../api/groupsService'
import { searchAnimals, createAnimal, updateAnimal } from '../../api/registryService'
import { computeMovementImpact } from '../../utils/countIntegrity'
import { format } from 'date-fns'

const REASONS = ['Transfer', 'Death', 'Sale', 'Birth', 'Vet Referral', 'Other']
const MAX_MOVEMENTS = 5

const EMPTY_FORM = {
  earTag: '', fromGroup: '', toGroup: '', time: '', reason: 'Transfer',
  notes: '', vetFlag: false, destConfirmed: false,
}

export default function MovementLog({ sessions, groups, staff, onReload }) {
  const { user } = useAuth()
  const { movements, addMovementLocally, removeMovementLocally } = useSessionStore()
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  // Autocomplete state
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching]     = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [showDropdown, setShowDropdown]     = useState(false)
  const searchTimer = useRef(null)
  const dropdownRef = useRef(null)

  const allMovements   = sessions.flatMap((s) => (movements[s.id] || []).map((m) => ({ ...m, sessionId: s.id })))
  const movementCount  = allMovements.length

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  function groupName(groupId) {
    return groups.find((g) => g.id === groupId)?.fields['Group Name'] || '—'
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    setSearching(true)
    try {
      const results = await searchAnimals(q)
      setSuggestions(results)
      setShowDropdown(results.length > 0)
    } catch (_) {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleTagChange(val) {
    set('earTag', val)
    setSelectedAnimal(null)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(val), 300)
  }

  function selectAnimal(animal) {
    const tag  = animal.fields['Ear Tag']
    const gid  = animal.fields['Group']?.[0]
    setForm((f) => ({ ...f, earTag: tag, fromGroup: gid || f.fromGroup }))
    setSelectedAnimal(animal)
    setSuggestions([])
    setShowDropdown(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    setError('')
    if (!form.earTag.trim()) { setError('Ear tag is required'); return }
    if (!form.reason)        { setError('Reason is required');  return }
    if ((form.reason === 'Death' || form.reason === 'Vet Referral') && !form.notes.trim()) {
      setError('Health/condition notes are required for Death and Vet Referral')
      return
    }
    if (movementCount >= MAX_MOVEMENTS) { setError('Maximum 5 movements per session reached'); return }

    const session = sessions.find((s) => s.fields['Group']?.[0] === form.fromGroup) || sessions[0]
    if (!session) { setError('No session found to attach movement to'); return }

    setSaving(true)
    try {
      const { sourceImpact, destImpact } = computeMovementImpact(form.reason)

      const fields = {
        Session:   [session.id],
        'Ear Tag': form.earTag.trim(),
        'From Group': form.fromGroup ? [form.fromGroup] : undefined,
        'To Group':   form.toGroup   ? [form.toGroup]   : undefined,
        Time:      form.time || format(new Date(), 'HH:mm'),
        Reason:    form.reason,
        'Health/Condition Notes':          form.notes || undefined,
        'Vet Referral Flag':               form.vetFlag,
        'Authorised By':                   [user.id],
        'Destination Herdsman Confirmed':  form.destConfirmed,
        'Count Impact': sourceImpact === -1 ? 'Out (−1)' : destImpact === 1 ? 'In (+1)' : 'No Change',
      }

      const created = await createMovement(fields)
      addMovementLocally(session.id, created)

      // Update group counts
      if (sourceImpact !== 0 && form.fromGroup) {
        const srcGroup = groups.find((g) => g.id === form.fromGroup)
        if (srcGroup) {
          await updateGroupCount(form.fromGroup, Math.max(0, (srcGroup.fields['Current Total Count'] || 0) + sourceImpact))
        }
      }
      if (destImpact !== 0 && form.toGroup) {
        const dstGroup = groups.find((g) => g.id === form.toGroup)
        if (dstGroup) {
          await updateGroupCount(form.toGroup, Math.max(0, (dstGroup.fields['Current Total Count'] || 0) + destImpact))
        }
      }

      // ── Sync Animal Registry ──────────────────────────────────────────────
      const today = format(new Date(), 'yyyy-MM-dd')
      const registryId = selectedAnimal?.id || null

      if (form.reason === 'Birth') {
        if (!registryId) {
          await createAnimal({
            'Ear Tag': form.earTag.trim(),
            Group: form.toGroup ? [form.toGroup] : undefined,
            Status: 'Born (pending tag)',
            'Date Added': today,
          })
        }
      } else if (registryId) {
        const update = {}
        if (form.reason === 'Death')    { update['Status'] = 'Deceased'; update['Date of Status Change'] = today; update['Group'] = [] }
        if (form.reason === 'Sale')     { update['Status'] = 'Sold';     update['Date of Status Change'] = today; update['Group'] = [] }
        if (form.reason === 'Transfer') { update['Group']  = form.toGroup ? [form.toGroup] : [] }
        if (Object.keys(update).length) await updateAnimal(registryId, update)
      }

      setForm(EMPTY_FORM)
      setSelectedAnimal(null)
      onReload()
    } catch (err) {
      setError(err.message || 'Failed to save movement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(movement) {
    if (!window.confirm('Remove this movement record?')) return
    try {
      await deleteMovement(movement.id)
      removeMovementLocally(movement.sessionId, movement.id)
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
          <h2 className="text-base font-semibold text-green-primary">Animal Movement Log</h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${movementCount >= MAX_MOVEMENTS ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {movementCount} / {MAX_MOVEMENTS}
        </span>
      </div>

      {/* Logged movements */}
      {allMovements.length > 0 && (
        <div className="overflow-x-auto border-b border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                <th className="px-3 py-2">Ear Tag</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Impact</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {allMovements.map((m) => (
                <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono font-medium">{m.fields['Ear Tag']}</td>
                  <td className="px-3 py-2">{groupName(m.fields['From Group']?.[0])}</td>
                  <td className="px-3 py-2">{groupName(m.fields['To Group']?.[0])}</td>
                  <td className="px-3 py-2">{m.fields['Time']}</td>
                  <td className="px-3 py-2">{m.fields['Reason']}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      m.fields['Count Impact'] === 'Out (−1)' ? 'bg-red-100 text-red-700' :
                      m.fields['Count Impact'] === 'In (+1)'  ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {m.fields['Count Impact']}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(m)} className="text-gray-400 hover:text-red-500 text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add movement form */}
      {movementCount < MAX_MOVEMENTS && (
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Log New Movement</h3>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Ear Tag with autocomplete */}
            <div className="relative col-span-2 sm:col-span-1" ref={dropdownRef}>
              <label className="text-xs text-gray-500 mb-1 block">Ear Tag *</label>
              <input
                type="text"
                value={form.earTag}
                onChange={(e) => handleTagChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                placeholder="Type tag to search…"
                autoComplete="off"
              />
              {searching && (
                <span className="absolute right-3 top-8 text-xs text-gray-400">searching…</span>
              )}
              {showDropdown && suggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((a) => (
                    <li
                      key={a.id}
                      onMouseDown={() => selectAnimal(a)}
                      className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <span className="font-mono font-semibold text-green-primary text-sm">{a.fields['Ear Tag']}</span>
                      {a.fields['Breed'] && <span className="ml-2 text-xs text-gray-500">{a.fields['Breed']}</span>}
                      {a.fields['Gender'] && <span className="ml-1 text-xs text-gray-400">· {a.fields['Gender']}</span>}
                      {a.fields['Current Weight kg'] && <span className="ml-1 text-xs text-gray-400">· {a.fields['Current Weight kg']}kg</span>}
                      {a.fields['Group']?.[0] && (
                        <span className="ml-1 text-xs text-gray-400">· {groupName(a.fields['Group'][0])}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">From Group</label>
              <select value={form.fromGroup} onChange={(e) => set('fromGroup', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                <option value="">— None —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.fields['Group Name']}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To Group</label>
              <select value={form.toGroup} onChange={(e) => set('toGroup', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                <option value="">— None —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.fields['Group Name']}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Time</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Reason *</label>
              <select value={form.reason} onChange={(e) => set('reason', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">
                Health/Condition Notes {(form.reason === 'Death' || form.reason === 'Vet Referral') && <span className="text-red-500">*</span>}
              </label>
              <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                placeholder="Condition details…" />
            </div>
          </div>

          {/* Selected animal info card */}
          {selectedAnimal && (
            <div className="flex items-center gap-4 px-4 py-3 bg-green-50 border border-green-mid/30 rounded-lg text-sm">
              <div className="w-8 h-8 bg-green-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{selectedAnimal.fields['Gender'] || '?'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-green-primary font-mono">{selectedAnimal.fields['Ear Tag']}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[selectedAnimal.fields['Breed'], selectedAnimal.fields['Breeding Class']].filter(Boolean).join(' · ')}
                  {selectedAnimal.fields['Date of Birth'] && ` · Born ${selectedAnimal.fields['Date of Birth']}`}
                </p>
              </div>
              {selectedAnimal.fields['Current Weight kg'] && (
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-green-primary">{selectedAnimal.fields['Current Weight kg']} kg</p>
                  <p className="text-xs text-gray-400">last weight</p>
                </div>
              )}
              <button onClick={() => { setSelectedAnimal(null); set('earTag', '') }}
                className="text-gray-400 hover:text-red-500 text-xs flex-shrink-0">✕</button>
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.vetFlag} onChange={(e) => set('vetFlag', e.target.checked)}
                className="w-4 h-4 accent-amber" />
              Vet Referral Flag
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.destConfirmed} onChange={(e) => set('destConfirmed', e.target.checked)}
                className="w-4 h-4 accent-green-primary" />
              Destination Herdsman Confirmed
            </label>
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="px-5 py-2.5 bg-amber text-green-primary font-semibold rounded-lg hover:bg-amber-light transition-colors disabled:opacity-60 text-sm">
            {saving ? 'Logging…' : 'Log Movement'}
          </button>
        </div>
      )}
      {movementCount >= MAX_MOVEMENTS && (
        <p className="px-6 py-4 text-sm text-red-600">Maximum of 5 movements reached for this session.</p>
      )}
    </div>
  )
}

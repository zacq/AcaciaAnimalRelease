import { useState, useEffect } from 'react'
import { getAnimalsByGroup } from '../../api/registryService'
import { getWeightHistory, addWeightLog } from '../../api/weightLogsService'
import { format } from 'date-fns'

const STATUS_COLORS = {
  Active:   'bg-green-100 text-green-700',
  Sold:     'bg-blue-100 text-blue-700',
  Deceased: 'bg-gray-100 text-gray-500',
  Sick:     'bg-red-100 text-red-700',
  'Born (pending tag)': 'bg-amber-pale text-amber',
  Unassigned: 'bg-yellow-100 text-yellow-700',
}

function AnimalDetailDrawer({ animal, groupName, onClose, canAddWeight }) {
  const [history, setHistory]     = useState([])
  const [loadingH, setLoadingH]   = useState(true)
  const [addingW, setAddingW]     = useState(false)
  const [wForm, setWForm]         = useState({ date: format(new Date(), 'yyyy-MM-dd'), kg: '', notes: '' })
  const [wError, setWError]       = useState('')
  const [wSaving, setWSaving]     = useState(false)

  const f = animal.fields

  useEffect(() => {
    setLoadingH(true)
    getWeightHistory(animal.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingH(false))
  }, [animal.id])

  async function handleAddWeight() {
    setWError('')
    const kg = parseFloat(wForm.kg)
    if (!kg || kg <= 0) { setWError('Enter a valid weight'); return }
    setWSaving(true)
    try {
      const log = await addWeightLog(animal.id, wForm.date, kg, wForm.notes)
      setHistory(h => [log, ...h])
      setWForm({ date: format(new Date(), 'yyyy-MM-dd'), kg: '', notes: '' })
      setAddingW(false)
    } catch (e) {
      setWError(e.message || 'Save failed')
    } finally {
      setWSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-mono font-bold text-green-primary text-lg leading-none">{f['Ear Tag']}</p>
            <p className="text-xs text-gray-500 mt-0.5">{groupName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[f['Status']] || 'bg-gray-100 text-gray-600'}`}>
              {f['Status'] || 'Unknown'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-light">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Breed',           f['Breed']],
              ['Breeding Class',  f['Breeding Class']],
              ['Foundation',      f['Foundation Breed']],
              ['Breed Improver',  f['Breed Improver']],
              ['Gender',          f['Gender']],
              ['Date of Birth',   f['Date of Birth'] || (f['Birth Year'] ? String(f['Birth Year']) : null)],
              ['Sire (Father)',   f['Sire']],
              ['Dam (Mother)',    f['Dam']],
              ['Source',          f['Source']],
              ['Breeder',         f['Breeder']],
              ['Comments',        f['Comments']],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-800 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Weight history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Weight History</h3>
              {canAddWeight && !addingW && (
                <button onClick={() => setAddingW(true)}
                  className="text-xs text-green-primary font-medium hover:text-green-deep">
                  + Log Weight
                </button>
              )}
            </div>

            {addingW && (
              <div className="border border-green-mid/30 rounded-lg p-3 mb-3 space-y-2 bg-green-50/40">
                {wError && <p className="text-red-600 text-xs">{wError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date</label>
                    <input type="date" value={wForm.date}
                      onChange={e => setWForm(w => ({ ...w, date: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Weight (kg)</label>
                    <input type="number" value={wForm.kg} min="0" step="0.1"
                      onChange={e => setWForm(w => ({ ...w, kg: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                      placeholder="e.g. 42.5" />
                  </div>
                </div>
                <input type="text" value={wForm.notes}
                  onChange={e => setWForm(w => ({ ...w, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
                <div className="flex gap-2">
                  <button onClick={handleAddWeight} disabled={wSaving}
                    className="px-3 py-1.5 bg-green-primary text-white text-xs rounded font-medium hover:bg-green-deep disabled:opacity-60">
                    {wSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setAddingW(false); setWError('') }}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingH ? (
              <p className="text-xs text-gray-400">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No weight records yet.</p>
            ) : (
              <div className="space-y-1">
                {history.map((log, i) => (
                  <div key={log.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-green-50 border border-green-mid/20' : 'bg-gray-50'}`}>
                    <div>
                      <span className="font-semibold text-green-primary">{log.fields['Weight kg']} kg</span>
                      {log.fields['Notes'] && <span className="ml-2 text-xs text-gray-400">{log.fields['Notes']}</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{log.fields['Weigh Date']}</p>
                      {i === 0 && <p className="text-xs text-green-600 font-medium">Latest</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {f['Notes'] && (
            <div className="bg-amber-pale/40 border border-amber/20 rounded-lg px-3 py-2 text-xs text-gray-600">
              <span className="font-semibold text-amber">Notes: </span>{f['Notes']}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnimalBrowser({ group, canAddWeight = false }) {
  const [animals, setAnimals]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    if (!group?.id) return
    setLoading(true)
    getAnimalsByGroup(group.id)
      .then(setAnimals)
      .catch(() => setAnimals([]))
      .finally(() => setLoading(false))
  }, [group?.id])

  const groupName = group?.fields?.['Group Name'] || ''
  const filtered  = animals.filter(a => {
    const q = search.toLowerCase()
    return !q
      || (a.fields['Ear Tag'] || '').toLowerCase().includes(q)
      || (a.fields['Breed']   || '').toLowerCase().includes(q)
      || (a.fields['Gender']  || '').toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-green-primary">{groupName}</span>
          <span className="text-xs text-gray-400">({animals.length} animals)</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by tag, breed or gender…"
          className="mt-2 w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
        />
      </div>

      {/* Animal list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center italic">No animals found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-100">
              <tr className="text-xs text-gray-500 uppercase tracking-wide text-left">
                <th className="px-4 py-2">Ear Tag</th>
                <th className="px-4 py-2">Breed</th>
                <th className="px-4 py-2">Sex</th>
                <th className="px-4 py-2">Weight</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="border-t border-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-green-primary">{a.fields['Ear Tag']}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.fields['Breed'] || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.fields['Gender'] || '—'}</td>
                  <td className="px-4 py-2.5">
                    {a.fields['Current Weight kg']
                      ? <span className="font-medium">{a.fields['Current Weight kg']} kg</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.fields['Status']] || 'bg-gray-100 text-gray-600'}`}>
                      {a.fields['Status'] || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <AnimalDetailDrawer
          animal={selected}
          groupName={groupName}
          onClose={() => setSelected(null)}
          canAddWeight={canAddWeight}
        />
      )}
    </div>
  )
}

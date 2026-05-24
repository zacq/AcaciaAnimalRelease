import GrazingGroundInput from './GrazingGroundInput'

const SICK_GROUP = 'Sick/Vulnerable Flock'

export default function GroupTallyRow({ session, groupName, staffOptions, onChange, variant = 'row' }) {
  const fields = session?.fields || {}
  const isSick = groupName === SICK_GROUP

  function set(key, val) {
    onChange(session.id, { [key]: val })
  }

  if (variant === 'card') {
    const variance = fields['PM Count'] != null && fields['AM Count'] != null
      ? fields['PM Count'] - fields['AM Count']
      : null

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm text-gray-900">{groupName}</p>
          {variance != null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              variance < 0 ? 'bg-red-100 text-red-600' :
              variance === 0 ? 'bg-green-100 text-green-600' :
              'bg-amber-pale text-amber'
            }`}>
              {variance > 0 ? '+' : ''}{variance}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Herdsman</label>
            <select
              value={fields['Herdsman']?.[0] || ''}
              onChange={(e) => set('Herdsman', e.target.value ? [e.target.value] : [])}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid"
            >
              <option value="">— Select —</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.fields['Name']}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">AM Count</label>
            <input
              type="number"
              min={0}
              value={fields['AM Count'] ?? ''}
              onChange={(e) => set('AM Count', e.target.value === '' ? null : Number(e.target.value))}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-mid"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Grazing ground</label>
          <GrazingGroundInput
            value={fields['Grazing Ground'] || ''}
            onChange={(v) => set('Grazing Ground', v)}
            locked={isSick}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Remarks</label>
          <input
            type="text"
            value={fields['Notes'] || ''}
            onChange={(e) => set('Notes', e.target.value)}
            placeholder="Optional…"
            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
          />
        </div>
      </div>
    )
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{groupName}</td>

      <td className="px-3 py-3">
        <select
          value={fields['Herdsman']?.[0] || ''}
          onChange={(e) => set('Herdsman', e.target.value ? [e.target.value] : [])}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
        >
          <option value="">— Select —</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.fields['Name']}</option>
          ))}
        </select>
      </td>

      <td className="px-3 py-3 min-w-[160px]">
        <GrazingGroundInput
          value={fields['Grazing Ground'] || ''}
          onChange={(v) => set('Grazing Ground', v)}
          locked={isSick}
        />
      </td>

      <td className="px-3 py-3 w-24">
        <input
          type="number"
          min={0}
          value={fields['AM Count'] ?? ''}
          onChange={(e) => set('AM Count', e.target.value === '' ? null : Number(e.target.value))}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-mid"
          placeholder="0"
        />
      </td>

      <td className="px-3 py-3 w-20 text-center text-sm text-gray-400 italic">
        {fields['PM Count'] != null && fields['AM Count'] != null
          ? <span className={fields['PM Count'] < fields['AM Count'] ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
              {fields['PM Count'] - fields['AM Count']}
            </span>
          : '—'}
      </td>

      <td className="px-3 py-3">
        <input
          type="text"
          value={fields['Notes'] || ''}
          onChange={(e) => set('Notes', e.target.value)}
          placeholder="Optional…"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
        />
      </td>
    </tr>
  )
}

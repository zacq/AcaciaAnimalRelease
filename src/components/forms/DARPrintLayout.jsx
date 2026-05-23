import { forwardRef } from 'react'
import { format } from 'date-fns'

const DARPrintLayout = forwardRef(function DARPrintLayout({ sessions, groups, movements, date }, ref) {
  const dateLabel = date ? format(new Date(date), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy')
  const formNo = `DAR-${date ? format(new Date(date), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd')}`

  const GROUP_ORDER = [
    'Annex Farm', 'Main Farm', 'Horsefield',
    'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males', 'Sick/Vulnerable Flock',
  ]

  const sortedSessions = GROUP_ORDER.map((name) => {
    const group = groups.find((g) => g.fields['Group Name'] === name)
    return { name, session: sessions.find((s) => s.fields['Group']?.[0] === group?.id) }
  })

  const allMovements = sessions.flatMap((s) => movements[s.id] || [])

  return (
    <div ref={ref} className="bg-white p-8 font-sans text-sm" style={{ width: '210mm', minHeight: '297mm' }}>
      {/* Header */}
      <div className="border-b-4 border-green-800 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AV</div>
              <div>
                <h1 className="text-lg font-bold text-green-900">AcaciaVelds Livestock Breeders Ltd</h1>
                <p className="text-xs text-gray-500 italic">"Breeding for Generations"</p>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p className="font-bold text-base text-green-900">DAILY ANIMAL REGISTER</p>
            <p>Form No: <strong>{formNo}</strong></p>
            <p>DAR-001 v2.0 — Digital Edition</p>
            <p>Date: <strong>{dateLabel}</strong></p>
          </div>
        </div>
      </div>

      {/* Section 1 */}
      <div className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-green-900 border-b border-gray-300 pb-1 mb-2">Section 1 — Session Information</h2>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div><span className="text-gray-500">AM Departure:</span> <strong>{sessions[0]?.fields['AM Departure Time'] || '—'}</strong></div>
          <div><span className="text-gray-500">PM Return:</span> <strong>{sessions[0]?.fields['PM Return Time'] || '—'}</strong></div>
          <div><span className="text-gray-500">Weather:</span> {sessions[0]?.fields['Weather'] || '—'}</div>
        </div>
      </div>

      {/* Section 3 — Group Tally */}
      <div className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-green-900 border-b border-gray-300 pb-1 mb-2">Section 3 — Group Tally</h2>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Group</th>
              <th className="border border-gray-300 px-2 py-1">Grazing Ground</th>
              <th className="border border-gray-300 px-2 py-1 text-center">AM</th>
              <th className="border border-gray-300 px-2 py-1 text-center">Out</th>
              <th className="border border-gray-300 px-2 py-1 text-center">In</th>
              <th className="border border-gray-300 px-2 py-1 text-center">PM</th>
              <th className="border border-gray-300 px-2 py-1 text-center">VAR</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.map(({ name, session: sess }) => {
              const moves = sess ? (movements[sess.id] || []) : []
              const movedOut = moves.filter((m) => m.fields['Count Impact'] === 'Out (−1)').length
              const movedIn = moves.filter((m) => m.fields['Count Impact'] === 'In (+1)').length
              const am = sess?.fields['AM Count'] ?? 0
              const pm = sess?.fields['PM Count'] ?? null
              const variance = pm != null ? pm - am : null
              return (
                <tr key={name}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{name}</td>
                  <td className="border border-gray-300 px-2 py-1">{sess?.fields['Grazing Ground'] || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{am}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{movedOut || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{movedIn || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{pm ?? '—'}</td>
                  <td className={`border border-gray-300 px-2 py-1 text-center font-bold ${variance != null && variance < 0 ? 'text-red-700' : ''}`}>
                    {variance != null ? (variance > 0 ? '+' : '') + variance : '—'}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-gray-100 font-bold">
              <td className="border border-gray-300 px-2 py-1" colSpan={2}>Grand Total</td>
              <td className="border border-gray-300 px-2 py-1 text-center">
                {sortedSessions.reduce((s, { session }) => s + (session?.fields['AM Count'] || 0), 0)}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center">—</td>
              <td className="border border-gray-300 px-2 py-1 text-center">—</td>
              <td className="border border-gray-300 px-2 py-1 text-center">
                {sessions.every((s) => s.fields['PM Count'] != null)
                  ? sessions.reduce((s, sess) => s + (sess.fields['PM Count'] || 0), 0)
                  : '—'}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-center">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 4 — Movements */}
      {allMovements.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-green-900 border-b border-gray-300 pb-1 mb-2">Section 4 — Animal Movements</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Ear Tag</th>
                <th className="border border-gray-300 px-2 py-1">From</th>
                <th className="border border-gray-300 px-2 py-1">To</th>
                <th className="border border-gray-300 px-2 py-1">Time</th>
                <th className="border border-gray-300 px-2 py-1">Reason</th>
                <th className="border border-gray-300 px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {allMovements.map((m) => (
                <tr key={m.id}>
                  <td className="border border-gray-300 px-2 py-1 font-mono">{m.fields['Ear Tag']}</td>
                  <td className="border border-gray-300 px-2 py-1">{m.fields['From Group']?.[0] || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{m.fields['To Group']?.[0] || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{m.fields['Time'] || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{m.fields['Reason']}</td>
                  <td className="border border-gray-300 px-2 py-1">{m.fields['Health/Condition Notes'] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Declaration */}
      <div className="mt-8 border-t-2 border-gray-300 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-green-900 mb-3">Declaration & Verification</h2>
        <div className="grid grid-cols-3 gap-6 text-xs">
          {['Counting Supervisor', 'Herdsman-in-Charge', 'Independent Witness'].map((role) => (
            <div key={role}>
              <p className="text-gray-500 mb-1">{role}</p>
              <div className="border-b border-gray-400 h-6 mb-1"></div>
              <p className="text-gray-400">Signature & Date</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          AcaciaVelds Livestock Breeders Ltd · Form DAR-001 Digital · Confidential — Farm Use Only
        </p>
      </div>
    </div>
  )
})

export default DARPrintLayout

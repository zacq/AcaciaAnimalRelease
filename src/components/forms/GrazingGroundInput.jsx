import { useState, useEffect, useRef } from 'react'
import { getGrazingGroundHistory } from '../../api/grazingGroundsService'

export default function GrazingGroundInput({ value, onChange, locked }) {
  const [suggestions, setSuggestions] = useState([])
  const [filtered, setFiltered] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    getGrazingGroundHistory().then(setSuggestions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!value) { setFiltered([]); return }
    setFiltered(suggestions.filter((s) => s && s.toLowerCase().includes(value.toLowerCase())).slice(0, 6))
  }, [value, suggestions])

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (locked) {
    return (
      <input
        type="text"
        value="Enclosure (N/A)"
        disabled
        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
      />
    )
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Enter grazing ground…"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-mid text-sm"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto">
          {filtered.map((s) => (
            <li
              key={s}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-green-50 hover:text-green-primary"
              onMouseDown={() => { onChange(s); setOpen(false) }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

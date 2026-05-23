import { useState, useEffect } from 'react'
import { getAllStaff, createStaff, updateStaff } from '../../api/staffService'
import { getAllGroups, updateGroupHerdsman } from '../../api/groupsService'
import { getAllAnimals, createAnimal, updateAnimal } from '../../api/registryService'
import { hashPassword } from '../../utils/auth'
import { useAuth } from '../../auth/AuthContext'
import AppShell from '../../components/layout/AppShell'

const TABS = ['Staff', 'Groups', 'Animal Registry', 'Alert Config']

const ROLES = ['Supervisor', 'Herdsman', 'Farm Manager']
const ANIMAL_STATUSES = ['Active', 'Sold', 'Deceased', 'Born (pending tag)']

export default function SettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Staff')

  // Staff
  const [staff, setStaff] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Herdsman', employeeId: '', phone: '', username: '', password: '' })
  const [staffError, setStaffError] = useState('')

  // Groups
  const [groups, setGroups] = useState([])
  const [groupHerdsmen, setGroupHerdsmen] = useState({})

  // Animals
  const [animals, setAnimals] = useState([])
  const [animalLoading, setAnimalLoading] = useState(false)
  const [newAnimal, setNewAnimal] = useState({ earTag: '', groupId: '', status: 'Active' })
  const [animalError, setAnimalError] = useState('')

  // Alert config
  const [varianceThreshold, setVarianceThreshold] = useState(-1)

  const canManageStaff = user.role === 'Supervisor' || user.role === 'Farm Manager'

  useEffect(() => {
    if (tab === 'Staff') {
      setStaffLoading(true)
      getAllStaff().then(setStaff).catch(console.error).finally(() => setStaffLoading(false))
    }
    if (tab === 'Groups') {
      Promise.all([getAllGroups(), getAllStaff('Herdsman')]).then(([grps, hrds]) => {
        setGroups(grps)
        const map = {}
        grps.forEach((g) => { map[g.id] = g.fields['Primary Herdsman']?.[0] || '' })
        setGroupHerdsmen(map)
        setStaff(hrds)
      })
    }
    if (tab === 'Animal Registry') {
      setAnimalLoading(true)
      Promise.all([getAllAnimals(), getAllGroups()]).then(([animals, grps]) => {
        setAnimals(animals)
        setGroups(grps)
      }).catch(console.error).finally(() => setAnimalLoading(false))
    }
  }, [tab])

  async function handleAddStaff() {
    setStaffError('')
    const { name, role, employeeId, username, password } = newStaff
    if (!name || !role || !username || !password) { setStaffError('Name, role, username and password are required'); return }
    try {
      const created = await createStaff({
        Name: name,
        Role: role,
        'Employee ID': employeeId,
        Phone: newStaff.phone,
        Username: username,
        'Password Hash': hashPassword(password),
        Active: true,
      })
      setStaff((s) => [...s, created])
      setNewStaff({ name: '', role: 'Herdsman', employeeId: '', phone: '', username: '', password: '' })
    } catch (err) {
      setStaffError(err.message || 'Failed to create staff')
    }
  }

  async function handleToggleActive(staffRecord) {
    const updated = await updateStaff(staffRecord.id, { Active: !staffRecord.fields['Active'] })
    setStaff((s) => s.map((m) => m.id === staffRecord.id ? { ...m, fields: { ...m.fields, Active: updated.fields['Active'] } } : m))
  }

  async function handleGroupHerdsmanSave(groupId) {
    await updateGroupHerdsman(groupId, groupHerdsmen[groupId])
  }

  async function handleAddAnimal() {
    setAnimalError('')
    const { earTag, groupId, status } = newAnimal
    if (!earTag) { setAnimalError('Ear tag is required'); return }
    try {
      const created = await createAnimal({
        'Ear Tag': earTag,
        Group: groupId ? [groupId] : undefined,
        Status: status,
        'Date Added': new Date().toISOString().split('T')[0],
      })
      setAnimals((a) => [...a, created])
      setNewAnimal({ earTag: '', groupId: '', status: 'Active' })
    } catch (err) {
      setAnimalError(err.message || 'Failed to create record')
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-green-primary">Settings</h1>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Staff Tab */}
        {tab === 'Staff' && (
          <div className="space-y-5">
            {canManageStaff && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">Add Staff Member</h2>
                {staffError && <p className="text-red-600 text-sm mb-3">{staffError}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[['name', 'Full Name'], ['employeeId', 'Employee ID'], ['phone', 'Phone']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input type="text" value={newStaff[key]} onChange={(e) => setNewStaff((s) => ({ ...s, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Role</label>
                    <select value={newStaff.role} onChange={(e) => setNewStaff((s) => ({ ...s, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Username</label>
                    <input type="text" value={newStaff.username} onChange={(e) => setNewStaff((s) => ({ ...s, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Password</label>
                    <input type="password" value={newStaff.password} onChange={(e) => setNewStaff((s) => ({ ...s, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid" />
                  </div>
                </div>
                <button onClick={handleAddStaff}
                  className="mt-4 px-5 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep transition-colors">
                  Add Staff Member
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {staffLoading ? <p className="px-6 py-8 text-center text-gray-500">Loading…</p> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Employee ID</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3 text-center">Active</th>
                      {canManageStaff && <th className="px-4 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-t border-gray-50">
                        <td className="px-4 py-3 font-medium">{s.fields['Name']}</td>
                        <td className="px-4 py-3 text-gray-600">{s.fields['Role']}</td>
                        <td className="px-4 py-3 text-gray-500">{s.fields['Employee ID'] || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.fields['Username']}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${s.fields['Active'] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.fields['Active'] ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {canManageStaff && (
                          <td className="px-4 py-3">
                            <button onClick={() => handleToggleActive(s)}
                              className="text-xs text-gray-500 hover:text-green-primary">
                              {s.fields['Active'] ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {tab === 'Groups' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Primary Herdsman</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-gray-50">
                    <td className="px-4 py-3 font-medium">{g.fields['Group Name']}</td>
                    <td className="px-4 py-3 text-gray-500">{g.fields['Type']}</td>
                    <td className="px-4 py-3">
                      <select
                        value={groupHerdsmen[g.id] || ''}
                        onChange={(e) => setGroupHerdsmen((m) => ({ ...m, [g.id]: e.target.value }))}
                        className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                      >
                        <option value="">— None —</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.fields['Name']}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleGroupHerdsmanSave(g.id)}
                        className="text-xs text-green-primary hover:text-green-deep font-medium">Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Animal Registry Tab */}
        {tab === 'Animal Registry' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Add Animal Record</h2>
              {animalError && <p className="text-red-600 text-sm mb-3">{animalError}</p>}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ear Tag *</label>
                  <input type="text" value={newAnimal.earTag} onChange={(e) => setNewAnimal((a) => ({ ...a, earTag: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid w-36" placeholder="AV-0000" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Group</label>
                  <select value={newAnimal.groupId} onChange={(e) => setNewAnimal((a) => ({ ...a, groupId: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                    <option value="">— Select —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.fields['Group Name']}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Status</label>
                  <select value={newAnimal.status} onChange={(e) => setNewAnimal((a) => ({ ...a, status: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid">
                    {ANIMAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={handleAddAnimal}
                  className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep transition-colors">
                  Add
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {animalLoading ? <p className="px-6 py-8 text-center text-gray-500">Loading…</p> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="px-4 py-3">Ear Tag</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animals.slice(0, 100).map((a) => (
                      <tr key={a.id} className="border-t border-gray-50">
                        <td className="px-4 py-3 font-mono font-medium">{a.fields['Ear Tag']}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.fields['Status'] === 'Active' ? 'bg-green-100 text-green-700' :
                            a.fields['Status'] === 'Deceased' ? 'bg-red-100 text-red-700' :
                            a.fields['Status'] === 'Sold' ? 'bg-gray-100 text-gray-600' :
                            'bg-amber-pale text-amber'
                          }`}>{a.fields['Status']}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{a.fields['Date Added'] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Alert Config Tab */}
        {tab === 'Alert Config' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Alert Configuration</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amber alert variance threshold
              </label>
              <p className="text-xs text-gray-500 mb-3">
                An amber alert fires when a group variance is at or below this value. Default is −1 (any missing animal).
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  max={0}
                  value={varianceThreshold}
                  onChange={(e) => setVarianceThreshold(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-mid text-center"
                />
                <button
                  onClick={() => alert('Threshold saved: ' + varianceThreshold)}
                  className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

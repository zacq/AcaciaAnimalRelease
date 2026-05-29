import { useState, useEffect } from 'react'
import { getAllStaff, createStaff, updateStaff } from '../../api/staffService'
import { getAllGroups, updateGroupHerdsman } from '../../api/groupsService'
import { getAllAnimals, createAnimal } from '../../api/registryService'
import AnimalBrowser from '../../components/animals/AnimalBrowser'
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
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Groups
  const [groups, setGroups] = useState([])
  const [groupHerdsmen, setGroupHerdsmen] = useState({})

  // Animals
  const [animals, setAnimals] = useState([])
  const [animalLoading, setAnimalLoading] = useState(false)
  const [newAnimal, setNewAnimal] = useState({ earTag: '', groupId: '', status: 'Active' })
  const [animalError, setAnimalError] = useState('')
  const [animalBrowseGroupId, setAnimalBrowseGroupId] = useState('')

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

  function startEdit(s) {
    setEditingId(s.id)
    setEditError('')
    setEditDraft({
      name:       s.fields['Name'] || '',
      role:       s.fields['Role'] || 'Herdsman',
      employeeId: s.fields['Employee ID'] || '',
      phone:      s.fields['Phone'] || '',
      username:   s.fields['Username'] || '',
      newPassword: '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
    setEditError('')
  }

  async function saveEdit(id) {
    setEditError('')
    if (!editDraft.name || !editDraft.username) { setEditError('Name and username are required'); return }
    setEditSaving(true)
    try {
      const fields = {
        Name:          editDraft.name,
        Role:          editDraft.role,
        'Employee ID': editDraft.employeeId,
        Phone:         editDraft.phone,
        Username:      editDraft.username,
      }
      if (editDraft.newPassword) fields['Password Hash'] = hashPassword(editDraft.newPassword)
      const updated = await updateStaff(id, fields)
      setStaff((s) => s.map((m) => m.id === id ? { ...m, fields: { ...m.fields, ...updated.fields } } : m))
      setEditingId(null)
    } catch (err) {
      setEditError(err.message || 'Save failed')
    } finally {
      setEditSaving(false)
    }
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
                    {staff.map((s) => {
                      const isEditing = editingId === s.id
                      if (isEditing) {
                        return (
                          <tr key={s.id} className="border-t border-green-primary/20 bg-green-50/40">
                            <td colSpan={canManageStaff ? 6 : 5} className="px-4 py-4">
                              {editError && <p className="text-red-600 text-xs mb-3">{editError}</p>}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                                {[['name','Full Name'],['employeeId','Employee ID'],['phone','Phone']].map(([k, lbl]) => (
                                  <div key={k}>
                                    <label className="text-xs text-gray-500 mb-1 block">{lbl}</label>
                                    <input
                                      type="text"
                                      value={editDraft[k]}
                                      onChange={(e) => setEditDraft((d) => ({ ...d, [k]: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                                    />
                                  </div>
                                ))}
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">Role</label>
                                  <select
                                    value={editDraft.role}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                                  >
                                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">Username</label>
                                  <input
                                    type="text"
                                    value={editDraft.username}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, username: e.target.value }))}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">New Password <span className="text-gray-400">(leave blank to keep)</span></label>
                                  <input
                                    type="password"
                                    value={editDraft.newPassword}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, newPassword: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(s.id)}
                                  disabled={editSaving}
                                  className="px-4 py-1.5 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-deep disabled:opacity-60 transition-colors"
                                >
                                  {editSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      return (
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
                              <div className="flex items-center gap-3 justify-end">
                                <button
                                  onClick={() => startEdit(s)}
                                  className="text-xs text-green-primary hover:text-green-deep font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleActive(s)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  {s.fields['Active'] ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
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
            {/* Quick-add form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Add New Animal</h2>
              {animalError && <p className="text-red-600 text-sm mb-3">{animalError}</p>}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ear Tag *</label>
                  <input type="text" value={newAnimal.earTag} onChange={(e) => setNewAnimal((a) => ({ ...a, earTag: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid w-36" placeholder="e.g. 064G" />
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

            {/* Group browser */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Browse by group:</label>
                <select
                  value={animalBrowseGroupId}
                  onChange={(e) => setAnimalBrowseGroupId(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-mid"
                >
                  <option value="">— Select a group —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.fields['Group Name']}</option>)}
                </select>
              </div>
              {animalBrowseGroupId ? (
                <div style={{ height: '55vh' }}>
                  <AnimalBrowser
                    group={groups.find(g => g.id === animalBrowseGroupId)}
                    canAddWeight={true}
                  />
                </div>
              ) : (
                <p className="px-6 py-10 text-center text-sm text-gray-400 italic">Select a group to view its animals.</p>
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

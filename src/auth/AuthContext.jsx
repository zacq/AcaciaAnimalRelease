import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getStaffByUsername } from '../api/staffService'
import { saveSession, loadSession, clearSession, touchSession, hashPassword } from '../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = loadSession()
    if (session) setUser(session.user)
    setLoading(false)
  }, [])

  // Reset inactivity timer on any interaction
  useEffect(() => {
    const touch = () => touchSession()
    window.addEventListener('mousemove', touch)
    window.addEventListener('keydown', touch)
    window.addEventListener('touchstart', touch)
    return () => {
      window.removeEventListener('mousemove', touch)
      window.removeEventListener('keydown', touch)
      window.removeEventListener('touchstart', touch)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const record = await getStaffByUsername(username.trim())
    if (!record) throw new Error('Invalid username or password')

    const { fields } = record
    if (!fields['Active']) throw new Error('Account is deactivated')

    const hashed = hashPassword(password)
    if (fields['Password Hash'] !== hashed) throw new Error('Invalid username or password')

    const userData = {
      id: record.id,
      name: fields['Name'],
      role: fields['Role'],
      employeeId: fields['Employee ID'],
      phone: fields['Phone'] || '',
      username: fields['Username'],
    }

    saveSession(userData)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

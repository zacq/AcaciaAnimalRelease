import { useAuth } from '../../auth/AuthContext'
import { useNavigate } from 'react-router-dom'

const ROLE_LABEL = {
  Supervisor: 'Supervisor',
  Herdsman: 'Herdsman',
  'Farm Manager': 'Farm Manager',
}

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-green-primary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber flex items-center justify-center flex-shrink-0">
            <span className="text-green-primary font-bold text-xs">AV</span>
          </div>
          <div className="leading-tight">
            <span className="font-semibold text-sm">AcaciaVelds</span>
            <span className="text-green-light text-xs ml-2 hidden sm:inline">DAR-001</span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-green-light text-xs mt-0.5">{ROLE_LABEL[user.role]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-green-light hover:text-white border border-green-mid hover:border-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

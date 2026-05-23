import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const supervisorLinks = [
  { to: '/dashboard', label: 'AM Session' },
  { to: '/pm', label: 'PM Session' },
  { to: '/map', label: 'Live Map' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

const managerLinks = [
  { to: '/manager', label: 'Overview' },
  { to: '/map', label: 'Live Map' },
  { to: '/history', label: 'History' },
]

const herdsmanLinks = [
  { to: '/field', label: 'My Group' },
]

const linksByRole = {
  Supervisor: supervisorLinks,
  'Farm Manager': managerLinks,
  Herdsman: herdsmanLinks,
}

export default function NavBar() {
  const { user } = useAuth()
  if (!user) return null

  const links = linksByRole[user.role] || []

  return (
    <nav className="hidden md:flex flex-col w-48 bg-white border-r border-gray-200 pt-4 flex-shrink-0">
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium transition-colors border-l-2 ${
              isActive
                ? 'border-green-primary text-green-primary bg-green-50'
                : 'border-transparent text-gray-600 hover:text-green-primary hover:bg-gray-50'
            }`
          }
        >
          {label}
        </NavLink>
      ))}

      {/* Mobile bottom nav (shown on small screens separately) */}
    </nav>
  )
}

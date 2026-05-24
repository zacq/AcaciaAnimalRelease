import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const supervisorLinks = [
  { to: '/dashboard', label: 'AM Session', short: 'AM' },
  { to: '/pm',        label: 'PM Session', short: 'PM' },
  { to: '/map',       label: 'Live Map',   short: 'Map' },
  { to: '/history',   label: 'History',    short: 'History' },
  { to: '/settings',  label: 'Settings',   short: 'Settings' },
]

const managerLinks = [
  { to: '/manager', label: 'Overview', short: 'Overview' },
  { to: '/map',     label: 'Live Map', short: 'Map' },
  { to: '/history', label: 'History',  short: 'History' },
]

const herdsmanLinks = [
  { to: '/field', label: 'My Group', short: 'My Group' },
]

const linksByRole = {
  Supervisor: supervisorLinks,
  'Farm Manager': managerLinks,
  Herdsman: herdsmanLinks,
}

const NavIcon = ({ path }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mb-0.5">
    <path d={path} />
  </svg>
)

const icons = {
  '/dashboard': 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  '/pm':        'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  '/map':       'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  '/history':   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  '/settings':  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  '/manager':   'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  '/field':     'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
}

export default function NavBar() {
  const { user } = useAuth()
  if (!user) return null

  const links = linksByRole[user.role] || []

  return (
    <>
      {/* Desktop sidebar */}
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
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex safe-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {links.map(({ to, short }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors min-w-0 ${
                isActive
                  ? 'text-green-primary'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon path={icons[to]} />
                <span className={`leading-none truncate w-full text-center ${isActive ? 'text-green-primary' : ''}`}>
                  {short}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

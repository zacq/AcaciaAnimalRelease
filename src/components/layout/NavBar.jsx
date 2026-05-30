import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const GROUP_ORDER = [
  'Annex Farm', 'Main Farm', 'Horsefield',
  'Paddock - Mothers', 'Paddock - Kids', 'Paddock - Males',
  'Sick/Vulnerable Flock',
]

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
}

// SVG path strings
const IC = {
  dashboard: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
  map:       'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  history:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  settings:  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  sun:       'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon:      'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  person:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
}

const supervisorLinks = [
  { to: '/dashboard', label: 'AM Session', icon: IC.sun,      subItems: GROUP_ORDER, subItemMode: 'page' },
  { to: '/pm',        label: 'PM Session', icon: IC.moon      },
  { to: '/map',       label: 'Live Map',   icon: IC.map       },
  { to: '/history',   label: 'History',    icon: IC.history   },
  { to: '/settings',  label: 'Settings',   icon: IC.settings  },
]

const FARMS = [
  'Acacia Hill Estate',
  'Acacia Ridge Farm',
  'Acacia Springs Farm',
  'Acacia Tumaini Farm',
]

const managerLinks = [
  { to: '/manager', label: 'Animal Groups',  icon: IC.dashboard, subItems: GROUP_ORDER, subItemMode: 'page', subItemBasePath: '/group' },
  { to: '/status',  label: 'Pasture Fields', icon: IC.map,       subItems: FARMS,       subItemMode: 'page', subItemBasePath: '/farm'  },
  { to: '/history', label: 'History',     icon: IC.history   },
]

const herdsmanLinks = [
  { to: '/field', label: 'My Group', icon: IC.person },
]

const linksByRole = {
  Supervisor:    supervisorLinks,
  'Farm Manager': managerLinks,
  Herdsman:      herdsmanLinks,
}

function SvgIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
      <path d={path} />
    </svg>
  )
}

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()

  if (!user) return null

  const links    = linksByRole[user.role] || []
  const initials = (user.name || '?').slice(0, 2).toUpperCase()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function goToSubItem(link, itemName) {
    if (link.subItemMode === 'page') {
      navigate(`${link.subItemBasePath || '/group'}/${slugify(itemName)}`)
    } else {
      navigate(`${link.to}#${slugify(itemName)}`)
    }
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <nav className="hidden md:flex group flex-col bg-green-primary flex-shrink-0
                      w-14 hover:w-60 transition-[width] duration-200 ease-in-out
                      overflow-hidden sticky top-0 h-screen z-30">

        {/* Logo */}
        <div className="flex items-center gap-3 h-14 px-3.5 border-b border-white/10 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-amber flex items-center justify-center flex-shrink-0">
            <span className="text-green-primary font-bold text-[10px]">AV</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap">
            <p className="text-white font-semibold text-sm leading-none">AcaciaVelds</p>
            <p className="text-white/50 text-[10px] mt-0.5">DAR-001</p>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {links.map((link) => {
            const isActive  = location.pathname === link.to ||
              (link.subItemBasePath && location.pathname.startsWith(link.subItemBasePath + '/'))
            const hasGroups = !!link.subItems

            return (
              <div key={link.to}>
                <NavLink
                  to={link.to}
                  className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <SvgIcon path={link.icon} />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap text-sm font-medium">
                    {link.label}
                  </span>
                  {hasGroups && (
                    <svg viewBox="0 0 16 16" fill="currentColor"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 w-3 h-3 ml-auto flex-shrink-0">
                      <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  )}
                </NavLink>

                {/* Group sub-items — shown when Overview is active + sidebar expanded */}
                {hasGroups && (
                  <div className={`transition-all duration-150 overflow-hidden ${
                    isActive ? 'max-h-96' : 'max-h-0'
                  } opacity-0 group-hover:opacity-100 delay-75`}>
                    <div className="ml-9 border-l border-white/15 pl-3 py-1 space-y-0.5">
                      {link.subItems.map((groupName) => {
                        const slug      = slugify(groupName)
                        const isGroupActive = location.hash === `#${slug}`
                        return (
                          <button
                            key={groupName}
                            onClick={() => goToSubItem(link, groupName)}
                            className={`w-full text-left py-1.5 px-2 text-xs whitespace-nowrap rounded transition-colors ${
                              isGroupActive
                                ? 'text-amber font-semibold'
                                : 'text-white/50 hover:text-white/85'
                            }`}
                          >
                            {groupName}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* User + sign out */}
        <div className="border-t border-white/10 p-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-green-deep flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold border border-white/20">
            {initials}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 flex-1 min-w-0 whitespace-nowrap overflow-hidden">
            <p className="text-white text-xs font-medium truncate">{user.name}</p>
            <p className="text-white/50 text-[10px]">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75 text-white/50 hover:text-white text-xs flex-shrink-0 transition-colors"
          >
            Sign&nbsp;out
          </button>
        </div>
      </nav>

      {/* ── Mobile compact top bar ───────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-green-primary h-10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-amber flex items-center justify-center">
            <span className="text-green-primary font-bold text-[9px]">AV</span>
          </div>
          <span className="text-white font-semibold text-sm">AcaciaVelds</span>
        </div>
        <button onClick={handleLogout} className="text-white/70 text-xs hover:text-white transition-colors">
          Sign out
        </button>
      </div>

      {/* ── Mobile bottom tab bar ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors min-w-0 ${
                isActive ? 'text-green-primary' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mb-0.5">
                  <path d={icon} />
                </svg>
                <span className={`leading-none truncate w-full text-center ${isActive ? 'text-green-primary' : ''}`}>
                  {label.split(' ')[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

import NavBar from './NavBar'
import AlertBanner from '../common/AlertBanner'
import { useAlertStore } from '../../store/alertStore'

export default function AppShell({ children }) {
  const bannerAlerts = useAlertStore((s) => s.bannerAlerts)

  return (
    <div className="flex h-screen overflow-hidden bg-off-white">
      <NavBar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {bannerAlerts.length > 0 && <AlertBanner alerts={bannerAlerts} />}
        {/* pt-10 = mobile top bar offset (h-10); pb-24 = mobile tab bar offset */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-14 md:pt-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}

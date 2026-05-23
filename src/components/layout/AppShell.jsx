import Header from './Header'
import NavBar from './NavBar'
import AlertBanner from '../common/AlertBanner'
import { useAlertStore } from '../../store/alertStore'

export default function AppShell({ children }) {
  const bannerAlerts = useAlertStore((s) => s.bannerAlerts)

  return (
    <div className="min-h-screen flex flex-col bg-off-white">
      <Header />
      {bannerAlerts.length > 0 && <AlertBanner alerts={bannerAlerts} />}
      <div className="flex flex-1">
        <NavBar />
        <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

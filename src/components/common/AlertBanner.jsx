import { useAlertStore } from '../../store/alertStore'

const COLOUR = {
  red: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  yellow: 'bg-yellow-400 text-gray-900',
}

export default function AlertBanner({ alerts }) {
  const dismiss = useAlertStore((s) => s.dismissBannerAlert)

  return (
    <div className="space-y-0">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${COLOUR[alert.colour] || COLOUR.red}`}
        >
          <span>{alert.message}</span>
          <button
            onClick={() => dismiss(alert.id)}
            className="ml-4 opacity-70 hover:opacity-100 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard'
import PMSessionPage from './pages/supervisor/PMSessionPage'
import LiveMapPage from './pages/supervisor/LiveMapPage'
import FieldViewPage from './pages/herdsman/FieldViewPage'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/settings/SettingsPage'

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-700">Access denied</p>
        <p className="text-gray-500 text-sm mt-1">You don't have permission to view this page.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Supervisor routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['Supervisor']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/pm" element={
            <ProtectedRoute allowedRoles={['Supervisor']}>
              <PMSessionPage />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute allowedRoles={['Supervisor', 'Farm Manager']}>
              <LiveMapPage />
            </ProtectedRoute>
          } />

          {/* Herdsman routes */}
          <Route path="/field" element={
            <ProtectedRoute allowedRoles={['Herdsman']}>
              <FieldViewPage />
            </ProtectedRoute>
          } />

          {/* Farm Manager routes */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['Farm Manager']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />

          {/* Shared routes */}
          <Route path="/history" element={
            <ProtectedRoute allowedRoles={['Supervisor', 'Farm Manager']}>
              <HistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['Supervisor', 'Farm Manager']}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

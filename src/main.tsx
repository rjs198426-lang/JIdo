import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import App from './App'
import './styles.css'
import './workspace.css'
import './home.css'
import './trip-layout.css'
import './compact-layout.css'
import './fonts.css'
import './practical-guide.css'
import './travel-upgrades.css'
import './field-upgrade.css'
import './planning-upgrade.css'
import './field-ready.css'
import './complete-travel.css'
import './usability-refresh.css'
import './typography.css'
import { Capacitor } from '@capacitor/core'
const AdminApp = lazy(() => import('./AdminApp'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {!Capacitor.isNativePlatform() && window.location.pathname === '/admin' ? (
      <Suspense
        fallback={
          <p className="admin-loading">관리자 화면을 불러오고 있어요.</p>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)

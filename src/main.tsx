import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'
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
import './trip-header.css'
import './schedule-list.css'
import './responsive-text.css'
import './timeline-cards.css'
import './simple-ui.css'
import './modern-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)

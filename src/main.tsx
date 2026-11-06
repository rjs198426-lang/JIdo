import React from 'react'
import ReactDOM from 'react-dom/client'
import { recoverSyncJournal } from './sync-journal'
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

const root = ReactDOM.createRoot(document.getElementById('root')!)
async function start() {
  await recoverSyncJournal()
  const { default: App } = await import('./App')
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}
void start().catch((error) =>
  root.render(
    <main className="page-section">
      <h1>기록을 안전하게 복구하고 있어요</h1>
      <p>
        {error instanceof Error ? error.message : '앱을 다시 실행해 주세요.'}
      </p>
      <button
        className="button primary"
        onClick={() => window.location.reload()}
      >
        다시 시도
      </button>
    </main>,
  ),
)

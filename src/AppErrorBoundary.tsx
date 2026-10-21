import { Component, type ReactNode } from 'react'
export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-startup" role="alert">
          <strong>잠시 화면을 열지 못했어요</strong>
          <p>저장된 여행 기록은 지우지 않아요.</p>
          <button className="button primary" onClick={() => location.reload()}>
            다시 열기
          </button>
        </main>
      )
    return this.props.children
  }
}

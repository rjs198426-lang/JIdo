import { useEffect, useId, useRef } from 'react'
import { Info } from 'lucide-react'
import './app-information.css'

export default function AppInformation({
  open,
  onToggle,
  onClose,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])

  return (
    <div className="app-information" ref={root}>
      <button
        ref={toggle}
        id="app-information-toggle"
        type="button"
        className="icon-button header-info"
        aria-label="앱 정보"
        title="앱 정보"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <Info size={20} aria-hidden="true" />
      </button>
      {open && (
        <section
          id={panelId}
          className="app-information-panel"
          aria-label="앱 정보"
        >
          <h2>앱 정보</h2>
          <p className="app-information-name">J★Do</p>
          {__JIDO_APP_INFO__.version.startsWith('0.') && (
            <p className="app-information-channel">개발판</p>
          )}
          <p className="app-information-description">
            나와 동행자를 위한 자유여행 도구
          </p>
          <dl>
            <div>
              <dt>앱 버전</dt>
              <dd>{__JIDO_APP_INFO__.version}</dd>
            </div>
            <div>
              <dt>빌드 번호</dt>
              <dd>{__JIDO_APP_INFO__.build}</dd>
            </div>
            <div>
              <dt>지원 기기</dt>
              <dd>Android</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}

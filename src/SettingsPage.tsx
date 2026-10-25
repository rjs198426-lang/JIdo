import { Bell, LocateFixed, Image, FileDown, ChevronRight } from 'lucide-react'
import ContentUpdates from './ContentUpdates'
export default function SettingsPage({ onReminders, onNearby, onPhotoCredits, onBackup }: {
  onReminders: () => void
  onNearby: () => void
  onPhotoCredits: () => void
  onBackup: () => void
}) {
  return (
    <section className="page-section settings-page" aria-label="설정">
      <div className="page-title"><h1>설정</h1></div>
      <section className="settings-group" aria-label="여행과 기기">
        <h2>여행과 기기</h2>
        {([
          ['여행 알림 설정', Bell, onReminders],
          ['현재 위치·내 주변', LocateFixed, onNearby],
          ['여행 백업·공유', FileDown, onBackup],
          ['사진 출처', Image, onPhotoCredits],
        ] as const).map(([label, Icon, action]) => (
          <button key={label} onClick={action}>
            <Icon size={21} /><span>{label}</span><ChevronRight size={18} />
          </button>
        ))}
      </section>
      <section className="settings-group" aria-label="앱 정보">
        <h2>J★Do</h2>
        <p className="settings-version">개발판 {__JIDO_APP_INFO__.version} · 빌드 {__JIDO_APP_INFO__.build} · Android</p>
        <p>여행 기록은 이 기기에 저장돼요. 기기를 바꾸기 전 전체 백업을 저장해 주세요.</p>
        <a href="https://github.com/rjs198426-lang/JIdo/blob/main/APP-TERMS.md" target="_blank" rel="noopener noreferrer">이용 안내 <ChevronRight size={18} /></a>
        <a href="https://github.com/rjs198426-lang/JIdo/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">개인정보 처리 안내 <ChevronRight size={18} /></a>
      </section>
      <section className="settings-group"><ContentUpdates /></section>
    </section>
  )
}

import { useEffect, useState } from 'react'

export default function ConnectionNotice() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (online) return null
  return (
    <p className="connection-notice" role="status">
      <strong>오프라인</strong> 저장한 일정·예약·경비는 볼 수 있어요.
      지도·장소 검색은 인터넷 연결이 필요해요.
    </p>
  )
}

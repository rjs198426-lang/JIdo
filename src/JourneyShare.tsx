import { useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Share2, Copy } from 'lucide-react'
import { companionBackup, companionText } from './journey-personal'
import type { Trip } from './travel-model'
export const TravelSharing = registerPlugin<{
  share(options: { title: string; text?: string; json?: string }): Promise<void>
}>('TravelSharing')
export default function JourneyShare({
  trip,
  day,
}: {
  trip: Trip
  day: number
}) {
  const [scope, setScope] = useState('day'),
    [notes, setNotes] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const text = companionText(trip, scope === 'day' ? day : undefined, notes)
  async function send(file = false) {
    setBusy(true)
    setMessage('')
    try {
      if (Capacitor.getPlatform() === 'android')
        await TravelSharing.share({
          title: trip.title,
          ...(file ? { json: companionBackup(trip, notes) } : { text }),
        })
      else if (file) {
        const url = URL.createObjectURL(
          new Blob([companionBackup(trip, notes)], {
            type: 'application/json',
          }),
        )
        const a = document.createElement('a')
        a.href = url
        a.download = 'jido-itinerary.json'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else if (navigator.share)
        await navigator.share({ title: trip.title, text })
      else {
        await navigator.clipboard.writeText(text)
        setMessage('일정을 복사했어요.')
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        setMessage('공유하지 못했어요. 아래 내용을 복사해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="journey-share">
      <summary aria-label="동행자에게 일정 전달">
        <Share2 size={16} /> 일정 전달
      </summary>
      <div className="share-options">
        <label>
          전달할 일정
          <select
            aria-label="전달할 일정"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="day">선택한 하루</option>
            <option value="all">전체 여행</option>
          </select>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={notes}
            onChange={(event) => setNotes(event.target.checked)}
          />
          장소 메모 포함
        </label>
      </div>
      <textarea aria-label="동행자에게 전달할 내용" readOnly value={text} />
      <div className="row-actions">
        <button
          className="button primary small"
          disabled={busy}
          onClick={() => void send()}
        >
          <Share2 size={16} />
          일정 공유
        </button>
        <button
          className="button outline small"
          disabled={busy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setMessage('일정을 복사했어요.')
            } catch {
              setMessage('아래 내용을 길게 눌러 복사하세요.')
            }
          }}
        >
          <Copy size={16} />
          복사
        </button>
        <button
          className="button outline small"
          disabled={busy}
          onClick={() => void send(true)}
        >
          앱용 일정 파일 전달
        </button>
      </div>
      <small>
        일정 파일은 전체 여행을 전달합니다. 경비·예약 번호·연락처·첨부 파일은
        제외됩니다.
      </small>
      {message && <p role="status">{message}</p>}
    </details>
  )
}

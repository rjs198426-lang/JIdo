import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import type { Reservation } from './travel-model'
import { parseBookingText } from './booking-paste'
import { useDraftFields } from './form-draft'
export default function BookingPaste({
  kind,
  onApply,
  draftId,
}: {
  kind: Reservation['kind']
  onApply: (value: Partial<Reservation>) => void
  draftId: string
}) {
  const draft = useDraftFields(`jido-draft:booking-text:${draftId}`, {
    text: '',
  })
  const [text, setText] = draft.field('text')
  const [message, setMessage] = useState('')
  return (
    <details className="booking-paste simple-options">
      <summary>
        <ClipboardPaste size={18} /> 예약 문자·메일 붙여넣기
      </summary>
      <label className="field">
        예약 내용
        <textarea
          aria-label="예약 내용 붙여넣기"
          value={text}
          maxLength={12000}
          rows={5}
          onChange={(e) => {
            setText(e.target.value)
            setMessage('')
          }}
          placeholder={
            kind === '항공'
              ? '항공사: 대한항공\n편명: KE123\n출발: 2026-12-22 20:00\n도착: 2026-12-23 02:00\n예약번호: ABC123'
              : '호텔명: 예약한 호텔 이름\n체크인: 2026-12-22 15:00\n체크아웃: 2026-12-26 11:00\n예약번호: ABC123'
          }
        />
      </label>
      <button
        type="button"
        className="button outline full"
        disabled={!text.trim()}
        onClick={() => {
          const result = parseBookingText(text, kind)
          if (!Object.keys(result).length)
            return setMessage(
              '알아낸 항목이 없어요. 아래 입력칸에 직접 적어 주세요.',
            )
          onApply(result)
          setMessage(
            '알아낸 항목을 채웠어요. 날짜와 내용을 확인한 뒤 저장해 주세요.',
          )
        }}
      >
        입력칸에 채우기
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  )
}

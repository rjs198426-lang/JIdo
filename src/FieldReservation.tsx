import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import AttachmentsPanel from './AttachmentsPanel'
import AddressCard from './AddressCard'
import { reservationDayLabel } from './field-reservations'
import { formatDate } from './store'
import type { Reservation } from './travel-model'

export default function FieldReservation({
  item,
  date,
  onManage,
  scheduledTime,
}: {
  item: Reservation
  date: string
  onManage: (id: string) => void
  scheduledTime?: string
}) {
  const [message, setMessage] = useState('')
  const dateMatches =
    item.kind === '숙소' && item.endDate
      ? item.date <= date && date < item.endDate
      : item.date === date
  const mismatch =
    scheduledTime !== undefined &&
    (!dateMatches || (item.kind !== '숙소' && item.time !== scheduledTime))
  return (
    <article className="field-booking" aria-label={`${item.title} 현장 예약`}>
      <div className="tool-heading">
        <h4>{item.title}</h4>
        <span
          className={
            item.status === 'confirmed'
              ? 'booking-confirmed'
              : 'booking-pending'
          }
        >
          {item.status === 'confirmed' ? '확정' : '확인 필요'}
        </span>
      </div>
      <p>
        {formatDate(item.kind === '숙소' ? date : item.date)} ·{' '}
        {reservationDayLabel(item, date)}
      </p>
      {mismatch && (
        <p className="booking-pending" role="alert">
          연결된 일정과 예약 날짜·시간이 달라요.
        </p>
      )}
      {item.endDate && item.kind === '숙소' && (
        <p>
          체크인 {formatDate(item.date)} {item.time} · 체크아웃{' '}
          {formatDate(item.endDate)}
        </p>
      )}
      {item.reference && (
        <div className="field-reference">
          <span>예약 번호</span>
          <strong>{item.reference}</strong>
          <button
            className="button outline small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(item.reference)
                setMessage('예약 번호를 복사했어요.')
              } catch {
                setMessage(
                  '복사하지 못했어요. 예약 번호를 길게 눌러 선택하세요.',
                )
              }
            }}
          >
            예약 번호 복사
          </button>
        </div>
      )}
      {item.address && (
        <>
          <p className="field-note">{item.address}</p>
          <AddressCard name={item.title} address={item.address} />
        </>
      )}
      {item.note && <p className="field-note">{item.note}</p>}
      <AttachmentsPanel reservationId={item.id} readOnly />
      <div className="booking-actions">
        {item.link && (
          <a
            className="button outline small"
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            예약 확인 <ExternalLink size={15} />
          </a>
        )}
        <button
          className="button outline small"
          onClick={() => onManage(item.id)}
        >
          이 예약 관리
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </article>
  )
}

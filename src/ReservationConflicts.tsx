import { reservationConflicts } from './reservation-conflicts'
import type { Trip } from './travel-model'
export default function ReservationConflicts({
  trip,
  onOpen,
}: {
  trip: Trip
  onOpen: () => void
}) {
  const conflicts = reservationConflicts(trip)
  if (!conflicts.length) return null
  return (
    <aside className="reservation-conflicts" role="alert">
      <strong>예약과 일정 확인 · {conflicts.length}건</strong>
      <ul>
        {conflicts.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
      <button className="button outline small" onClick={onOpen}>
        예약 확인·수정
      </button>
    </aside>
  )
}

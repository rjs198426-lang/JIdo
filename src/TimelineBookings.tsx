import { Plane, BedDouble, Ticket, TrainFront } from 'lucide-react'
import { dateAt } from './store'
import type { Trip } from './travel-model'
import type { JourneyTarget } from './trip-readiness'
export function timelineBookings(trip: Trip, day: number) {
  const linked = new Set(
    trip.days.flatMap((stops) =>
      stops.flatMap((stop) => (stop.reservationId ? [stop.reservationId] : [])),
    ),
  )
  return (trip.reservations || [])
    .filter(
      (item) =>
        item.date === dateAt(trip.startDate, day) && !linked.has(item.id),
    )
    .sort((a, b) => a.time.localeCompare(b.time))
}
export default function TimelineBookings({
  trip,
  day,
  onLocate,
}: {
  trip: Trip
  day: number
  onLocate: (target: JourneyTarget) => void
}) {
  const bookings = timelineBookings(trip, day)
  if (!bookings.length) return null
  return (
    <section className="timeline-bookings" aria-label="이날 연결 전 예약">
      {bookings.map((item) => {
        const Icon =
          item.kind === '항공'
            ? Plane
            : item.kind === '숙소'
              ? BedDouble
              : item.kind === '교통'
                ? TrainFront
                : Ticket
        return (
          <article className="timeline-item timeline-booking" key={item.id}>
            <div className="timeline-rail">
              <span className="stop-number">
                <Icon size={17} />
              </span>
              <time className="timeline-visit-time" dateTime={item.time}>
                {item.time}
              </time>
            </div>
            <button
              className="timeline-booking-card"
              aria-label={`${item.title} 예약 관리`}
              onClick={() =>
                onLocate({
                  workspace: 'reservations',
                  day,
                  reservationId: item.id,
                })
              }
            >
              <strong>{item.title}</strong>
              <span>
                {item.kind} ·{' '}
                {item.status === 'cancelled'
                  ? '예약 취소'
                  : item.status === 'confirmed'
                    ? '예약 확정'
                    : '확인 전'}
              </span>
              {item.note && <p>{item.note}</p>}
            </button>
          </article>
        )
      })}
    </section>
  )
}

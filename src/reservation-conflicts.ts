import { dateAt } from './store'
import { stopDetails, type Trip } from './travel-model'
export function reservationConflicts(trip: Trip) {
  const result: {
    id: string
    text: string
    reservationId: string
    day?: number
    stopId?: string
  }[] = []
  for (const reservation of trip.reservations || []) {
    if (reservation.status === 'cancelled') continue
    if (reservation.date < trip.startDate || reservation.date > trip.endDate)
      result.push({
        id: `range-${reservation.id}`,
        reservationId: reservation.id,
        text: `${reservation.title} · 예약 ${reservation.date} ${reservation.time} · 여행 기간 밖`,
      })
    trip.days.forEach((stops, day) =>
      stops.forEach((stop) => {
        if (stop.reservationId !== reservation.id) return
        const date = dateAt(trip.startDate, day)
        const dateMatches =
          reservation.kind === '숙소' && reservation.endDate
            ? date >= reservation.date && date < reservation.endDate
            : date === reservation.date
        const timeMatches =
          reservation.kind === '숙소' || stop.time === reservation.time
        if (!dateMatches || !timeMatches)
          result.push({
            id: `stop-${stop.id}`,
            reservationId: reservation.id,
            day,
            stopId: stop.id,
            text: `${stopDetails(stop).name} · 일정 ${date} ${stop.time} / 예약 ${reservation.date} ${reservation.time}`,
          })
      }),
    )
  }
  return result
}

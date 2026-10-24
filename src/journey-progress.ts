import { stopDetails, type Stop, type Trip } from './travel-model'
export function cancelledReservation(trip: Trip, stop: Stop) {
  return (
    !!stop.reservationId &&
    !!trip.reservations?.some(
      (item) => item.id === stop.reservationId && item.status === 'cancelled',
    )
  )
}
export function timeConflicts(trip: Trip, day: number) {
  const stops = trip.days[day].filter(
    (stop) =>
      !!stop.time &&
      stop.status !== 'done' &&
      stop.status !== 'skipped' &&
      !cancelledReservation(trip, stop),
  )
  const start = (stop: Stop) =>
    Number(stop.time.slice(0, 2)) * 60 + Number(stop.time.slice(3))
  const conflicts: { first: string; second: string }[] = []
  for (let i = 0; i < stops.length; i++)
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i],
        b = stops[j]
      if (!a.durationMinutes || !b.durationMinutes) continue
      if (
        start(a) < start(b) + b.durationMinutes &&
        start(b) < start(a) + a.durationMinutes
      )
        conflicts.push({
          first: stopDetails(a).name,
          second: stopDetails(b).name,
        })
    }
  return conflicts
}

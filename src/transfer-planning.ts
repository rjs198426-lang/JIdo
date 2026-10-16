import { routePoints } from './route-map-model'
import { cancelledReservation } from './journey-progress'
import { stopDetails, type Trip, type Stop } from './travel-model'
export function placeSignature(stop: Stop) {
  const place = stopDetails(stop),
    point = routePoints([stop])[0]
  return JSON.stringify([
    place.name,
    place.address,
    point ? [point.lat, point.lng] : null,
  ])
}
export function transferFor(previous: Stop, stop: Stop) {
  const value = stop.transfer
  return value &&
    value.fromStopId === previous.id &&
    value.fromPlace === placeSignature(previous) &&
    value.toPlace === placeSignature(stop)
    ? value
    : undefined
}
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r
  const n =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(Math.max(0, 1 - n)))
}
export function transferLegs(stops: Stop[]) {
  return stops.slice(1).map((stop, index) => {
    const previous = stops[index],
      transfer = transferFor(previous, stop),
      points = routePoints([previous, stop])
    const minute = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    const arrival =
      transfer && previous.durationMinutes !== undefined
        ? minute(previous.time) + previous.durationMinutes + transfer.minutes
        : undefined
    return {
      previous,
      stop,
      transfer,
      arrival,
      lateMinutes:
        arrival === undefined
          ? undefined
          : Math.max(0, arrival - minute(stop.time)),
      distance: points.length === 2 ? km(points[0], points[1]) : undefined,
      stale: !!stop.transfer && !transfer,
    }
  })
}
export function arrivalText(minutes: number) {
  const days = Math.floor(minutes / 1440),
    value = minutes % 1440
  return `${days ? `${days}일 뒤 ` : ''}${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function activeDayStops(trip: Trip, day: number) {
  return trip.days[day].filter(
    (stop) => stop.status !== 'skipped' && !cancelledReservation(trip, stop),
  )
}
export function dayTransferLegs(trip: Trip, day: number) {
  return transferLegs(activeDayStops(trip, day))
}

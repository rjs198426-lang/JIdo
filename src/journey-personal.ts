import { transferFor } from './transfer-planning'
import {
  destinationForDay,
  stopDetails,
  mapQuery,
  type Stop,
  type Trip,
} from './travel-model'
import { today, dateAt, dayCount } from './store'
import { cancelledReservation } from './journey-progress'
import { portableTrip } from './TravelBackup'

export function travelDay(trip: Trip, date = today()) {
  return date >= trip.startDate && date <= trip.endDate
    ? dayCount(trip.startDate, date) - 1
    : null
}
export function journeyPreference(trip: Trip): {
  day: number
  workspace: string
} {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`jido-view-${trip.id}`) || 'null',
    )
    if (
      saved &&
      Number.isInteger(saved.day) &&
      saved.day >= 0 &&
      saved.day < trip.days.length
    )
      return {
        day: saved.day,
        workspace: [
          'schedule',
          'field',
          'overview',
          'route',
          'transfers',
          'files',
          'reservations',
          'checklist',
          'expenses',
        ].includes(saved.workspace)
          ? saved.workspace
          : 'schedule',
      }
  } catch {
    /* Preferences do not prevent opening a trip. */
  }
  return { day: travelDay(trip) ?? 0, workspace: 'schedule' }
}
export function saveJourneyPreference(
  trip: Trip,
  day: number,
  workspace: string,
) {
  try {
    localStorage.setItem(
      `jido-view-${trip.id}`,
      JSON.stringify({ day, workspace }),
    )
  } catch {
    /* Trip data has its own storage error handling. */
  }
}
export function pendingStops(trip: Trip, day: number) {
  return (trip.days[day] || []).filter(
    (stop) =>
      stop.status !== 'done' &&
      stop.status !== 'skipped' &&
      !cancelledReservation(trip, stop),
  )
}
export function lodgingForDay(trip: Trip, day: number) {
  const date = dateAt(trip.startDate, day)
  return (trip.reservations || []).filter(
    (item) =>
      item.kind === '숙소' &&
      item.status !== 'cancelled' &&
      item.date <= date &&
      (item.endDate ? date < item.endDate : item.date === date),
  )
}
export function directionsTo(stop: Stop, trip: Trip) {
  const params = new URLSearchParams({
    api: '1',
    destination: mapQuery(stop, trip),
  })
  if (stop.custom?.googlePlaceId)
    params.set('destination_place_id', stop.custom.googlePlaceId)
  return `https://www.google.com/maps/dir/?${params}`
}
export function companionText(trip: Trip, day?: number, notes = false) {
  const indexes = day === undefined ? trip.days.map((_, i) => i) : [day]
  return [
    trip.title + ' · J★Do',
    trip.startDate + ' ~ ' + trip.endDate,
    ...indexes.flatMap((index) => [
      `\nDAY ${index + 1} · ${dateAt(trip.startDate, index)} · ${destinationForDay(trip, index).name}`,
      ...trip.days[index]
        .filter(
          (stop) =>
            stop.status !== 'skipped' && !cancelledReservation(trip, stop),
        )
        .map(
          (stop) =>
            `${stop.time} ${stopDetails(stop).name}\n${stopDetails(stop).address || ''}\n${directionsTo(stop, trip)}${notes && stop.note ? '\n' + stop.note : ''}`,
        ),
      ...lodgingForDay(trip, index).map(
        (item) =>
          `숙소: ${item.title}${item.address ? '\n' + item.address : ''}`,
      ),
    ]),
  ].join('\n')
}
export function companionBackup(trip: Trip, notes = false) {
  const portable = portableTrip(trip)
  const itinerary: Trip = {
    id: portable.id,
    title: portable.title,
    cityId: portable.cityId,
    startDate: portable.startDate,
    endDate: portable.endDate,
    travelers: portable.travelers,
    destinations: portable.destinations,
    dayDestinationIds: portable.dayDestinationIds,
    reservations: (trip.reservations || [])
      .filter((item) => item.status !== 'cancelled')
      .map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        date: item.date,
        time: item.time,
        endDate: item.endDate,
        status: item.status,
        address: item.address,
        reference: '',
        link: '',
        note: '',
      })),
    days: portable.days.map((stops, index) =>
      stops
        .filter(
          (stop) =>
            stop.status !== 'skipped' &&
            !cancelledReservation(
              trip,
              trip.days[index].find((item) => item.id === stop.id)!,
            ),
        )
        .map((stop) => {
          const { reservationId: _reservation, ...clean } = stop
          return {
            ...clean,
            custom: clean.custom
              ? {
                  ...clean.custom,
                  link: '',
                }
              : undefined,
            ...(stop.reservationId &&
            trip.reservations?.some(
              (item) =>
                item.id === stop.reservationId && item.status !== 'cancelled',
            )
              ? { reservationId: stop.reservationId }
              : {}),
            status: 'planned' as const,
            note: notes ? stop.note : '',
          }
        })
        .map((stop, index, stops) => ({
          ...stop,
          transfer:
            index > 0 && transferFor(stops[index - 1], stop)
              ? stop.transfer
              : undefined,
        })),
    ),
  }
  return JSON.stringify(
    { format: 'jdo-trips', version: 1, trips: [itinerary] },
    null,
    2,
  )
}

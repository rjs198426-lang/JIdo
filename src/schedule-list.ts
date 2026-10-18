import { cancelledReservation } from './journey-progress'
import { stopDetails, type Stop, type Trip } from './travel-model'

export type ScheduleStatus = 'all' | 'planned' | 'done' | 'excluded'
export type ScheduleFilter = {
  query: string
  status: ScheduleStatus
  category: string
}
export const emptyScheduleFilter: ScheduleFilter = {
  query: '',
  status: 'all',
  category: '전체',
}
export function scheduleStatus(
  trip: Trip,
  stop: Stop,
): Exclude<ScheduleStatus, 'all'> {
  if (cancelledReservation(trip, stop) || stop.status === 'skipped')
    return 'excluded'
  return stop.status === 'done' ? 'done' : 'planned'
}
export function scheduleFiles(trip: Trip, stop: Stop) {
  return (trip.attachments || []).filter(
    (file) =>
      file.stopId === stop.id ||
      (!!stop.reservationId && file.reservationId === stop.reservationId),
  )
}
export function matchesSchedule(
  trip: Trip,
  stop: Stop,
  filter: ScheduleFilter,
) {
  const place = stopDetails(stop)
  if (filter.status !== 'all' && scheduleStatus(trip, stop) !== filter.status)
    return false
  if (filter.category !== '전체' && place.category !== filter.category)
    return false
  const reservation = trip.reservations?.find(
    (item) => item.id === stop.reservationId,
  )
  const text =
    `${place.name} ${place.address} ${place.category} ${stop.note} ${reservation?.title || ''} ${scheduleFiles(
      trip,
      stop,
    )
      .map((file) => file.name)
      .join(' ')}`.toLocaleLowerCase()
  return filter.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word))
}
export function scheduleSummary(trip: Trip, day: number) {
  const stops = trip.days[day] || []
  const planned = stops.filter(
    (stop) => scheduleStatus(trip, stop) === 'planned',
  )
  const done = stops.filter((stop) => scheduleStatus(trip, stop) === 'done')
  const times = stops
    .filter((stop) => scheduleStatus(trip, stop) !== 'excluded')
    .map((stop) => stop.time)
    .sort()
  return {
    planned: planned.length,
    done: done.length,
    excluded: stops.length - planned.length - done.length,
    next: planned[0],
    firstTime: times[0],
    lastTime: times.at(-1),
  }
}
export type ScheduleOrder = { day: number; before: string[]; after: string[] }
export function applyScheduleOrder(
  trip: Trip,
  change: ScheduleOrder,
  undo = false,
): Trip {
  const stops = trip.days[change.day]
  const expected = undo ? change.after : change.before
  const ids = undo ? change.before : change.after
  if (
    !stops ||
    JSON.stringify(stops.map((stop) => stop.id)) !== JSON.stringify(expected)
  )
    throw new Error('일정 순서가 바뀌었어요. 현재 목록에서 다시 정리해 주세요.')
  if (
    ids.length !== stops.length ||
    new Set(ids).size !== stops.length ||
    ids.some((id) => !stops.some((stop) => stop.id === id))
  )
    throw new Error('장소 목록이 바뀌었어요. 다시 확인해 주세요.')
  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  return {
    ...trip,
    days: trip.days.map((items, index) =>
      index === change.day ? ids.map((id) => byId.get(id)!) : items,
    ),
  }
}

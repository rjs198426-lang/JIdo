import { getPlace } from './catalog'
import { destinationForDay, tripDestinations, type Trip } from './travel-model'
import { sameStopPlace } from './stop-identity'
export function moveScheduleStops(
  trip: Trip,
  from: number,
  to: number,
  ids: string[],
): Trip {
  if (
    from === to ||
    !trip.days[from] ||
    !trip.days[to] ||
    !ids.length ||
    new Set(ids).size !== ids.length
  )
    throw new Error('옮길 일정과 날짜를 다시 선택해 주세요.')
  const selected = trip.days[from].filter((stop) => ids.includes(stop.id))
  if (selected.length !== ids.length)
    throw new Error('일정이 바뀌었어요. 다시 선택해 주세요.')
  const destination = destinationForDay(trip, to)
  if (
    selected.some((stop) => {
      if (!stop.custom)
        return getPlace(stop.placeId)?.cityId !== destination.guideCityId
      const original = tripDestinations(trip).find(
        (d) => d.id === stop.custom!.destinationId,
      )
      return (
        original?.id !== destination.id &&
        !(
          original?.guideCityId &&
          original.guideCityId === destination.guideCityId
        )
      )
    })
  )
    throw new Error('같은 도시로 지정된 날짜로 옮겨 주세요.')
  if (
    selected.some((stop) =>
      trip.days[to].some((other) => sameStopPlace(stop, other)),
    )
  )
    throw new Error(
      '옮길 날짜에 같은 장소가 있어요. 겹치지 않게 선택해 주세요.',
    )
  if (trip.days[to].length + selected.length > 200)
    throw new Error('하루에는 200곳까지 담을 수 있어요.')
  return {
    ...trip,
    days: trip.days.map((stops, day) =>
      day === from
        ? stops.filter((stop) => !ids.includes(stop.id))
        : day === to
          ? [
              ...stops,
              ...selected.map((stop) =>
                stop.custom
                  ? {
                      ...stop,
                      custom: { ...stop.custom, destinationId: destination.id },
                    }
                  : stop,
              ),
            ]
          : stops,
    ),
  }
}
export type ScheduleMove = {
  from: number
  to: number
  ids: string[]
  before: string[][]
  after: string[][]
  destinations: Record<string, string>
}
export function scheduleMoveRecord(
  before: Trip,
  after: Trip,
  from: number,
  to: number,
  ids: string[],
): ScheduleMove {
  return {
    from,
    to,
    ids,
    before: [
      before.days[from].map((s) => s.id),
      before.days[to].map((s) => s.id),
    ],
    after: [after.days[from].map((s) => s.id), after.days[to].map((s) => s.id)],
    destinations: Object.fromEntries(
      before.days[from]
        .filter((s) => ids.includes(s.id) && s.custom)
        .map((s) => [s.id, s.custom!.destinationId]),
    ),
  }
}
export function undoScheduleMove(trip: Trip, change: ScheduleMove): Trip {
  const current = [trip.days[change.from], trip.days[change.to]]
  if (
    current.some(
      (stops, i) =>
        !stops ||
        JSON.stringify(stops.map((s) => s.id)) !==
          JSON.stringify(change.after[i]),
    )
  )
    throw new Error(
      '날짜의 일정이 바뀌어 되돌릴 수 없어요. 현재 목록에서 옮겨 주세요.',
    )
  const byId = new Map(current.flat().map((s) => [s.id, s]))
  return {
    ...trip,
    days: trip.days.map((stops, day) => {
      const index = day === change.from ? 0 : day === change.to ? 1 : -1
      return index < 0
        ? stops
        : change.before[index].map((id) => {
            const stop = byId.get(id)!
            return stop.custom && Object.hasOwn(change.destinations, id)
              ? {
                  ...stop,
                  custom: {
                    ...stop.custom,
                    destinationId: change.destinations[id],
                  },
                }
              : stop
          })
    }),
  }
}

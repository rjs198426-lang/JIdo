import { dateAt } from './store'
import { cancelledReservation } from './journey-progress'
import { type Stop, type Trip } from './travel-model'
import { placeSignature } from './transfer-planning'
export const canAdjustStop = (trip: Trip, stop: Stop) =>
  !!stop.time &&
  stop.status !== 'done' &&
  stop.status !== 'skipped' &&
  !stop.reservationId &&
  !cancelledReservation(trip, stop)
export type TimeAdjustment = {
  day: number
  date: string
  changes: { id: string; place: string; before: string; after: string }[]
}
function shifted(time: string, delta: number) {
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + delta
  if (minute < 0 || minute > 1439)
    throw new Error(
      '날짜를 넘는 변경은 적용할 수 없어요. 날짜 이동을 사용하세요.',
    )
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}
export function previewTimeAdjustment(
  trip: Trip,
  day: number,
  minutes: number,
  ids: string[],
): TimeAdjustment {
  if (
    !trip.days[day] ||
    !Number.isInteger(minutes) ||
    !minutes ||
    Math.abs(minutes) > 720
  )
    throw new Error('변경할 시간은 -720~720분의 정수로 입력하세요.')
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error('변경할 장소를 선택하세요.')
  const changes = ids.map((id) => {
    const stop = trip.days[day].find((item) => item.id === id)
    if (!stop || !canAdjustStop(trip, stop))
      throw new Error('예약 연결·완료·건너뛴 장소는 일괄 변경하지 않습니다.')
    return {
      id,
      place: placeSignature(stop),
      before: stop.time,
      after: shifted(stop.time, minutes),
    }
  })
  return { day, date: dateAt(trip.startDate, day), changes }
}
export function applyTimeAdjustment(
  trip: Trip,
  adjustment: TimeAdjustment,
  undo = false,
) {
  const stops = trip.days[adjustment.day]
  if (
    !stops ||
    dateAt(trip.startDate, adjustment.day) !== adjustment.date ||
    !adjustment.changes.length
  )
    throw new Error('여행 날짜가 바뀌었어요. 다시 확인하세요.')
  for (const change of adjustment.changes) {
    const stop = stops.find((item) => item.id === change.id)
    if (
      !stop ||
      placeSignature(stop) !== change.place ||
      !canAdjustStop(trip, stop) ||
      stop.time !== (undo ? change.after : change.before)
    )
      throw new Error('일정이 바뀌어 적용할 수 없어요. 현재 시간을 확인하세요.')
  }
  return {
    ...trip,
    days: trip.days.map((items, index) =>
      index !== adjustment.day
        ? items
        : items.map((stop) => {
            const change = adjustment.changes.find(
              (item) => item.id === stop.id,
            )
            return change
              ? { ...stop, time: undo ? change.before : change.after }
              : stop
          }),
    ),
  }
}

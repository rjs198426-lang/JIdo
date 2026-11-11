import type { Reservation } from './travel-model'
import { reminderInstant } from './travel-reminders'
// Compare actual instants only when the user supplied both airport zones.
export function flightTimingIssue(item: Reservation): string | undefined {
  const f = item.kind === '항공' ? item.flight : undefined
  if (
    !f?.arrivalDate ||
    !f.arrivalTime ||
    !f.departureTimeZone ||
    !f.arrivalTimeZone ||
    !item.time
  )
    return
  const departure = reminderInstant(item.date, item.time, f.departureTimeZone),
    arrival = reminderInstant(f.arrivalDate, f.arrivalTime, f.arrivalTimeZone)
  if (!departure || !arrival)
    return '선택한 시간대에 존재하는 출발·도착 시각인지 확인해 주세요.'
  if (+arrival <= +departure)
    return '도착 시각이 출발보다 빠르거나 같아요. 각 공항의 현지 날짜·시간대를 확인해 주세요.'
}

import { dateAt } from './store'
import type { Reservation, Trip } from './travel-model'

export function reservationDayLabel(item: Reservation, date: string) {
  if (item.kind !== '숙소') return `${item.kind} · ${item.time}`
  if (
    date < item.date ||
    (item.endDate && date > item.endDate) ||
    (!item.endDate && date !== item.date)
  )
    return '숙소 · 이용일 확인'
  if (item.endDate && item.endDate !== item.date && item.endDate === date)
    return '숙소 · 체크아웃일'
  if (item.date === date) return `숙소 · 체크인 ${item.time}`
  return '숙소 · 숙박 중'
}
export function reservationsForDay(trip: Trip, day: number) {
  const date = dateAt(trip.startDate, day)
  return (trip.reservations || [])
    .filter(
      (item) =>
        item.status !== 'cancelled' &&
        (item.date === date ||
          (item.kind === '숙소' &&
            !!item.endDate &&
            item.date <= date &&
            item.endDate >= date)),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}

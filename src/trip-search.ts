import { dateAt, formatDate } from './store'
import { stopDetails, destinationForDay, type Trip } from './travel-model'
import type { Attachment } from './attachment-schema'
import type { JourneyTarget } from './trip-readiness'
export const tripSearchCategories = [
  '전체',
  '일정',
  '예약',
  '준비물',
  '자료',
  '지출',
] as const
export type TripSearchResult = {
  key: string
  category: string
  title: string
  detail: string
  text: string
  target: JourneyTarget
}
export function attachmentConnection(file: Attachment, trip?: Trip) {
  if (file.reservationId)
    return (
      trip?.reservations?.find((item) => item.id === file.reservationId)
        ?.title || '연결한 예약 없음'
    )
  if (file.stopId) {
    const stop = trip?.days.flat().find((item) => item.id === file.stopId)
    return stop ? stopDetails(stop).name : '연결한 장소 없음'
  }
  if (file.expenseId)
    return (
      trip?.expenses?.find((item) => item.id === file.expenseId)?.title ||
      '연결한 지출 없음'
    )
  return '공용 자료'
}
export function searchTrip(trip: Trip, query: string, category = '전체') {
  const words = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return []
  const results: TripSearchResult[] = []
  const add = (result: TripSearchResult) => {
    const haystack = `${result.title} ${result.detail} ${result.text}`
      .normalize('NFKC')
      .toLocaleLowerCase()
    if (
      (category === '전체' || category === result.category) &&
      words.every((word) => haystack.includes(word))
    )
      results.push(result)
  }
  trip.days.forEach((stops, day) =>
    stops.forEach((stop) => {
      const place = stopDetails(stop)
      add({
        key: `stop-${day}-${stop.id}`,
        category: '일정',
        title: place.name,
        detail: `DAY ${day + 1} · ${formatDate(dateAt(trip.startDate, day))} ${stop.time} · ${destinationForDay(trip, day).name}${stop.status === 'done' ? ' · 완료' : stop.status === 'skipped' ? ' · 건너뜀' : ''}`,
        text: `${place.address} ${stop.note}`,
        target: { workspace: 'schedule', day, stopId: stop.id },
      })
    }),
  )
  for (const item of trip.reservations || [])
    add({
      key: `reservation-${item.id}`,
      category: '예약',
      title: item.title,
      detail: `${formatDate(item.date)} ${item.time} · ${item.kind}${item.status === 'cancelled' ? ' · 취소' : ''}`,
      text: `${item.reference} ${item.address} ${item.note}`,
      target: { workspace: 'reservations', reservationId: item.id },
    })
  for (const item of trip.checklist || [])
    add({
      key: `checklist-${item.id}`,
      category: '준비물',
      title: item.title,
      detail: `${item.category || '기타'} · ${item.done ? '완료' : '미완료'}`,
      text: item.note || '',
      target: { workspace: 'checklist', checklistId: item.id },
    })
  for (const item of trip.attachments || [])
    add({
      key: `attachment-${item.id}`,
      category: '자료',
      title: item.name,
      detail: attachmentConnection(item, trip),
      text: '',
      target: { workspace: 'files', attachmentId: item.id },
    })
  for (const item of trip.expenses || [])
    add({
      key: `expense-${item.id}`,
      category: '지출',
      title: item.title,
      detail: `${formatDate(item.date)} · ${item.amount} ${item.currency}`,
      text: `${item.note || ''} ${item.payer}`,
      target: { workspace: 'expenses', expenseId: item.id },
    })
  return results
}

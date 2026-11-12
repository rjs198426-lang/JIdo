import type { Reservation } from './travel-model'

export function matchesReservation(item: Reservation, query: string) {
  const text = [
    item.title,
    item.kind,
    item.reference,
    item.address,
    item.note,
    item.date,
    item.endDate,
    ...Object.values(item.flight || {}),
    ...Object.values(item.stay || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFKC')
    .toLocaleLowerCase()
  return query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word))
}

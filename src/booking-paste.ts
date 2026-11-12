import type { Reservation } from './travel-model'

// Extract explicitly labelled values only. No remote request, cost or timezone guess.
export function parseBookingText(
  text: string,
  kind: Reservation['kind'],
): Partial<Reservation> {
  const lines = text.split(/\r?\n/)
  const field = (labels: string) => {
    const pattern = new RegExp(`^\\s*(?:${labels})\\s*[:：]\\s*(.+)$`, 'i')
    return lines.map((line) => line.match(pattern)?.[1]?.trim()).find(Boolean)
  }
  const date = (value?: string) => {
    const match = value?.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
    if (!match) return undefined
    const result = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    const parsed = new Date(result + 'T12:00:00Z')
    return Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === result
      ? result
      : undefined
  }
  const time = (value?: string) =>
    value?.match(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\b/)?.[1]?.padStart(5, '0')
  const result: Partial<Reservation> = {}
  const title = field('예약명|숙소명|호텔명|hotel name|title')
  const reference = field(
    String.raw`예약\s*번호|예약\s*코드|확인\s*번호|booking (?:reference|number|id)|confirmation(?: number)?|pnr`,
  )
  const address = field('주소|address')
  if (title && title.length <= 160) result.title = title
  if (reference && reference.length <= 100) result.reference = reference
  if (address && address.length <= 500) result.address = address
  if (kind === '항공') {
    const flight: NonNullable<Reservation['flight']> = {}
    const fields = [
      ['airline', '항공사|airline'],
      ['number', '편명|항공편|flight(?: number)?'],
      ['departureAirport', '출발 공항|departure airport'],
      ['arrivalAirport', '도착 공항|arrival airport'],
    ] as const
    for (const [key, label] of fields) {
      const value = field(label)
      if (
        value &&
        value.length <= (key === 'number' ? 50 : key === 'airline' ? 100 : 160)
      )
        flight[key] = value
    }
    const departure = field('출발|출발 일시|departure'),
      arrival = field('도착|도착 일시|arrival')
    const departureDate = date(departure),
      departureTime = time(departure)
    if (departureDate) result.date = departureDate
    if (departureTime) result.time = departureTime
    const arrivalDate = date(arrival),
      arrivalTime = time(arrival)
    if (arrivalDate) flight.arrivalDate = arrivalDate
    if (arrivalTime) flight.arrivalTime = arrivalTime
    if (Object.keys(flight).length) result.flight = flight
    if (!result.title && (flight.airline || flight.number))
      result.title = [flight.airline, flight.number]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 160)
  } else if (kind === '숙소') {
    const checkin = field('체크인|check[- ]?in'),
      checkout = field('체크아웃|check[- ]?out')
    const start = date(checkin),
      end = date(checkout),
      startTime = time(checkin),
      endTime = time(checkout)
    if (start) result.date = start
    if (end) result.endDate = end
    if (startTime) result.time = startTime
    if (endTime) result.stay = { checkoutTime: endTime }
  }
  return result
}

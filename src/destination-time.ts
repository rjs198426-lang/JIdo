import { destinationForDay, type Trip, type Destination } from './travel-model'
const cityZones: Record<string, string> = {
  kyoto: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  tokyo: 'Asia/Tokyo',
  yokohama: 'Asia/Tokyo',
  nagoya: 'Asia/Tokyo',
  sapporo: 'Asia/Tokyo',
  fukuoka: 'Asia/Tokyo',
  hiroshima: 'Asia/Tokyo',
  kobe: 'Asia/Tokyo',
  sendai: 'Asia/Tokyo',
  bali: 'Asia/Makassar',
  bangkok: 'Asia/Bangkok',
  santorini: 'Europe/Athens',
  dubai: 'Asia/Dubai',
  maldives: 'Indian/Maldives',
  taipei: 'Asia/Taipei',
  hongkong: 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  danang: 'Asia/Ho_Chi_Minh',
  guam: 'Pacific/Guam',
  saipan: 'Pacific/Saipan',
}
const countryZones: Record<string, string> = {
  일본: 'Asia/Tokyo',
  한국: 'Asia/Seoul',
  대한민국: 'Asia/Seoul',
  프랑스: 'Europe/Paris',
  이탈리아: 'Europe/Rome',
  영국: 'Europe/London',
  포르투갈: 'Europe/Lisbon',
  태국: 'Asia/Bangkok',
  베트남: 'Asia/Ho_Chi_Minh',
  대만: 'Asia/Taipei',
  홍콩: 'Asia/Hong_Kong',
  싱가포르: 'Asia/Singapore',
  '미국령 괌': 'Pacific/Guam',
  '북마리아나 제도': 'Pacific/Saipan',
}
export function validTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format()
    return true
  } catch {
    return false
  }
}
export function destinationTimeZone(destination: Destination) {
  return (
    destination.timeZone ||
    cityZones[destination.guideCityId || ''] ||
    countryZones[destination.country]
  )
}
export function localClock(now: Date, zone?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(zone ? { timeZone: zone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (name: string) => parts.find((p) => p.type === name)?.value || ''
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  }
}
export function tripClock(trip: Trip, day: number, now = new Date()) {
  return localClock(now, destinationTimeZone(destinationForDay(trip, day)))
}

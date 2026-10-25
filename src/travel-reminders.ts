import { dateAt, dayCount } from './store'
import { destinationForDay, stopDetails, type Trip } from './travel-model'
import {
  destinationTimeZone,
  localClock,
  validTimeZone,
} from './destination-time'
import { cancelledReservation } from './journey-progress'

export type ReminderPreferences = {
  enabled: boolean
  countdown: boolean
  preparation: boolean
  reservations: boolean
  visits: boolean
  flightZones: Record<string, string>
}
export const reminderDefaults: ReminderPreferences = {
  enabled: false,
  countdown: true,
  preparation: false,
  reservations: false,
  visits: false,
  flightZones: {},
}
export const reminderKey = 'jido-reminders-v1'
export const reminderEvent = 'jido:reminders-changed'
export function readReminderPreferences(): ReminderPreferences {
  try {
    const v = JSON.parse(localStorage.getItem(reminderKey) || 'null')
    if (!v || typeof v !== 'object')
      return { ...reminderDefaults, flightZones: {} }
    const p = { ...reminderDefaults, flightZones: {} as Record<string, string> }
    for (const key of [
      'enabled',
      'countdown',
      'preparation',
      'reservations',
      'visits',
    ] as const)
      if (typeof v[key] === 'boolean') p[key] = v[key]
    if (v.flightZones && typeof v.flightZones === 'object')
      for (const [key, value] of Object.entries(v.flightZones).slice(0, 500))
        if (
          key.length <= 300 &&
          typeof value === 'string' &&
          validTimeZone(value)
        )
          p.flightZones[key] = value
    return p
  } catch {
    return { ...reminderDefaults, flightZones: {} }
  }
}
export function writeReminderPreferences(value: ReminderPreferences) {
  localStorage.setItem(reminderKey, JSON.stringify(value))
  window.dispatchEvent(new Event(reminderEvent))
}
export type ReminderTarget = {
  tripId: string
  day: number
  workspace: 'schedule' | 'reservations' | 'checklist'
}
export type TravelReminder = {
  key: string
  at: Date
  title: string
  body: string
  target: ReminderTarget
  kind: 'countdown' | 'preparation' | 'reservation' | 'visit'
}
// Resolve calendar clock time in its real zone, including DST. Missing wall times are skipped.
export function reminderInstant(
  date: string,
  time: string,
  zone?: string,
): Date | undefined {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return
  if (!zone) {
    const d = new Date(`${date}T${time}:00`)
    return Number.isFinite(+d) &&
      localClock(d).date === date &&
      localClock(d).time === time
      ? d
      : undefined
  }
  if (!validTimeZone(zone)) return
  const desired = Date.parse(`${date}T${time}:00Z`)
  if (!Number.isFinite(desired)) return
  let candidate = desired
  for (let i = 0; i < 4; i++) {
    const clock = localClock(new Date(candidate), zone)
    const seen = Date.parse(`${clock.date}T${clock.time}:00Z`)
    candidate += desired - seen
  }
  const result = new Date(candidate),
    clock = localClock(result, zone)
  return clock.date === date && clock.time === time ? result : undefined
}
export function planTravelReminders(
  trips: Trip[],
  preferences: ReminderPreferences,
  now = new Date(),
): TravelReminder[] {
  if (!preferences.enabled) return []
  const result: TravelReminder[] = []
  function add(item: TravelReminder | undefined) {
    if (item && Number.isFinite(+item.at) && +item.at > +now + 1000)
      result.push(item)
  }
  for (const trip of trips) {
    const prefix = trip.title.slice(0, 80)
    if (preferences.countdown)
      for (let days = 7; days >= 0; days--) {
        const at = reminderInstant(dateAt(trip.startDate, -days), '09:00')
        if (!at) continue
        add({
          key: `${trip.id}:countdown:${days}`,
          at,
          title: days ? `여행 출발 D-${days}` : '오늘 여행을 떠나요',
          body: `${prefix} · ${days ? '여행 준비를 확인해 보세요.' : '출발 전 일정과 준비물을 확인해 보세요.'}`,
          target: { tripId: trip.id, day: 0, workspace: 'schedule' },
          kind: 'countdown',
        })
      }
    const pending = (trip.checklist || []).filter((i) => !i.done)
    if (preferences.preparation && pending.length) {
      const at = reminderInstant(dateAt(trip.startDate, -1), '18:00')
      if (at)
        add({
          key: `${trip.id}:preparation`,
          at,
          title: '내일 출발, 준비물 확인',
          body: `${prefix} · 아직 준비하지 않은 항목 ${pending.length}개를 확인하세요.`,
          target: { tripId: trip.id, day: 0, workspace: 'checklist' },
          kind: 'preparation',
        })
    }
    if (preferences.reservations)
      for (const booking of trip.reservations || []) {
        if (booking.status === 'cancelled') continue
        const day = Math.max(
          0,
          Math.min(
            trip.days.length - 1,
            dayCount(trip.startDate, booking.date) - 1,
          ),
        )
        const zone =
          booking.kind === '항공'
            ? preferences.flightZones[`${trip.id}:${booking.id}`]
            : destinationTimeZone(destinationForDay(trip, day))
        if (booking.kind === '항공' && !zone) continue
        const clock = reminderInstant(booking.date, booking.time, zone)
        if (!clock) continue
        add({
          key: `${trip.id}:reservation:${booking.id}`,
          at: new Date(+clock - 60 * 60000),
          title: '1시간 뒤 예약이 있어요',
          body: `${prefix} · ${booking.title.slice(0, 80)}`,
          target: { tripId: trip.id, day, workspace: 'reservations' },
          kind: 'reservation',
        })
      }
    if (preferences.visits)
      trip.days.forEach((stops, day) => {
        for (const stop of stops) {
          if (
            !stop.time ||
            stop.status === 'done' ||
            stop.status === 'skipped' ||
            cancelledReservation(trip, stop)
          )
            continue
          const booking = trip.reservations?.find(
            (i) => i.id === stop.reservationId,
          )
          const zone =
            booking?.kind === '항공'
              ? preferences.flightZones[`${trip.id}:${booking.id}`]
              : destinationTimeZone(destinationForDay(trip, day))
          if (booking?.kind === '항공' && !zone) continue
          // A linked reservation already has its own reminder when that category is enabled.
          if (
            preferences.reservations &&
            booking &&
            booking.status !== 'cancelled'
          )
            continue
          const clock = reminderInstant(
            dateAt(trip.startDate, day),
            stop.time,
            zone,
          )
          if (!clock) continue
          add({
            key: `${trip.id}:visit:${stop.id}`,
            at: new Date(+clock - 30 * 60000),
            title: '30분 뒤 방문 일정',
            body: `${prefix} · ${stopDetails(stop).name.slice(0, 80)}`,
            target: { tripId: trip.id, day, workspace: 'schedule' },
            kind: 'visit',
          })
        }
      })
  }
  return result.sort((a, b) => +a.at - +b.at || a.key.localeCompare(b.key))
}
export const reminderLimit = 120

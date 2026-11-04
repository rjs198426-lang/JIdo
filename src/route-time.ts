import { destinationForDay, type Stop, type Trip } from './travel-model'
import { destinationTimeZone } from './destination-time'
import { reminderInstant } from './travel-reminders'
import { dateAt } from './store'

export function routeDeparture(trip: Trip, day: number, previous: Stop) {
  const zone = destinationTimeZone(destinationForDay(trip, day))
  if (!zone || !previous.time || previous.durationMinutes === undefined) return
  const at = reminderInstant(dateAt(trip.startDate, day), previous.time, zone)
  return at ? new Date(+at + previous.durationMinutes * 60000) : undefined
}

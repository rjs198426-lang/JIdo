import type { Trip } from './travel-model'
export const RESERVATION_DETAILS_BUILD = 84
export function hasReservationDetails(trips: Trip[]) {
  return trips.some(trip => trip.reservations?.some(item => item.flight !== undefined || item.stay !== undefined || item.time === ''))
}
